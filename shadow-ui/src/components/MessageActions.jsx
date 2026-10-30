import { useEffect, useRef, useState } from "react";
import { CopyIcon, CheckIcon, CloseIcon, RefreshIcon, ThumbUpIcon, ThumbDownIcon } from "./Icons.jsx";

/* The row under a reply: copy, run it again, and whether it was any good.

   A like or a dislike is training signal, not decoration — the brain files
   it with the whole turn. A dislike counts the moment it's clicked; the
   reason panel that follows is optional, because a reason you were forced
   to give isn't worth training on. */

const MAX_REASON = 200;

function Action({ label, onClick, disabled, active, danger, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${
        active
          ? danger
            ? "bg-danger/10 text-danger hover:bg-danger/15"
            : "bg-phosphor/10 text-phosphor hover:bg-phosphor/15"
          : "text-ink-muted hover:bg-panel-alt hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ReasonPanel({ reasons, value, onSave, onClose }) {
  const [code, setCode] = useState(value?.code ?? null);
  const [text, setText] = useState(value?.text ?? "");
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="animate-rise mt-2 max-w-md rounded-lg border border-line bg-panel p-3 shadow-[0_16px_48px_-20px_var(--shadow-color)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-ink">What was wrong with it? Optional — the dislike is already saved.</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded p-0.5 text-ink-muted transition-colors hover:text-ink"
        >
          <CloseIcon width={11} height={11} />
        </button>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {reasons.map((r) => (
          <button
            key={r.code}
            type="button"
            onClick={() => setCode(code === r.code ? null : r.code)}
            aria-pressed={code === r.code}
            className={`rounded-md border px-2 py-1 text-[11px] transition-colors duration-150 active:scale-95 ${
              code === r.code
                ? "border-signal/60 bg-signal/10 text-ink"
                : "border-line text-ink-muted hover:border-line hover:bg-panel-alt hover:text-ink"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_REASON))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(code, text);
          }
          if (e.key === "Escape") onClose();
        }}
        placeholder="Or say it in your own words"
        className="mt-2.5 w-full rounded-md border border-line bg-panel-alt px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted transition-colors focus:border-signal focus:outline-none"
      />

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="text-[11px] text-ink-muted">Kept locally in data/feedback.json.</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[11px] text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink active:scale-95"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onSave(code, text)}
            disabled={!code && !text.trim()}
            className="rounded-md border border-line bg-panel-alt px-2 py-1 text-[11px] text-ink transition-colors duration-150 hover:border-signal/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save reason
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MessageActions({ message, reasons, canRegenerate, busy, onRegenerate, onRate }) {
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState(null);
  // Shown straight away; the server call catches up. Reverted if it fails.
  const [rating, setRating] = useState(message.rating ?? null);
  const [reason, setReason] = useState({
    code: message.rating_reason_code ?? null,
    text: message.rating_reason ?? "",
  });

  useEffect(() => {
    setRating(message.rating ?? null);
    setReason({ code: message.rating_reason_code ?? null, text: message.rating_reason ?? "" });
  }, [message.rating, message.rating_reason, message.rating_reason_code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy: the browser blocked clipboard access.");
    }
  }

  async function send(next, reasonCode, reasonText) {
    const previous = rating;
    setRating(next);
    setError(null);
    try {
      await onRate({ rating: next, reasonCode: reasonCode ?? null, reason: reasonText ?? "" });
      setReason({ code: reasonCode ?? null, text: reasonText ?? "" });
    } catch (e) {
      setRating(previous);
      setError(e.message);
    }
  }

  // Clicking the same thumb again clears it.
  async function rate(next) {
    const cleared = rating === next;
    setAsking(!cleared && next === "down");
    if (cleared) setAsking(false);
    await send(cleared ? null : next, null, "");
  }

  const rated = rating !== null;

  return (
    <div>
      <div
        className={`flex flex-wrap items-center gap-1 transition-[opacity,transform] duration-150 ease-smooth group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 ${
          rated || error ? "translate-y-0 opacity-100" : "translate-y-0.5 opacity-0"
        }`}
      >
        <Action label={copied ? "Copied" : "Copy"} onClick={copy}>
          {/* Keyed, so the tick pops rather than swapping in place. */}
          {copied ? (
            <CheckIcon key="done" width={12} height={12} className="animate-pop text-phosphor" />
          ) : (
            <CopyIcon key="copy" width={12} height={12} />
          )}
          {copied ? "Copied" : "Copy"}
        </Action>

        {canRegenerate && (
          <Action label="Try again" onClick={onRegenerate} disabled={busy}>
            <RefreshIcon width={12} height={12} />
            Try again
          </Action>
        )}

        <Action label="Good reply" onClick={() => rate("up")} active={rating === "up"}>
          <ThumbUpIcon width={12} height={12} />
        </Action>

        <Action label="Bad reply" onClick={() => rate("down")} active={rating === "down"} danger>
          <ThumbDownIcon width={12} height={12} />
        </Action>

        {rating === "down" && !asking && (reason.code || reason.text) && (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="rounded-md px-1.5 py-1 text-[11px] text-ink-muted transition-colors duration-150 hover:text-ink"
          >
            {reason.text || reasons.find((r) => r.code === reason.code)?.label}
          </button>
        )}
      </div>

      {error && <div className="mt-1.5 text-[11px] text-danger">{error}</div>}

      {asking && rating === "down" && (
        <ReasonPanel
          reasons={reasons}
          value={reason}
          onClose={() => setAsking(false)}
          onSave={async (code, text) => {
            await send("down", code, text);
            setAsking(false);
          }}
        />
      )}
    </div>
  );
}
