import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckIcon, CloseIcon, CopyIcon, RefreshIcon, ThumbDownIcon, ThumbUpIcon } from "@/components/icons";
import Tooltip from "@/components/ui/Tooltip";
import type { FeedbackReason, Message, Rating } from "@/types";

/* The row under a reply: copy, run it again, and whether it was any good.

   A like or a dislike is training signal, not decoration — the brain files
   it with the whole turn. A dislike counts the moment it's clicked; the
   reason panel that follows is optional, because a reason you were forced
   to give isn't worth training on. */

const MAX_REASON = 200;

interface ActionProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
}

function Action({ label, onClick, disabled, active, danger, children }: ActionProps) {
  return (
    <Tooltip label={label} side="bottom">
      {(describe) => (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          {...describe}
          aria-pressed={active === undefined ? undefined : active}
          className={`grid h-8 w-8 place-items-center rounded-lg transition-[background-color,color] duration-100 disabled:cursor-not-allowed disabled:opacity-40 ${
            active ? (danger ? "text-danger" : "text-ink") : "text-ink-muted enabled:hover:bg-ink/[0.07] enabled:hover:text-ink"
          }`}
        >
          {children}
        </button>
      )}
    </Tooltip>
  );
}

interface ReasonValue {
  code: string | null;
  text: string;
}

function ReasonPanel({
  reasons,
  value,
  onSave,
  onClose,
}: {
  reasons: FeedbackReason[];
  value: ReasonValue;
  onSave: (code: string | null, text: string) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState(value.code);
  const [text, setText] = useState(value.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="animate-rise mt-2 max-w-md rounded-xl border border-line bg-panel p-3 shadow-[0_16px_48px_-20px_var(--shadow-color)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-normal text-ink">What was wrong with it? Optional — the dislike is already saved.</p>
        <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded p-0.5 text-ink-muted transition-colors hover:text-ink">
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
            className={`rounded-md border px-2 py-1 text-[12px] transition-[background-color,border-color,color,scale] duration-150 active:scale-[0.96] ${
              code === r.code ? "border-signal/60 bg-signal/10 text-ink" : "border-line text-ink-muted hover:bg-ink/[0.05] hover:text-ink"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <input
        ref={inputRef}
        value={text}
        aria-label="Reason in your own words"
        onChange={(e) => setText(e.target.value.slice(0, MAX_REASON))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSave(code, text);
          }
          if (e.key === "Escape") onClose();
        }}
        placeholder="Or say it in your own words"
        className="mt-2.5 w-full rounded-md border border-line bg-panel-alt px-2.5 py-1.5 text-base text-ink transition-colors placeholder:text-ink-muted focus:border-signal focus:outline-none sm:text-xs"
      />

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <span className="text-[11px] text-ink-muted">Kept locally in data/feedback.json.</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[12px] text-ink-muted transition-[background-color,color,scale] duration-150 hover:bg-ink/[0.06] hover:text-ink active:scale-[0.96]"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => onSave(code, text)}
            disabled={!code && !text.trim()}
            className="rounded-md bg-ink px-2.5 py-1 text-[12px] text-bg transition-[opacity,scale] duration-150 enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save reason
          </button>
        </div>
      </div>
    </div>
  );
}

interface MessageActionsProps {
  message: Message;
  reasons: FeedbackReason[];
  canRegenerate: boolean;
  busy: boolean;
  onRegenerate: () => void;
  onRate: (payload: { rating: Rating; reasonCode: string | null; reason: string }) => Promise<void>;
  /** The latest reply keeps its actions showing, as desktop chat apps do. */
  pinned?: boolean;
}

export default function MessageActions({ message, reasons, canRegenerate, busy, onRegenerate, onRate, pinned = false }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown straight away; the server call catches up. Reverted if it fails.
  const [rating, setRating] = useState<Rating>(message.rating ?? null);
  const [reason, setReason] = useState<ReasonValue>({
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

  async function send(next: Rating, reasonCode: string | null, reasonText: string) {
    const previous = rating;
    setRating(next);
    setError(null);
    try {
      await onRate({ rating: next, reasonCode, reason: reasonText });
      setReason({ code: reasonCode, text: reasonText });
    } catch (e) {
      setRating(previous);
      setError((e as Error).message);
    }
  }

  // Clicking the same thumb again clears it.
  async function rate(next: "up" | "down") {
    const cleared = rating === next;
    setAsking(!cleared && next === "down");
    await send(cleared ? null : next, null, "");
  }

  const rated = rating !== null;

  return (
    <div>
      <div
        className={`-ml-1.5 flex flex-wrap items-center gap-0.5 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 ${
          pinned || rated || error ? "opacity-100" : "opacity-0"
        }`}
      >
        <Action label={copied ? "Copied" : "Copy"} onClick={copy}>
          {/* Both icons stay mounted and cross-fade, so the tick doesn't jump in. */}
          <span className="relative grid h-[18px] w-[18px] place-items-center">
            <CopyIcon
              width={12}
              height={12}
              className={`absolute transition-[opacity,scale,filter] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] ${
                copied ? "scale-25 opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0"
              }`}
            />
            <CheckIcon
              width={12}
              height={12}
              className={`absolute text-phosphor transition-[opacity,scale,filter] duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] ${
                copied ? "scale-100 opacity-100 blur-0" : "scale-25 opacity-0 blur-[4px]"
              }`}
            />
          </span>
        </Action>

        {canRegenerate && (
          <Action label="Try again" onClick={onRegenerate} disabled={busy}>
            <RefreshIcon width={18} height={18} />
          </Action>
        )}

        <Action label="Good reply" onClick={() => rate("up")} active={rating === "up"}>
          <ThumbUpIcon width={18} height={18} />
        </Action>

        <Action label="Bad reply" onClick={() => rate("down")} active={rating === "down"} danger>
          <ThumbDownIcon width={18} height={18} />
        </Action>

        {rating === "down" && !asking && (reason.code || reason.text) && (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="rounded-md px-1.5 py-1 text-[12px] text-ink-muted transition-colors duration-150 hover:text-ink"
          >
            {reason.text || reasons.find((r) => r.code === reason.code)?.label}
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="mt-1.5 text-[12px] text-danger">
          {error}
        </div>
      )}

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
