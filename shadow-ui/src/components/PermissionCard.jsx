import { useState } from "react";

function formatArgs(args) {
  return Object.entries(args || {})
    .map(([key, value]) => {
      let text = typeof value === "string" ? value : JSON.stringify(value);
      if (text.length > 400) text = text.slice(0, 400) + "…";
      return `${key}: ${text}`;
    })
    .join("\n");
}

const RESULTS = {
  allow: { icon: "✓", tone: "text-phosphor", text: (n) => `You allowed ${n}` },
  always: { icon: "✓", tone: "text-phosphor", text: (n) => `You always allowed ${n} (now On in Settings)` },
  deny: { icon: "✕", tone: "text-danger", text: (n) => `You denied ${n}` },
  timeout: { icon: "–", tone: "text-ink-muted", text: (n) => `No answer, so ${n} was skipped` },
};

export default function PermissionCard({ request, onAnswer }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (request.decision) {
    const r = RESULTS[request.decision] ?? RESULTS.deny;
    return (
      <div className="flex items-center gap-2 px-1 py-0.5 font-mono text-[11px] text-ink-muted">
        <span className={r.tone}>{r.icon}</span>
        <span>{r.text(request.name)}</span>
      </div>
    );
  }

  async function answer(decision) {
    setBusy(true);
    setError(null);
    try {
      await onAnswer(request.id, decision);
      // The card switches to the result line when the brain confirms.
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise rounded-lg border border-signal/50 bg-panel p-3 space-y-2.5">
      <div className="flex items-center gap-2 text-sm text-ink">
        <span className="h-2 w-2 rounded-full bg-signal animate-pulse" />
        Shadow wants to use <span className="font-mono text-[13px]">{request.name}</span>
      </div>
      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded-md border border-line bg-panel-alt px-2.5 py-2 font-mono text-xs text-ink-muted">
        {formatArgs(request.args) || "(no details)"}
      </pre>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !onAnswer}
          onClick={() => answer("allow")}
          className="rounded-md bg-phosphor-dim px-3 py-1.5 text-xs font-medium text-bg transition-[background-color,transform] duration-150 ease-smooth hover:bg-phosphor active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
        >
          Allow
        </button>
        <button
          type="button"
          disabled={busy || !onAnswer}
          onClick={() => answer("deny")}
          className="rounded-md border border-line px-3 py-1.5 text-xs text-ink/80 transition-[border-color,color,transform] duration-150 ease-smooth hover:border-danger/50 hover:text-danger active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100"
        >
          Deny
        </button>
        <button
          type="button"
          disabled={busy || !onAnswer}
          onClick={() => answer("always")}
          className="ml-auto rounded-md px-1.5 py-1 text-xs text-ink-muted transition-[background-color,color] duration-150 hover:bg-panel-alt hover:text-ink disabled:opacity-40"
        >
          Always allow
        </button>
      </div>
      {error && <div className="text-xs text-danger">{error}</div>}
    </div>
  );
}
