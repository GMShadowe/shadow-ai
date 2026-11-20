"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUp, Check, Cpu, FileText, Folder, Globe, Loader2, MessageSquare, Plus, Search, Settings, Terminal, X,
} from "lucide-react";
import { gsap } from "gsap";
import { Mark } from "@/components/brand";
import { cn } from "@/lib/utils";


type RouteName = "files" | "research" | "system";
type Step =
  | { kind: "route"; route: RouteName; pct: number }
  | { kind: "tool"; name: string; arg: string; ms: number; note?: string }
  | { kind: "reply"; text: string }
  | { kind: "ask"; name: string; cmd: string };

type Scenario = { id: string; chip: string; message: string; steps: Step[]; allow?: Step[]; always?: Step[]; deny?: Step[] };

const SCENARIOS: Scenario[] = [
  {
    id: "files", chip: "Read my notes, then commit", message: "What did I write down on Tuesday? Then commit it.",
    steps: [
      { kind: "route", route: "files", pct: 92 },
      { kind: "tool", name: "read_file", arg: "notes/2026-11-17.md", ms: 200 },
      { kind: "reply", text: "Three things: call the landlord about the heater, move the demo to Friday, and try the new piper voice. Committing needs your OK first." },
      { kind: "ask", name: "run_command", cmd: 'git commit -am "Tuesday notes"' },
    ],
    allow: [
      { kind: "tool", name: "run_command", arg: 'git commit -am "Tuesday notes"', ms: 400 },
      { kind: "reply", text: "Done. Committed as “Tuesday notes”." },
    ],
    always: [
      { kind: "tool", name: "run_command", arg: 'git commit -am "Tuesday notes"', ms: 400 },
      { kind: "reply", text: "Done. run_command is now on for this assistant, so it won’t ask again. You can switch it back in Settings → Tools." },
    ],
    deny: [{ kind: "reply", text: "Okay, nothing was committed. Your notes are unchanged." }],
  },
  {
    id: "research", chip: "Look something up", message: "What’s new in the latest Ollama release?",
    steps: [
      { kind: "route", route: "research", pct: 88 },
      { kind: "tool", name: "web_search", arg: "new in the latest Ollama release", ms: 1100, note: "your own words" },
      { kind: "reply", text: "The releases page lists the newest version first, with its notes. Here’s the link, so you can read the details rather than take my guess." },
    ],
  },
  {
    id: "system", chip: "Check my computer", message: "How much free space is on my disk?",
    steps: [
      { kind: "route", route: "system", pct: 90 },
      { kind: "tool", name: "system_info", arg: "disk", ms: 100 },
      { kind: "reply", text: "You have 212 GB free of 512 GB on your main drive." },
    ],
  },
];

const ROUTE_ICON = { files: Folder, research: Globe, system: Terminal } as const;
const TOOL_ICON: Record<string, typeof FileText> = { read_file: FileText, run_command: Terminal, web_search: Globe, system_info: Cpu };

type Item =
  | { id: number; type: "user"; text: string }
  | { id: number; type: "route"; route?: RouteName; pct?: number }
  | { id: number; type: "tool"; n: number; name: string; arg: string; ms?: number; note?: string }
  | { id: number; type: "reply"; text: string }
  | { id: number; type: "ask"; name: string; cmd: string; decision?: "allow" | "always" | "deny" };

type NewItem = Item extends infer T ? (T extends Item ? Omit<T, "id"> : never) : never;
type Log = { id: number; ev: string; detail: string };
type PartId = "route" | "tool" | "ask" | "bar";

const PART_INFO: Record<PartId, { label: string; text: string }> = {
  route: { label: "Route badge", text: "Which kind of help this was, and how sure the Laya router was. In the app, click it for every route’s score." },
  tool: { label: "Tool timeline", text: "Every tool that ran, numbered, with what it touched and how long it took." },
  ask: { label: "Permission card", text: "Risky tools wait here. It shows exactly what Allow will run, and nothing runs until you choose." },
  bar: { label: "Prompt bar", text: "Type or talk. Slash commands start your skills; the model never starts one by itself." },
};


function RouteBadge({ item }: { item: Extract<Item, { type: "route" }> }) {
  if (!item.route) {
    return (
      <span className="flex w-fit items-center gap-1.5 rounded-full border border-cream/15 px-2 py-0.5 font-mono text-[11px] text-cream/60">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> routing…
      </span>
    );
  }
  const Icon = ROUTE_ICON[item.route];
  return (
    <span className="flex w-fit items-center gap-1.5 rounded-full border border-cream/15 px-2 py-0.5 font-mono text-[11px] text-cream/75">
      <Icon className="size-3" aria-hidden="true" /> {item.route}
      <span className="ml-1 h-1 w-8 overflow-hidden rounded-full bg-cream/15">
        <span className="block h-full bg-bubble transition-[width] duration-500 ease-[var(--ease-smooth)]" style={{ width: `${item.pct}%` }} />
      </span>
      {item.pct}%
    </span>
  );
}

function ToolRow({ item }: { item: Extract<Item, { type: "tool" }> }) {
  const Icon = TOOL_ICON[item.name] ?? Terminal;
  const done = item.ms !== undefined;
  return (
    <span className="flex w-fit max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-cream/10 bg-cream/5 px-3 py-1.5 font-mono text-[11.5px] text-cream/75">
      <span className="text-cream/45">{item.n}</span>
      <Icon className="size-3.5" aria-hidden="true" />
      {item.name}
      <span className="max-w-[26ch] truncate text-cream/45">{item.arg}</span>
      {item.note && <span className="rounded-full bg-cream/10 px-1.5 text-[10px] text-cream/60">{item.note}</span>}
      {done ? (
        <>
          <span className="text-cream/45 tabular-nums">{(item.ms! / 1000).toFixed(1)}s</span>
          <Check className="size-3.5 text-ok" aria-hidden="true" />
        </>
      ) : (
        <Loader2 className="size-3.5 animate-spin text-cream/60" aria-hidden="true" />
      )}
    </span>
  );
}

function AskCard({ item, onDecide }: { item: Extract<Item, { type: "ask" }>; onDecide?: (d: "allow" | "always" | "deny") => void }) {
  const live = !item.decision && onDecide;
  const btn = "rounded-lg px-3 py-1.5 transition-[opacity,background-color,scale] duration-150 enabled:active:scale-[.96] disabled:opacity-40";
  return (
    <span className="block rounded-2xl border border-cream/10 bg-cream/5 p-4">
      <span className="flex items-center justify-between gap-2 text-[13px] font-medium">
        Shadow wants to run a command
        {live && <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-bubble opacity-70" /><span className="relative size-2 rounded-full bg-bubble" /></span>}
      </span>
      <code className="mt-2 block rounded-lg bg-black/25 px-3 py-2 font-mono text-[12px] text-cream/80">{item.cmd}</code>
      {item.decision ? (
        <span className="mt-3 flex items-center gap-1.5 font-mono text-[11px] text-cream/60">
          {item.decision === "deny" ? <X className="size-3.5" aria-hidden="true" /> : <Check className="size-3.5 text-ok" aria-hidden="true" />}
          {item.decision === "deny" ? "Denied" : item.decision === "always" ? "Always allowed" : "Allowed once"}
        </span>
      ) : (
        <span className="mt-3 flex flex-wrap gap-2 text-[12.5px] font-medium">
          <button type="button" disabled={!live} onClick={() => onDecide?.("allow")} className={cn(btn, "bg-cream text-charcoal enabled:hover:opacity-90")}>Allow once</button>
          <button type="button" disabled={!live} onClick={() => onDecide?.("always")} className={cn(btn, "border border-cream/15 enabled:hover:bg-cream/10")}>Always allow</button>
          <button type="button" disabled={!live} onClick={() => onDecide?.("deny")} className={cn(btn, "border border-cream/15 text-cream/75 enabled:hover:bg-cream/10")}>Deny</button>
        </span>
      )}
    </span>
  );
}

function PromptBar({ text, busy }: { text: string; busy: boolean }) {
  return (
    <span className="flex items-center gap-2 rounded-2xl border border-cream/10 bg-[#2f2a25] py-2 pr-2 pl-4">
      <span className={cn("min-w-0 flex-1 truncate text-[13.5px]", text ? "text-cream" : "text-cream/45")}>
        {text || "Ask anything…"}
        {text && <span className="ml-0.5 inline-block h-[1em] w-px translate-y-[2px] animate-pulse bg-cream" />}
      </span>
      <span className="hidden font-mono text-[11px] text-cream/45 sm:inline">↵ send</span>
      <span className={cn("grid size-8 place-items-center rounded-[10px] bg-bubble text-bubble-ink transition-transform duration-150", busy && "scale-90 opacity-60")}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="size-4" aria-hidden="true" />}
      </span>
    </span>
  );
}

function Hover({ id, onPick, children }: { id: PartId; onPick: (id: PartId) => void; children: ReactNode }) {
  return (
    <div data-part={id} className="pop-in relative w-fit max-w-full" onMouseEnter={() => onPick(id)}>
      {children}
      <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 size-2.5 bg-bubble" />
    </div>
  );
}


export function AppDemo() {
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inset = useRef<HTMLDivElement>(null);
  const run = useRef(0);
  const decide = useRef<((d: "allow" | "always" | "deny") => void) | null>(null);
  const nextId = useRef(0);

  const [scenario, setScenario] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [log, setLog] = useState<Log[]>([]);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [part, setPart] = useState<PartId>("bar");
  const [geo, setGeo] = useState<{ frame: number[]; lines: number[][] } | null>(null);

  const play = useCallback(async (s: Scenario) => {
    const id = () => ++nextId.current;
    const push = (it: NewItem) => {
      const full = { ...it, id: id() } as Item;
      setItems((xs) => [...xs, full]);
      return full.id;
    };
    const patch = (iid: number, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === iid ? ({ ...x, ...p } as Item) : x)));
    const emit = (ev: string, detail = "") => setLog((xs) => [...xs.slice(-9), { id: id(), ev, detail }]);

    const token = ++run.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const wait = (ms: number) => new Promise<void>((res, rej) =>
      setTimeout(() => (run.current === token ? res() : rej(new Error("stale"))), reduce ? Math.min(ms, 60) : ms));
    decide.current = null;
    setScenario(s.id);
    setItems([]);
    setLog([]);
    setTyped("");
    setBusy(false);
    setPart("bar");
    let toolN = 0;

    const doSteps = async (steps: Step[]) => {
      for (const st of steps) {
        if (st.kind === "route") {
          const rid = push({ type: "route" });
          setPart("route");
          await wait(650);
          patch(rid, { route: st.route, pct: st.pct });
          emit("route", `${st.route} · ${st.pct}%`);
          await wait(350);
        } else if (st.kind === "tool") {
          const tid = push({ type: "tool", n: ++toolN, name: st.name, arg: st.arg, note: st.note });
          setPart("tool");
          emit("tool_start", st.name);
          await wait(Math.max(500, st.ms));
          patch(tid, { ms: st.ms });
          emit("tool_end", `${st.name} · ${(st.ms / 1000).toFixed(1)}s`);
          await wait(250);
        } else if (st.kind === "reply") {
          const words = st.text.split(" ");
          const rid = push({ type: "reply", text: "" });
          for (let i = 1; i <= words.length; i++) {
            patch(rid, { text: words.slice(0, i).join(" ") });
            await wait(38);
          }
          emit("token", `×${words.length}`);
          await wait(200);
        } else if (st.kind === "ask") {
          const aid = push({ type: "ask", name: st.name, cmd: st.cmd });
          setPart("ask");
          emit("permission", st.name);
          setBusy(false);
          const d = await new Promise<"allow" | "always" | "deny">((res) => { decide.current = res; });
          if (run.current !== token) return;
          decide.current = null;
          patch(aid, { decision: d });
          emit("permission_result", d);
          setBusy(true);
          await doSteps((d === "deny" ? s.deny : d === "always" ? s.always : s.allow) ?? []);
        }
      }
    };

    try {
      for (let i = 1; i <= s.message.length; i++) {
        setTyped(s.message.slice(0, i));
        await wait(24);
      }
      await wait(250);
      setTyped("");
      setBusy(true);
      push({ type: "user", text: s.message });
      emit("POST", "/chat/stream");
      await wait(300);
      await doSteps(s.steps);
      emit("done");
      setBusy(false);
    } catch {
      /* a newer run took over */
    }
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { play(SCENARIOS[0]); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(el);
    const runs = run;
    return () => { io.disconnect(); runs.current++; };
  }, [play]);

  useEffect(() => {
    const s = scroller.current;
    if (s) s.scrollTo({ top: s.scrollHeight, behavior: "smooth" });
  }, [items]);

  const measure = useCallback(() => {
    const r = root.current, ins = inset.current;
    const all = r?.querySelectorAll<HTMLElement>(`[data-part="${part}"]`);
    const target = all && all.length ? all[all.length - 1] : null;
    if (!r || !ins || !target) { setGeo(null); return; }
    const o = r.getBoundingClientRect(), t = target.getBoundingClientRect(), n = ins.getBoundingClientRect();
    const view = scroller.current?.getBoundingClientRect();
    if (part !== "bar" && view && (t.bottom < view.top || t.top > view.bottom)) { setGeo(null); return; }
    const f = [t.left - o.left - 6, t.top - o.top - 6, t.width + 12, t.height + 12];
    setGeo({ frame: f, lines: [[f[0] + f[2], f[1], n.left - o.left, n.top - o.top], [f[0] + f[2], f[1] + f[3], n.left - o.left, n.bottom - o.top]] });
  }, [part]);

  useLayoutEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    const s = scroller.current;
    s?.addEventListener("scroll", measure, { passive: true });
    return () => { window.removeEventListener("resize", measure); s?.removeEventListener("scroll", measure); };
  }, [measure, items]);

  useEffect(() => {
    const r = root.current;
    if (!r || !geo || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lines = r.querySelectorAll(".zoom-line");
    if (lines.length) gsap.fromTo(lines, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6, ease: "expo.out", stagger: 0.05 });
    // geo changes on every scroll tick, so only replay the draw when the part changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [part]);

  const latest = <T extends Item["type"]>(t: T) => [...items].reverse().find((x) => x.type === t) as Extract<Item, { type: T }> | undefined;
  const zoomNode = (() => {
    if (part === "route") { const it = latest("route"); return it ? <RouteBadge item={it} /> : null; }
    if (part === "tool") { const it = latest("tool"); return it ? <ToolRow item={it} /> : null; }
    if (part === "ask") { const it = latest("ask"); return it ? <AskCard item={it} /> : null; }
    return <PromptBar text={typed} busy={busy} />;
  })();
  const scale = part === "route" ? 2 : part === "tool" ? 1.12 : part === "ask" ? 1 : 1.1;

  return (
    <div ref={root} className="relative">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-[11.5px] text-cream/55">Try a prompt:</span>
        {SCENARIOS.map((s) => (
          <button key={s.id} type="button" onClick={() => play(s)} aria-pressed={scenario === s.id}
            className={cn("rounded-full border px-3.5 py-1.5 text-[13px] transition-[background-color,border-color,color,scale] duration-150 active:scale-[.96]",
              scenario === s.id ? "border-bubble bg-bubble text-bubble-ink" : "border-cream/20 text-cream/80 hover:border-cream/50 hover:text-cream")}>
            {s.chip}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12">
        <div className="flex h-[620px] min-w-0 overflow-hidden rounded-3xl border border-cream/10 bg-[#292521] text-cream sm:h-[660px]">
          <div className="hidden w-14 shrink-0 flex-col items-center gap-2 border-r border-cream/10 bg-[#211e1b] py-3 sm:flex" aria-hidden="true">
            <Mark className="mb-2 size-5 text-cream" />
            {[Plus, MessageSquare, Search].map((Icon, i) => (
              <span key={i} className={cn("grid size-9 place-items-center rounded-lg text-cream/60", i === 1 && "bg-cream/10 text-cream")}>
                <Icon className="size-4" />
              </span>
            ))}
            <Settings className="mt-auto size-4 text-cream/60" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-cream/10 px-4 py-2.5">
              <span className="truncate text-[13px] font-medium">{SCENARIOS.find((s) => s.id === scenario)?.chip ?? "New chat"}</span>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-cream/10 px-2.5 py-0.5 font-mono text-[11px] text-cream/70">
                <span className="size-1.5 rounded-full bg-ok" />Plus · on this computer
              </span>
            </div>
            <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
              {items.length === 0 && (
                <p className="pt-24 text-center font-serif text-[30px] text-cream/80">Good evening.</p>
              )}
              {items.map((it) => {
                if (it.type === "user") return (
                  <div key={it.id} className="pop-in ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-bubble px-4 py-2.5 text-[14px] text-bubble-ink">{it.text}</div>
                );
                if (it.type === "route") return <Hover key={it.id} id="route" onPick={setPart}><RouteBadge item={it} /></Hover>;
                if (it.type === "tool") return <Hover key={it.id} id="tool" onPick={setPart}><ToolRow item={it} /></Hover>;
                if (it.type === "ask") return (
                  <Hover key={it.id} id="ask" onPick={setPart}>
                    <AskCard item={it} onDecide={(d) => decide.current?.(d)} />
                  </Hover>
                );
                return <p key={it.id} className="pop-in max-w-[60ch] text-[14px] leading-[1.65]">{it.text}</p>;
              })}
            </div>
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <div data-part="bar" onMouseEnter={() => setPart("bar")}><PromptBar text={typed} busy={busy} /></div>
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <div ref={inset} className="relative overflow-hidden border border-bubble bg-[#211e1b] text-cream">
            <div className="flex h-[200px] items-center justify-center overflow-hidden p-6 sm:h-[230px]">
              <div style={{ "--z": scale } as CSSProperties} className="[transform:scale(min(var(--z),1.1))] sm:[transform:scale(var(--z))]">
                {zoomNode ?? <span className="font-mono text-[11px] text-cream/50">waiting for this step…</span>}
              </div>
            </div>
            <div className="border-t border-cream/10 p-5">
              <p className="font-mono text-[11px] text-bubble">{PART_INFO[part].label}</p>
              <p className="mt-1.5 text-[14px] leading-[1.6] text-cream/75">{PART_INFO[part].text}</p>
            </div>
          </div>

          <div className="min-h-[220px] flex-1 border border-cream/15 bg-black/20 p-4 font-mono text-[11.5px]">
            <p className="mb-3 flex items-center justify-between text-cream/50">
              <span>What the brain streams</span>
              <span className="flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full", busy ? "animate-pulse bg-ok" : "bg-cream/30")} />{busy ? "live" : "idle"}</span>
            </p>
            <ol className="space-y-1.5">
              {log.map((l) => (
                <li key={l.id} className="pop-in flex gap-3">
                  <span className={cn("w-[17ch] shrink-0", l.ev.startsWith("permission") ? "text-bubble" : "text-cream/85")}>{l.ev}</span>
                  <span className="truncate text-cream/50">{l.detail}</span>
                </li>
              ))}
            </ol>
          </div>
          <p className="font-mono text-[10.5px] text-cream/45">A demo in your browser: the replies are examples, and nothing here touches your files.</p>
        </div>
      </div>

      {geo && (
        <svg className="pointer-events-none absolute inset-0 hidden h-full w-full overflow-visible lg:block" aria-hidden="true">
          <rect className="zoom-line" pathLength={1} strokeDasharray={1} x={geo.frame[0]} y={geo.frame[1]} width={geo.frame[2]} height={geo.frame[3]} fill="none" stroke="var(--bubble)" />
          {geo.lines.map((l, i) => (
            <line key={i} className="zoom-line" pathLength={1} strokeDasharray={1} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="var(--bubble)" />
          ))}
        </svg>
      )}
    </div>
  );
}
