import { useEffect } from "react";
import { CloseIcon } from "@/components/icons";

/* The whole conversation as text, read-only, sliding in from the right.
   A floating layer, so this is the one part of the voice screen with a
   shadow. Escape closes it. */
interface Turn {
  role: string;
  text: string;
}

export default function HistoryPanel({ open, turns, onClose }: { open: boolean; turns: Turn[]; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <aside
      aria-label="Conversation history"
      aria-hidden={!open}
      className={`voice-panel glass-menu absolute bottom-2 right-2 top-2 z-20 flex w-80 max-w-[85%] flex-col rounded-2xl shadow-[0_24px_60px_-24px_var(--shadow-color)] ${
        open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"
      }`}
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
        <h2 className="flex-1 text-sm text-ink">History</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close history"
          tabIndex={open ? 0 : -1}
          className="rounded-md p-1 text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink active:scale-[0.96]"
        >
          <CloseIcon width={15} height={15} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
        {turns.length === 0 && <p className="text-xs text-ink-muted">This conversation is empty.</p>}
        {turns.map((turn, i) => (
          <div key={i} className="space-y-1">
            <div className="text-[13px] font-medium text-ink-faint ">
              {turn.role === "user" ? "you" : "shadow"}
            </div>
            <p className={`text-sm leading-relaxed ${turn.role === "user" ? "text-ink-muted" : "text-ink/90"}`}>
              {turn.text}
            </p>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-line px-4 py-2.5 text-[11px] text-ink-muted">
        Read-only. Talking carries the conversation.
      </div>
    </aside>
  );
}
