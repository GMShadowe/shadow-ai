import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, CloseIcon, HistoryIcon, MicIcon, StopIcon } from "../Icons.jsx";
import VoiceStatus from "./VoiceStatus.jsx";
import VoiceTranscript from "./VoiceTranscript.jsx";
import HistoryPanel from "./HistoryPanel.jsx";
import DisplayCard from "../rich/cards/DisplayCard.jsx";
import { stagePanel } from "../rich/display.js";
import { recordUtterance } from "../../voice/recorder.js";
import { getSttStatus, transcribe } from "../../api.js";

/* Voice mode: a screen of its own, not a mode of the composer.

   One turn: tap (or space) → record → quiet for 800ms → whisper on the
   brain → the same /chat/stream the chat screen uses, marked as a voice
   turn so the reply comes back short and spoken-style → the reply arrives
   as text.

   The middle of the screen is for what is worth looking at: a list, a
   chart or pictures Shadow put up, drawn from the tool call's data. When a
   reply has none, the exchange itself takes the middle, large.

   "Speaking" means reply text is arriving. Nothing is spoken out loud
   yet; that is the next task, kept separate so an audio problem can only
   be in one half at a time. */

const HINT = {
  idle: "Tap or press space to talk",
  listening: "Listening. Pause when you're done.",
  thinking: "Working on it. Tap to stop.",
  transcribing: "Writing down what you said",
  speaking: "Tap to interrupt",
};

const SUGGESTIONS = [
  "Make a list of the biggest tech companies and what they do",
  "Chart India's GDP growth over the last five years",
  "Show me pictures of the Taj Mahal",
];

function Orb({ state, level, disabled, onClick }) {
  const listening = state === "listening";
  const ring = listening ? { transform: `scale(${1 + Math.min(level * 7, 0.55)})` } : undefined;
  const face =
    state === "idle"
      ? "bg-ink text-bg shadow-[0_10px_30px_-12px_var(--shadow-color)] hover:scale-[1.04]"
      : listening
        ? "bg-phosphor text-bg"
        : "border border-line bg-panel text-ink hover:bg-panel-alt";

  return (
    <div className="relative grid h-28 w-28 place-items-center">
      <span
        aria-hidden
        className={`absolute inset-3 rounded-full bg-phosphor/15 transition-[transform,opacity] duration-150 ease-smooth ${
          state === "speaking" ? "voice-breathe" : ""
        } ${state === "idle" || state === "thinking" ? "opacity-0" : "opacity-100"}`}
        style={ring}
      />
      {state === "thinking" && <span aria-hidden className="voice-orbit absolute inset-3 rounded-full" />}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={HINT[state]}
        className={`relative grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full transition-[transform,background-color,color] duration-200 ease-smooth active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 ${face}`}
      >
        {state === "idle" || state === "transcribing" ? (
          <MicIcon width={24} height={24} />
        ) : (
          <StopIcon width={18} height={18} />
        )}
      </button>
    </div>
  );
}

function Welcome({ onPick }) {
  return (
    <div className="animate-rise text-center">
      <h2 className="text-[clamp(1.75rem,3.2vw,2.4rem)] font-medium leading-[1.1] tracking-[-0.035em] text-ink">
        Talk to Shadow
      </h2>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-muted">
        Ask out loud. Lists, charts and pictures show up here when you ask for them.
      </p>
      <div className="mt-7 flex flex-col items-center gap-2">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="animate-rise rounded-xl border border-line bg-panel px-4 py-2.5 text-[13.5px] text-ink/80 transition-[color,border-color,transform] duration-150 ease-smooth hover:border-ink-muted/40 hover:text-ink active:scale-[0.98]"
            style={{ animationDelay: `${120 + i * 60}ms` }}
          >
            “{s}”
          </button>
        ))}
      </div>
    </div>
  );
}

export default function VoiceScreen({ messages, streaming, onSend, onStop, onExit }) {
  // What this screen is doing, as opposed to what the brain is doing.
  const [phase, setPhase] = useState("idle"); // idle | listening | transcribing
  const [heard, setHeard] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState(null);
  const [setupHint, setSetupHint] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const abortRef = useRef(null);

  // Say up front if the model isn't installed, rather than after a failed tap.
  useEffect(() => {
    let alive = true;
    getSttStatus()
      .then((s) => alive && setSetupHint(s.available ? null : s.hint))
      .catch((e) => console.warn("[voice] couldn't check speech to text:", e.message));
    return () => {
      alive = false;
    };
  }, []);

  const turns = (messages ?? []).filter((m) => m.role === "user" || m.role === "assistant");
  const lastMessage = turns[turns.length - 1];
  const lastReply = lastMessage?.role === "assistant" ? lastMessage : null;
  const replyText = lastReply?.content ?? "";
  const lastUser = [...turns].reverse().find((m) => m.role === "user")?.content ?? "";

  const state =
    phase === "listening" ? "listening"
    : phase === "transcribing" ? "transcribing"
    : streaming ? (replyText ? "speaking" : "thinking")
    : "idle";
  const status = state === "transcribing" ? "thinking" : state;

  const panel = state === "listening" || state === "transcribing" ? null : stagePanel(lastReply);
  const userLine = state === "listening" || state === "transcribing" ? heard : heard || lastUser;
  const assistantLine = state === "listening" || state === "transcribing" ? "" : replyText;

  const send = useCallback(
    (text) => {
      setHeard(text);
      onSend(text);
    },
    [onSend]
  );

  const listen = useCallback(async () => {
    setError(null);
    setHeard("");
    setPhase("listening");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { wav } = await recordUtterance({ signal: controller.signal, onLevel: setLevel });
      setPhase("transcribing");
      const { text } = await transcribe(wav);
      setPhase("idle");
      send(text);
    } catch (e) {
      setPhase("idle");
      // Tapping stop before saying anything isn't worth a message.
      if (!e.cancelled) setError(e.message);
    } finally {
      setLevel(0);
      abortRef.current = null;
    }
  }, [send]);

  const onControl = useCallback(() => {
    if (state === "idle") listen();
    else if (state === "listening") abortRef.current?.abort();
    else if (state === "speaking") {
      // Shadow stops the moment the user wants to talk instead.
      onStop?.();
      listen();
    } else if (state === "thinking") onStop?.();
  }, [state, listen, onStop]);

  // Space talks, like a walkie-talkie button, unless something else that
  // takes keys has focus.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== "Space" || e.repeat) return;
      if (e.target.closest?.("input, textarea, button, a, [contenteditable]")) return;
      e.preventDefault();
      onControl();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onControl]);

  const message = error ?? setupHint;
  const fresh = turns.length === 0 && state === "idle" && !heard;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 px-4">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink active:scale-95"
        >
          <ArrowLeftIcon width={15} height={15} />
          Back to chat
        </button>
        <div className="flex min-w-0 flex-1 justify-center">
          <VoiceStatus state={status} level={state === "listening" ? level : undefined} />
        </div>
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          title="History"
          aria-label="Show conversation history"
          aria-expanded={historyOpen}
          className={`rounded-lg p-2 transition-colors duration-150 hover:bg-panel-alt active:scale-95 ${
            historyOpen ? "bg-panel-alt text-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          <HistoryIcon width={16} height={16} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,#000_24px,#000_calc(100%-24px),transparent)]">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center px-6 py-8">
          {panel ? (
            <div key={lastReply?.id ?? "panel"}>
              <DisplayCard panel={panel} />
            </div>
          ) : fresh ? (
            <Welcome onPick={send} />
          ) : (
            <VoiceTranscript size="large" user={userLine} assistant={assistantLine} state={state} />
          )}
        </div>
      </div>

      <footer className="relative z-10 shrink-0 px-6 pb-6 pt-2">
        <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3">
          {panel && <VoiceTranscript size="small" user={userLine} assistant={assistantLine} state={state} />}

          {message && (
            <div className="animate-rise flex w-full items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/5 px-3.5 py-2.5 text-[13px] leading-relaxed text-danger">
              <span className="flex-1">{message}</span>
              {error && (
                <button
                  type="button"
                  onClick={() => setError(null)}
                  aria-label="Dismiss"
                  className="shrink-0 rounded p-0.5 transition-colors hover:text-ink"
                >
                  <CloseIcon width={12} height={12} />
                </button>
              )}
            </div>
          )}

          <Orb state={state} level={level} disabled={state === "transcribing" || !!setupHint} onClick={onControl} />
          <span className="-mt-1 text-[12px] text-ink-muted">{HINT[state]}</span>
        </div>
      </footer>

      <HistoryPanel
        open={historyOpen}
        turns={turns.map((m) => ({ role: m.role, text: m.content }))}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
