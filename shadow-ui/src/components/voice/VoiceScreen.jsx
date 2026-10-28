import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, CloseIcon, HistoryIcon, MicIcon, StopIcon } from "../Icons.jsx";
import VoiceStatus from "./VoiceStatus.jsx";
import VoiceStage from "./VoiceStage.jsx";
import VoiceTranscript from "./VoiceTranscript.jsx";
import HistoryPanel from "./HistoryPanel.jsx";
import VoiceDevBar from "./VoiceDevBar.jsx"; // DEV ONLY — see the file header
import { EXCHANGE, PANELS } from "./placeholders.js";
import { recordUtterance } from "../../voice/recorder.js";
import { getSttStatus, transcribe } from "../../api.js";

/* Voice mode: a screen of its own, not a mode of the composer.

   One turn: tap → record → quiet for 800ms → whisper on the brain →
   text in the transcript → the same /chat/stream the chat screen uses →
   the reply arrives as text.

   "Speaking" means reply text is arriving. Nothing is spoken out loud
   yet; that is the next task, kept separate so an audio problem can only
   be in one half at a time. */

const CONTROL = {
  idle: { hint: "Tap to talk", aria: "Start listening" },
  listening: { hint: "Listening — pause when you're done", aria: "Stop listening" },
  thinking: { hint: "Working on it", aria: "Thinking" },
  speaking: { hint: "Tap to interrupt", aria: "Interrupt and listen" },
};

function initialFromUrl(name, fallback) {
  try {
    return new URLSearchParams(window.location.search).get(name) || fallback;
  } catch {
    return fallback;
  }
}

export default function VoiceScreen({ messages, streaming, onSend, onStop, onExit }) {
  // What this screen is doing, as opposed to what the brain is doing.
  const [phase, setPhase] = useState("idle"); // idle | listening | transcribing
  const [heard, setHeard] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState(null);
  const [setupHint, setSetupHint] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // `?voice=speaking&panel=list` previews a state; cleared the moment anything real happens.
  const [preview, setPreview] = useState(() => {
    const asked = initialFromUrl("voice", "");
    return CONTROL[asked] ? asked : null;
  });
  const [panelKey, setPanelKey] = useState(() => initialFromUrl("panel", "none"));
  const abortRef = useRef(null);

  // Say up front if the model isn't installed, rather than after a failed tap.
  useEffect(() => {
    let alive = true;
    getSttStatus()
      .then((s) => alive && setSetupHint(s.available ? null : s.hint))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const turns = (messages ?? []).filter((m) => m.role === "user" || m.role === "assistant");
  const lastMessage = turns[turns.length - 1];
  const replyText = lastMessage?.role === "assistant" ? lastMessage.content : "";
  const lastUser = [...turns].reverse().find((m) => m.role === "user")?.content ?? "";

  const real =
    phase === "listening" ? "listening"
    : phase === "transcribing" ? "thinking"
    : streaming ? (replyText ? "speaking" : "thinking")
    : "idle";
  const state = preview ?? real;
  const previewing = preview !== null;

  const control = CONTROL[state];
  const panel = PANELS[panelKey];
  const userLine = previewing ? EXCHANGE[state]?.user : heard || lastUser;
  const assistantLine = previewing ? EXCHANGE[state]?.assistant : replyText;

  async function listen() {
    setPreview(null);
    setError(null);
    setHeard("");
    setPhase("listening");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { wav } = await recordUtterance({ signal: controller.signal, onLevel: setLevel });
      setPhase("transcribing");
      const { text } = await transcribe(wav);
      setHeard(text);
      setPhase("idle");
      onSend(text);
    } catch (e) {
      setPhase("idle");
      // Tapping stop before saying anything isn't worth a message.
      if (!e.cancelled) setError(e.message);
    } finally {
      setLevel(0);
      abortRef.current = null;
    }
  }

  // Shadow stops the moment the user wants to talk instead.
  function interrupt() {
    onStop?.();
    listen();
  }

  function onControl() {
    if (previewing) setPreview(null);
    if (state === "idle") listen();
    else if (state === "listening") abortRef.current?.abort();
    else if (state === "speaking") interrupt();
  }

  const message = error ?? setupHint;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line/70 px-4">
        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink active:scale-95"
        >
          <ArrowLeftIcon width={15} height={15} />
          Back to chat
        </button>

        <div className="flex min-w-0 flex-1 justify-center">
          <VoiceStatus state={state} level={state === "listening" && !previewing ? level : undefined} />
        </div>

        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          title="History"
          aria-label="Show conversation history"
          aria-expanded={historyOpen}
          className={`rounded-md p-1.5 transition-colors duration-150 hover:bg-panel-alt active:scale-95 ${
            historyOpen ? "bg-panel-alt text-ink" : "text-ink-muted hover:text-ink"
          }`}
        >
          <HistoryIcon width={16} height={16} />
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <VoiceStage panel={panelKey === "none" ? null : panel} state={state} />

        {/* While Shadow is talking, anywhere on the stage stops it. */}
        {state === "speaking" && (
          <button
            type="button"
            onClick={interrupt}
            aria-label="Interrupt"
            className="absolute inset-0 z-10 cursor-pointer bg-transparent"
          />
        )}
      </div>

      <footer className="relative z-10 shrink-0 border-t border-line/70 px-6 pb-6 pt-5">
        <div className="mx-auto w-full max-w-xl space-y-5">
          <VoiceTranscript
            user={userLine}
            assistant={assistantLine}
            state={state}
            listening={state === "listening"}
          />

          {message && (
            <div className="animate-rise flex items-start gap-2.5 rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-xs leading-relaxed text-danger">
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

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={onControl}
              disabled={state === "thinking"}
              aria-label={control.aria}
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-150 ease-smooth active:scale-95 disabled:cursor-not-allowed disabled:active:scale-100 ${
                state === "idle"
                  ? "bg-phosphor-dim text-bg hover:bg-phosphor"
                  : state === "thinking"
                    ? "border border-line bg-panel text-ink-muted/60"
                    : "border border-phosphor-dim bg-panel text-ink hover:bg-panel-alt"
              }`}
            >
              {state === "idle" ? <MicIcon width={20} height={20} /> : <StopIcon width={16} height={16} />}
            </button>
            <span className="text-[11px] text-ink-muted">{control.hint}</span>
          </div>
        </div>
      </footer>

      <HistoryPanel
        open={historyOpen}
        turns={turns.map((m) => ({ role: m.role, text: m.content }))}
        onClose={() => setHistoryOpen(false)}
      />

      {/* DEV ONLY — delete this line and the import above. */}
      <VoiceDevBar state={state} onState={setPreview} panel={panelKey} onPanel={setPanelKey} />
    </div>
  );
}
