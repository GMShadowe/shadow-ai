import { describe, expect, it } from "vitest";
import type { Message, StreamEvent } from "@/types";
import { applyEvent, fromServer, metaLine, placeholder, sourcesOf, titleFrom, touchedFiles } from "./conversation";

function play(events: StreamEvent[], start: Message = placeholder()): Message {
  return events.reduce(applyEvent, start);
}

describe("applyEvent", () => {
  it("streams tokens into the reply and settles on the final text", () => {
    const m = play([
      { type: "token", text: "Hel" },
      { type: "token", text: "lo" },
    ]);
    expect(m.content).toBe("Hello");
    expect(m.streaming).toBe(true);
    const done = applyEvent(m, { type: "done", reply: "Hello there." });
    expect(done.content).toBe("Hello there.");
    expect(done.streaming).toBe(false);
  });

  it("shows a status until the next real event replaces it", () => {
    const loading = play([{ type: "status", text: "Loading the model" }]);
    expect(loading.status).toBe("Loading the model");
    expect(applyEvent(loading, { type: "token", text: "Hi" }).status).toBeNull();
    expect(applyEvent(loading, { type: "tool_start", name: "about_me" }).status).toBeNull();
  });

  it("takes the step budget and Cool mode from the route", () => {
    const m = play([
      { type: "route", route: "coding", router: { method: "laya" }, effort: "ultra", steps: 12, cool: true },
    ]);
    expect(m.steps).toBe(12);
    expect(m.cool).toBe(true);
  });

  it("keeps the turn's timing when it finishes", () => {
    const done = applyEvent(placeholder(), {
      type: "done",
      reply: "Hi",
      timing: { first_token_ms: 2100, total_ms: 4000, steps: 1 },
    });
    expect(done.timing?.first_token_ms).toBe(2100);
  });

  it("clears the text written before a tool call", () => {
    const m = play([
      { type: "token", text: "Let me check…" },
      { type: "tool_start", name: "read_file", args: { path: "notes.txt" } },
    ]);
    expect(m.content).toBe("");
    expect(m.tools).toHaveLength(1);
  });

  it("fills in the result of the most recent unfinished call with that name", () => {
    const m = play([
      { type: "tool_start", name: "read_file", args: { path: "a.txt" } },
      { type: "tool_end", name: "read_file", result: "A" },
      { type: "tool_start", name: "read_file", args: { path: "b.txt" } },
      { type: "tool_end", name: "read_file", result: "B" },
    ]);
    const results = (m.tools ?? []).map((t) => (t.kind === "permission" ? null : t.result));
    expect(results).toEqual(["A", "B"]);
  });

  it("records a permission request and then its answer", () => {
    const m = play([
      { type: "permission", id: "p1", name: "delete_file", args: { path: "junk.txt" } },
      { type: "permission_result", id: "p1", decision: "deny" },
    ]);
    const [card] = m.tools ?? [];
    expect(card).toMatchObject({ kind: "permission", name: "delete_file", decision: "deny" });
  });

  it("keeps the skill picked for the turn when the route names none", () => {
    const m = applyEvent(placeholder("summarize"), {
      type: "route",
      route: "chat",
      router: { method: "laya", probabilities: null, ms: 0 } as never,
    });
    expect(m.skill).toBe("summarize");
  });

  it("leaves the message alone for events it doesn't render", () => {
    const m = placeholder();
    expect(applyEvent(m, { type: "usage", turn: 10, today: 20, host: "x" })).toBe(m);
  });
});

describe("touchedFiles", () => {
  it("maps both the path and the bare name to the full path", () => {
    const files = touchedFiles([{ name: "write_file", args: { path: "site/index.html" }, result: "ok" }]);
    expect(files.get("site/index.html")).toBe("site/index.html");
    expect(files.get("index.html")).toBe("site/index.html");
  });

  it("ignores tools that don't touch files and permission cards", () => {
    const files = touchedFiles([
      { name: "web_search", args: { query: "notes.txt" }, result: "" },
      { kind: "permission", id: "p", name: "delete_file", args: { path: "x.txt" }, preview: null, decision: null },
    ]);
    expect(files.size).toBe(0);
  });
});

describe("sourcesOf", () => {
  it("lists files and links from replies in first-seen order, once each", () => {
    const reply = (content: string, path?: string): Message => ({
      ...placeholder(),
      content,
      tools: path ? [{ name: "read_file", args: { path }, result: "" }] : [],
    });
    const { files, links } = sourcesOf([
      { ...placeholder(), role: "user", content: "see https://user.example" },
      reply("Read it. More at https://a.example/page.", "docs/a.md"),
      reply("Again: https://a.example/page and (https://b.example)", "docs/a.md"),
    ]);
    expect(files).toEqual(["docs/a.md"]);
    expect(links).toEqual(["https://a.example/page", "https://b.example"]);
  });

  it("copes with a chat that hasn't loaded", () => {
    expect(sourcesOf(null)).toEqual({ files: [], links: [] });
  });
});

describe("small helpers", () => {
  it("builds the meta line from what is known", () => {
    const line = metaLine({
      ...placeholder(),
      model: "Default",
      effort: "medium",
      router: { method: "laya", probabilities: { chat: 0.2, coding: 0.61 }, ms: 64 } as never,
    });
    expect(line).toBe("Default · medium effort · laya 61% · 64ms");
  });

  it("titles a chat from its first message", () => {
    expect(titleFrom("  fix   the\nbug  ")).toBe(" fix the bug ");
    expect(titleFrom("")).toBe("Image");
  });

  it("points saved images at the proxied API", () => {
    const m = fromServer({ id: "1", role: "user", content: "hi", images: ["a.png"] } as never);
    expect(m.images).toEqual(["/api/images/a.png"]);
    expect(m.streaming).toBe(false);
  });
});
