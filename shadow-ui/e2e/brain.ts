import type { Page, Route } from "@playwright/test";
import fixtures from "./brain-fixtures.json" with { type: "json" };

/* A stand-in for shadow-brain, answering the UI's /api calls in the browser
   so the smoke tests need no Ollama and no models. The GET fixtures were
   recorded from a real brain on a fresh install; the stream uses the same
   "data: {...}" events /chat/stream sends. */

type Json = Record<string, unknown>;
type Event = Json & { type: string };

interface Saved {
  id: string;
  title: string;
  messages: Json[];
}

export interface FakeBrain {
  sent: Json[];
  stops: number;
  approved: string[];
  /** Keep the next reply open until the UI stops it, as a slow model would. */
  holdNextReply(): void;
}

const sse = (events: Event[]) => events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");

function replyEvents(text: string): Event[] {
  const router = { adapters: [], method: "keywords", probabilities: null, ms: 0 };
  return [
    { type: "route", route: "chat", router, model: "Default", effort: "low", skill: null },
    ...text.split(/(?<= )/).map((t) => ({ type: "token", text: t })),
    { type: "done", reply: text, route: "chat", tools: [], router, model: "Default", effort: "low", skill: null },
  ];
}

export async function fakeBrain(page: Page): Promise<FakeBrain> {
  const skills = structuredClone(fixtures["/skills"].skills) as Json[];
  const chats = new Map<string, Saved>();
  let holdNext = false;
  // Like the real /chat/stop: the turn ends and its partial reply is saved
  // before the stop request returns, so the UI's re-read finds it.
  let endHeldTurn: (() => void) | null = null;

  const brain: FakeBrain = {
    sent: [],
    stops: 0,
    approved: [],
    holdNextReply() {
      holdNext = true;
    },
  };

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

  await page.route((url) => url.pathname.startsWith("/api/"), async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, "");
    const method = request.method();

    if (method === "POST" && path === "/chat/stream") {
      const body = request.postDataJSON() as Json;
      brain.sent.push(body);
      const id = String(body.conversation_id);
      const chat = chats.get(id) ?? { id, title: String(body.message), messages: [] };
      chats.set(id, chat);
      chat.messages.push({ id: `u${chat.messages.length}`, role: "user", content: body.message });
      if (holdNext) {
        holdNext = false;
        await new Promise<void>((resolve) => {
          endHeldTurn = () => {
            chat.messages.push({ id: `a${chat.messages.length}`, role: "assistant", content: "", tools: [], stopped: true });
            resolve();
          };
        });
        return route.fulfill({ status: 200, contentType: "text/event-stream", body: "" }).catch(() => {});
      }
      const text = `You said: ${body.message}`;
      chat.messages.push({ id: `a${chat.messages.length}`, role: "assistant", content: text, route: "chat", tools: [], model: "Default", effort: "low" });
      return route.fulfill({ status: 200, contentType: "text/event-stream", body: sse(replyEvents(text)) });
    }
    if (method === "POST" && path === "/chat/stop") {
      brain.stops += 1;
      endHeldTurn?.();
      endHeldTurn = null;
      return json(route, { ok: true });
    }
    if (method === "POST" && path === "/router/warm") return json(route, { ok: true });
    if (method === "GET" && path === "/health") return json(route, { ok: true, version: "0.1.0" });

    const approve = /^\/skills\/([^/]+)\/approve$/.exec(path);
    if (method === "POST" && approve) {
      const skill = skills.find((s) => s.name === approve[1]);
      if (skill) skill.trusted = true;
      brain.approved.push(approve[1]);
      return json(route, { skill });
    }
    const oneSkill = /^\/skills\/([^/]+)$/.exec(path);
    if (method === "GET" && oneSkill) {
      const skill = skills.find((s) => s.name === oneSkill[1]);
      if (!skill) return json(route, { detail: "No such skill" }, 404);
      return json(route, { ...skill, content: "Read the PDF and summarise it in three bullets.", sha256: "a".repeat(64) });
    }
    if (method === "GET" && path === "/skills") return json(route, { skills });

    if (method === "GET" && path === "/conversations") {
      return json(route, [...chats.values()].map((c) => ({ id: c.id, title: c.title, updated_at: new Date().toISOString() })));
    }
    const oneChat = /^\/conversations\/([^/]+)$/.exec(path);
    if (method === "GET" && oneChat) {
      const chat = chats.get(decodeURIComponent(oneChat[1]));
      if (!chat) return json(route, { detail: "No such chat" }, 404);
      return json(route, { ...chat, running: false });
    }

    if (method === "GET" && path in fixtures) return json(route, fixtures[path as keyof typeof fixtures]);
    return json(route, { detail: `The test brain has no answer for ${method} ${path}` }, 501);
  });

  return brain;
}
