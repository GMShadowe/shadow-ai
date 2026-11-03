import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowDownIcon } from "@/components/icons";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { FeedbackReason, Message as MessageT, Rating } from "@/types";
import Message from "./Message";

/* Vertical rhythm follows the conversation: a reply belongs to the question
   above it, so it sits closer to it than the next question does. */
function gapFor(previous: MessageT | undefined, message: MessageT) {
  if (!previous) return "";
  return message.role === "user" ? "mt-10" : "mt-5";
}

/* Where you are in a long chat, as a ribbon down the right of the
   conversation - a wave, after the brand's wave artwork, not a plain rail.
   Read from top to bottom:
   - the faint wave is the whole chat;
   - the part you have scrolled past is tinted, and the part on screen
     glows Blue Regatta;
   - each question you asked is a sparkle on the wave, lit while it is on
     screen, and named in a tip on hover or focus;
   - a small sparkle twinkles at "you are here".
   Clicking a sparkle jumps to that question; clicking the wave seeks there.
   Only on a wide column, and only once the chat is long enough to scroll. */
interface MapState {
  /** Scroll position, 0 to 1. */
  at: number;
  /** Share of the chat on screen, 0 to 1. */
  view: number;
  /** Each question: its message index, where it sits (0 to 1), and an excerpt. */
  marks: { index: number; pos: number; text: string }[];
}

const MAP_H = 260;
const MAP_W = 32;
// Two and a half lazy waves down the ribbon.
const waveX = (t: number) => MAP_W / 2 + 7 * Math.sin(t * Math.PI * 5);
const WAVE = Array.from({ length: 66 }, (_, i) => {
  const t = i / 65;
  return `${i ? "L" : "M"}${waveX(t).toFixed(2)} ${(t * MAP_H).toFixed(2)}`;
}).join(" ");
const SPARKLE = "M0 -6c.4 3.2 2.1 4.9 5.3 5.3v.01c-3.2.4-4.9 2.1-5.3 5.3h-.01c-.4-3.2-2.1-4.9-5.3-5.3v-.01c3.2-.4 4.9-2.1 5.3-5.3z";

function ScrollMap({
  state,
  visible,
  onJump,
  onSeek,
}: {
  state: MapState;
  visible: [number, number];
  onJump: (index: number) => void;
  onSeek: (ratio: number) => void;
}) {
  // The stretch of the chat on screen, as a share of the whole.
  const start = state.at * (1 - state.view);
  const length = state.view;
  const here = Math.min(1, start + length / 2);
  return (
    <nav
      aria-label="Jump to a question"
      className="scroll-map animate-fade absolute right-[max(8px,calc(50%-24rem-52px))] top-1/2 z-10 hidden -translate-y-1/2 @min-[56rem]:block"
      style={{ width: MAP_W, height: MAP_H }}
    >
      <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} aria-hidden="true" className="absolute inset-0 overflow-visible">
        {/* The whole chat. */}
        <path d={WAVE} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="text-ink/15" />
        {/* Read so far. */}
        <path
          d={WAVE}
          fill="none"
          pathLength={1}
          strokeDasharray={`${start} 2`}
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          className="text-signal/35 transition-[stroke-dasharray] duration-200 ease-smooth"
        />
        {/* On screen now. */}
        <path
          d={WAVE}
          fill="none"
          pathLength={1}
          strokeDasharray={`0 ${start} ${length} 2`}
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          className="text-signal transition-[stroke-dasharray] duration-200 ease-smooth"
        />
        {/* You are here. */}
        <g
          className="transition-transform duration-200 ease-smooth"
          style={{ transform: `translate(${waveX(here) + 10}px, ${here * MAP_H}px)` }}
        >
          <path d={SPARKLE} className="scroll-map-here fill-glow-b" />
        </g>
      </svg>

      {/* The wave itself seeks. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onSeek((e.clientY - r.top) / r.height);
        }}
        className="absolute inset-0 cursor-pointer"
      />

      {state.marks.map((m) => {
        const lit = m.index >= visible[0] && m.index <= visible[1];
        return (
          <button
            key={m.index}
            type="button"
            onClick={() => onJump(m.index)}
            aria-label={`Your question: ${m.text}`}
            className="group absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center"
            style={{ left: waveX(m.pos), top: m.pos * MAP_H }}
          >
            <svg
              width={18}
              height={18}
              viewBox="-7 -7 14 14"
              aria-hidden="true"
              className={`transition-[scale,rotate] duration-300 ease-smooth group-hover:scale-150 group-hover:rotate-45 ${lit ? "scale-125" : ""}`}
            >
              <path
                d={SPARKLE}
                className={`transition-[fill] duration-200 ${lit ? "fill-signal" : "fill-ink/45 group-hover:fill-ink/80"}`}
                stroke="var(--color-bg)"
                strokeWidth={1.5}
                paintOrder="stroke"
              />
            </svg>
            {/* The question, on hover or focus; it opens toward the conversation. */}
            <span className="scroll-map-tip pointer-events-none absolute right-7 top-1/2 w-max max-w-[16rem] -translate-y-1/2 truncate rounded-lg border border-line bg-menu px-2.5 py-1 text-left text-[12px] text-ink">
              {m.text}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

interface MessageListProps {
  messages: MessageT[] | null;
  /** What an empty chat shows instead of a list. */
  empty: ReactNode;
  onPermission: (id: string, decision: string) => Promise<unknown>;
  reasons: FeedbackReason[];
  busy: boolean;
  onRegenerate: () => void;
  onEdit: (text: string) => void;
  onRate: (messageId: string, payload: { rating: Rating; reasonCode: string | null; reason: string }) => Promise<void>;
  onOpenSettings: (section?: string) => void;
}

export default function MessageList({
  messages,
  empty,
  onPermission,
  reasons,
  busy,
  onRegenerate,
  onEdit,
  onRate,
  onOpenSettings,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  // Scrolled up to read: offer the way back, and say if the reply grew meanwhile.
  const [away, setAway] = useState(false);
  const [unseen, setUnseen] = useState(false);
  const [visible, setVisible] = useState<[number, number]>([0, 0]);
  const [map, setMap] = useState<MapState | null>(null);
  const reduceMotion = useReducedMotion();

  // Which messages are on screen right now, for the scroll map.
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop;
    const bottom = top + el.clientHeight;
    const items = el.querySelectorAll<HTMLElement>("[data-msg]");
    let first = -1;
    let last = -1;
    items.forEach((item, i) => {
      const a = item.offsetTop;
      const b = a + item.offsetHeight;
      if (b > top + 8 && a < bottom - 8) {
        if (first < 0) first = i;
        last = i;
      }
    });
    setVisible((v) => (v[0] === first && v[1] === last ? v : [first, last]));

    // The map only appears once there is something to scroll.
    const total = el.scrollHeight;
    if (total <= el.clientHeight * 1.2) {
      setMap(null);
      return;
    }
    const marks: MapState["marks"] = [];
    items.forEach((item, i) => {
      if (item.dataset.role !== "user") return;
      marks.push({ index: i, pos: Math.min(1, item.offsetTop / total), text: item.dataset.excerpt || "" });
    });
    setMap({ at: top / (total - el.clientHeight), view: el.clientHeight / total, marks });
  }, []);

  useEffect(() => {
    stickToBottom.current = true;
  }, [messages?.length]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
    else if (el) setUnseen(true);
    measure();
  }, [messages, measure]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setAway(!stickToBottom.current);
    if (stickToBottom.current) setUnseen(false);
    measure();
  }

  function jumpTo(index: number) {
    const el = scrollRef.current;
    const item = el?.querySelectorAll<HTMLElement>("[data-msg]")[index];
    if (!el || !item) return;
    el.scrollTo({ top: Math.max(0, item.offsetTop - 16), behavior: reduceMotion ? "auto" : "smooth" });
  }

  function seek(ratio: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: ratio * (el.scrollHeight - el.clientHeight), behavior: reduceMotion ? "auto" : "smooth" });
  }

  function toBottom() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }

  if (messages === null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {/* A chat that opens quickly shouldn't flash a loading word. */}
        <span className="shimmer wait-to-show text-sm font-medium">Loading chat</span>
      </div>
    );
  }

  if (messages.length === 0) return <>{empty}</>;

  // Only the last exchange can be re-run: anything earlier would throw away
  // the conversation that followed it.
  const reversed = [...messages].reverse();
  const lastAssistant = reversed.find((m) => m.role === "assistant" && !m.streaming);
  const lastUser = reversed.find((m) => m.role === "user");
  const tail = messages[messages.length - 1];
  const settled = !busy && (tail?.role !== "assistant" || !tail.streaming);

  return (
    <div className="@container relative flex min-h-0 flex-1 flex-col">
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      role="log"
      aria-label="Conversation"
      className="min-h-0 flex-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,#000_24px,#000_calc(100%-40px),transparent)]"
    >
      <div className="relative mx-auto max-w-[48rem] px-6 pb-8 pt-6">
        {messages.map((m, i) => (
          <div
            key={m.id ?? i}
            data-msg
            data-role={m.role}
            data-excerpt={m.role === "user" ? m.content.replace(/\s+/g, " ").slice(0, 80) : undefined}
            className={gapFor(messages[i - 1], m)}
          >
            <Message
              message={m}
              onPermission={onPermission}
              reasons={reasons}
              busy={busy}
              canRegenerate={settled && m.id === lastAssistant?.id && m.id === tail?.id}
              canEdit={settled && m.id === lastUser?.id}
              onRegenerate={onRegenerate}
              onEdit={onEdit}
              onRate={(payload) => onRate(m.id, payload)}
              onOpenSettings={onOpenSettings}
            />
          </div>
        ))}
      </div>
    </div>
      {map && <ScrollMap state={map} visible={visible} onJump={jumpTo} onSeek={seek} />}
      {away && (
        // Scrolled up: a pill brings you back down, and says so when the
        // reply kept growing while you read.
        <button
          type="button"
          onClick={toBottom}
          className={`animate-rise absolute bottom-2 left-1/2 z-10 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full border pl-2.5 pr-3 text-[12.5px] font-medium transition-[background-color,border-color,scale] duration-150 ease-smooth active:scale-[0.96] ${
            unseen ? "border-transparent bg-signal text-bubble-ink hover:opacity-90" : "border-line bg-menu text-ink hover:bg-panel"
          }`}
        >
          <ArrowDownIcon width={14} height={14} />
          {unseen ? "New reply" : "Jump to latest"}
        </button>
      )}
    </div>
  );
}
