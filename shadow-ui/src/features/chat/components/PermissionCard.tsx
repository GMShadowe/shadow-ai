import { useState } from "react";
import { useNow } from "@/hooks/useNow";
import type { Decision, PermissionRequest } from "@/types";

function formatArgs(args: Record<string, unknown> = {}) {
  return Object.entries(args)
    .map(([key, value]) => {
      let text = typeof value === "string" ? value : JSON.stringify(value);
      if (text.length > 400) text = text.slice(0, 400) + "…";
      return `${key}: ${text}`;
    })
    .join("\n");
}

// permissions.py waits this long for an answer before skipping the tool.
const TIMEOUT_MS = 300_000;

function clock(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const RESULTS: Record<Decision, { icon: string; tone: string; text: (n: string) => string }> = {
  allow: { icon: "✓", tone: "text-phosphor", text: (n) => `You allowed ${n}` },
  always: { icon: "✓", tone: "text-phosphor", text: (n) => `You always allowed ${n} (now On in Settings)` },
  deny: { icon: "✕", tone: "text-danger", text: (n) => `You denied ${n}` },
  timeout: { icon: "–", tone: "text-ink-muted", text: (n) => `No answer, so ${n} was skipped` },
};

interface PermissionCardProps {
  request: PermissionRequest;
  onAnswer?: (id: string, decision: string) => Promise<unknown>;
}

export default function PermissionCard({ request, onAnswer }: PermissionCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When this card appeared: the brain's five-minute clock started about then.
  const [shownAt] = useState(() => Date.now());
  const now = useNow(!request.decision, 1000);
  const left = TIMEOUT_MS - (now - shownAt);

  if (request.decision) {
    const r = RESULTS[request.decision] ?? RESULTS.deny;
    return (
      <div className="flex items-center gap-2 px-1 py-0.5 font-mono text-[11px] text-ink-muted">
        <span className={r.tone} aria-hidden="true">
          {r.icon}
        </span>
        <span>{r.text(request.name)}</span>
      </div>
    );
  }

  async function answer(decision: string) {
    if (!onAnswer) return;
    setBusy(true);
    setError(null);
    try {
      await onAnswer(request.id, decision);
      // The card switches to the result line when the brain confirms.
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div
      role="alertdialog"
      aria-label={`Shadow wants to use ${request.name}`}
      className="animate-rise space-y-3 rounded-2xl border border-signal/30 bg-panel p-4 shadow-[0_16px_40px_-24px_var(--shadow-color)]"
    >
      <div className="flex items-center gap-2 text-sm text-ink">
        <span className="h-2 w-2 animate-pulse rounded-full bg-signal" aria-hidden="true" />
        Shadow wants to use <span className="font-mono text-[13px]">{request.name}</span>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-muted" title="With no answer, the brain skips this tool.">
          skips in {clock(left)}
        </span>
      </div>
      {/* The same clock as a hairline that drains, linear: it is a timer. */}
      <div className="-mt-1 h-px overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div
          className="h-full origin-left bg-signal/60 transition-transform duration-1000 ease-linear"
          style={{ transform: `scaleX(${Math.max(0, left / TIMEOUT_MS)})` }}
        />
      </div>
      <pre className="max-h-40 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-xl border border-line bg-panel-alt px-2.5 py-2 font-mono text-xs text-ink-muted">
        {formatArgs(request.args) || "(no details)"}
      </pre>
      {request.preview && <p className="text-xs leading-normal text-ink">{request.preview}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !onAnswer}
          onClick={() => answer("allow")}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-bg transition-[opacity,scale] duration-150 ease-smooth enabled:active:scale-[0.96] disabled:opacity-40"
        >
          Allow
        </button>
        <button
          type="button"
          disabled={busy || !onAnswer}
          onClick={() => answer("deny")}
          className="rounded-full border border-line px-4 py-1.5 text-xs text-ink/85 transition-[border-color,color,scale] duration-150 ease-smooth enabled:hover:border-danger/50 enabled:hover:text-danger enabled:active:scale-[0.96] disabled:opacity-40"
        >
          Deny
        </button>
        <button
          type="button"
          disabled={busy || !onAnswer}
          onClick={() => answer("always")}
          className="ml-auto rounded-md px-1.5 py-1 text-xs text-ink-muted transition-[background-color,color] duration-150 enabled:hover:bg-ink/[0.06] enabled:hover:text-ink disabled:opacity-40"
        >
          Always allow
        </button>
      </div>
      {error && (
        <div role="alert" className="text-xs text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
