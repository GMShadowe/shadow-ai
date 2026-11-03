import { API_BASE } from "@/lib/api";
import type { ConversationSummary, ServerMessage } from "@/lib/api";
import type { Conversation, Message, StreamEvent, ToolEntry } from "@/types";

export function newConversation(): Conversation {
  return { id: crypto.randomUUID(), title: "New chat", messages: [], saved: false, updatedAt: null };
}

export function fromSummary(c: ConversationSummary): Conversation {
  return { id: c.id, title: c.title, messages: null, saved: true, updatedAt: c.updated_at };
}

export function fromServer(m: ServerMessage): Message {
  return {
    ...m,
    images: (m.images ?? []).map((name) => `${API_BASE}/images/${name}`),
    tools: m.tools ?? [],
    route: m.route ?? null,
    router: m.router ?? null,
    stopped: !!m.stopped,
    streaming: false,
  };
}

/** The reply on screen while a turn streams in. */
export function placeholder(skill: string | null = null): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: "",
    tools: [],
    route: null,
    router: null,
    skill,
    streaming: true,
    startedAt: Date.now(),
  };
}

export function titleFrom(text: string): string {
  return (text || "Image").replace(/\s+/g, " ").slice(0, 60);
}

/** The brain's explanation of a failure, carried on the thrown error. */
export class TurnError extends Error {
  shadow: { kind?: string; action?: string; model?: string };
  constructor(event: Extract<StreamEvent, { type: "error" }>) {
    super(event.message);
    this.shadow = { kind: event.kind, action: event.action, model: event.model };
  }
}

/* How each streamed event changes the reply on screen. Pure, so every kind
   of turn (send, regenerate, edit) shares it. `usage` and `error` don't touch
   the message and are handled by the caller. */
export function applyEvent(m: Message, event: StreamEvent): Message {
  const tools: ToolEntry[] = m.tools ?? [];
  switch (event.type) {
    case "route":
      return {
        ...m,
        route: event.route,
        router: event.router,
        model: event.model,
        effort: event.effort,
        skill: event.skill ?? m.skill ?? null,
      };
    case "permission":
      return {
        ...m,
        content: "",
        tools: [
          ...tools,
          { kind: "permission", id: event.id, name: event.name, args: event.args, preview: event.preview ?? null, decision: null },
        ],
      };
    case "permission_result":
      return {
        ...m,
        tools: tools.map((t) => (t.kind === "permission" && t.id === event.id ? { ...t, decision: event.decision } : t)),
      };
    case "tool_start":
      // Text before a tool call is usually "let me check…", so clear it.
      return {
        ...m,
        content: "",
        tools: [...tools, { name: event.name, args: event.args, result: null, startedAt: Date.now() }],
      };
    case "tool_end": {
      const next = [...tools];
      for (let i = next.length - 1; i >= 0; i--) {
        const t = next[i];
        if (t.kind !== "permission" && t.name === event.name && t.result === null) {
          next[i] = { ...t, result: event.result, endedAt: Date.now() };
          break;
        }
      }
      return { ...m, tools: next };
    }
    case "token":
      return { ...m, content: m.content + event.text };
    case "done":
      return { ...m, content: event.reply, streaming: false };
    default:
      return m;
  }
}

/* Which files this turn actually touched, as {name or path -> full path}.
   A path only becomes a chip if a tool in the same turn read or wrote it:
   inferred from the tool calls, never from anything the model wrote. */
const FILE_ARGS: Record<string, string[]> = {
  read_file: ["path"],
  write_file: ["path"],
  edit_file: ["path"],
  move_file: ["source", "dest"],
  delete_file: ["path"],
};

export function touchedFiles(tools: ToolEntry[] = []): Map<string, string> {
  const out = new Map<string, string>();
  for (const call of tools) {
    if (call.kind === "permission") continue;
    for (const field of FILE_ARGS[call.name] ?? []) {
      const value = call.args?.[field];
      if (typeof value !== "string" || !value.trim()) continue;
      const path = value.trim();
      const name = path.split("/").pop();
      out.set(path, path);
      if (name && name !== path) out.set(name, path);
    }
  }
  return out;
}

export function metaLine(message: Message): string {
  const probs = message.router?.probabilities;
  const top = probs ? Math.round(Math.max(...Object.values(probs)) * 100) : null;
  const ms = message.router?.ms ?? 0;
  return [
    message.model,
    message.effort && `${message.effort} effort`,
    message.router?.method && `${message.router.method}${top !== null ? ` ${top}%` : ""}`,
    ms > 0 && `${ms}ms`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* Every file a tool touched and every link a reply gave, across the whole
   chat, in the order they first appeared. Feeds the top bar's sources list. */
export function sourcesOf(messages: Message[] | null): { files: string[]; links: string[] } {
  const files = new Set<string>();
  const links = new Set<string>();
  for (const m of messages ?? []) {
    if (m.role !== "assistant") continue;
    for (const path of new Set(touchedFiles(m.tools).values())) files.add(path);
    for (const url of m.content.match(/https?:\/\/[^\s)<>\]"'`]+/g) ?? []) links.add(url.replace(/[.,;:!?]+$/, ""));
  }
  return { files: [...files], links: [...links] };
}
