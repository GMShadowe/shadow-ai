import { useState } from "react";
import { CheckIcon, ChevronIcon, CloseIcon } from "@/components/icons";
import SearchResults from "@/features/display/SearchResults";
import { parseResults } from "@/features/display/searchParse";
import { seconds, useNow } from "@/hooks/useNow";
import type { ToolRun } from "@/types";

function shorten(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const flat = (text ?? "").replace(/\s+/g, " ");
  return flat.length > 70 ? flat.slice(0, 70) + "…" : flat;
}

interface ToolCallProps {
  call: ToolRun;
  /** 1-based position in this turn's timeline. */
  step: number;
}

/* One step on the reply's tool timeline: a node on the rail, the step
   number, the tool and its arguments, how long it took, and the result
   one click away. Durations are measured in the page, so a chat reopened
   later shows the steps without them rather than a made-up number. */
export default function ToolCall({ call, step }: ToolCallProps) {
  const [open, setOpen] = useState(false);
  const running = call.result === null || call.result === undefined;
  const now = useNow(running && !!call.startedAt, 100);
  const result = call.result ?? "";
  const failed = !running && /^(Error|Blocked|Internal error)/.test(result);
  // A finished row must never expand into nothing.
  const body = running || result.trim() ? result : "(this tool returned no output)";
  const results = !running && !failed && call.name === "web_search" ? parseResults(result) : null;
  const args = Object.entries(call.args || {})
    .filter(([k]) => k !== "auto")
    .map(([k, v]) => `${k}: ${shorten(v)}`)
    .join("  ");
  const took = call.startedAt ? (call.endedAt ?? (running ? now : undefined)) : undefined;
  const lines = result ? result.split("\n").length : 0;

  return (
    <li className="animate-rise relative grid grid-cols-[1.25rem_1fr] gap-x-2.5">
      {/* The node sits on the rail drawn by the list. */}
      <span className="relative z-10 mt-[9px] grid h-[18px] w-[18px] place-items-center rounded-full border border-line bg-bg">
        {running ? (
          <span className="spinner !h-2.5 !w-2.5" aria-label="Running" />
        ) : failed ? (
          <CloseIcon width={10} height={10} className="text-danger" aria-label="Failed" />
        ) : (
          <CheckIcon width={10} height={10} className="text-phosphor" aria-label="Done" />
        )}
      </span>

      <div
        className={`min-w-0 overflow-hidden rounded-xl border transition-[background-color,border-color] duration-150 ${
          open ? "border-ink/15 bg-panel" : failed ? "border-danger/30 bg-danger/[0.05]" : "border-line bg-ink/[0.025]"
        }`}
      >
        <button
          type="button"
          onClick={() => !running && setOpen((o) => !o)}
          aria-expanded={running ? undefined : open}
          aria-disabled={running || undefined}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left font-mono text-xs ${running ? "cursor-default" : "hover:bg-ink/[0.03]"}`}
        >
          <span className="shrink-0 tabular-nums text-ink-muted/70">{String(step).padStart(2, "0")}</span>
          <span className={`shrink-0 ${running ? "shimmer" : "text-ink/90"}`}>{call.name}</span>
          <span className="min-w-0 flex-1 truncate text-ink-muted">{args}</span>
          {!!call.args?.auto && <span className="shrink-0 text-[10px] uppercase tracking-[0.05em] text-ink-muted">auto</span>}
          {took !== undefined && call.startedAt && (
            <span className="shrink-0 tabular-nums text-ink-muted">{seconds(took - call.startedAt)}</span>
          )}
          {!running && (
            <ChevronIcon className={`shrink-0 text-ink-muted transition-transform duration-200 ease-smooth ${open ? "rotate-180" : ""}`} />
          )}
        </button>
        <div className="expander" data-open={open}>
          <div>
            {results ? (
              <div className="max-h-96 overflow-y-auto overscroll-contain border-t border-line px-3 py-2.5">
                <SearchResults items={results} query={typeof call.args?.query === "string" ? call.args.query : undefined} />
              </div>
            ) : (
              <>
                <pre className="max-h-72 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words border-t border-line px-3 py-2.5 font-mono text-xs leading-relaxed text-ink-muted">
                  {body}
                </pre>
                {lines > 1 && (
                  <div className="border-t border-line px-3 py-1.5 font-mono text-[10.5px] tabular-nums text-ink-muted/80">
                    {lines} lines · {result.length.toLocaleString()} chars
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
