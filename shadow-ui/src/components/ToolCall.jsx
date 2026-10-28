import { useState } from "react";
import { CheckIcon, ChevronIcon, CloseIcon } from "./Icons.jsx";
import SearchResults from "./rich/SearchResults.jsx";
import { parseResults } from "./rich/searchParse.js";

function shorten(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  const flat = text.replace(/\s+/g, " ");
  return flat.length > 70 ? flat.slice(0, 70) + "…" : flat;
}

export default function ToolCall({ call }) {
  const [open, setOpen] = useState(false);
  const running = call.result === null || call.result === undefined;
  const failed = !running && /^(Error|Blocked|Internal error)/.test(call.result);
  // A finished row must never expand into nothing: a tool that returned
  // nothing at all says so, instead of looking like a broken result.
  const body = running || String(call.result).trim() ? call.result : "(this tool returned no output)";
  // web_search already returns titles, URLs and snippets - showing them as
  // the tool's raw numbered text wastes data that is already structured.
  const results = !running && !failed && call.name === "web_search" ? parseResults(call.result) : null;
  const args = Object.entries(call.args || {})
    .filter(([k]) => k !== "auto")
    .map(([k, v]) => `${k}: ${shorten(v)}`)
    .join("  ");

  return (
    <div
      className={`animate-rise overflow-hidden rounded-lg border bg-panel/60 transition-colors duration-150 ${
        open ? "border-line/90 bg-panel" : "border-line"
      }`}
    >
      <button
        type="button"
        onClick={() => !running && setOpen((o) => !o)}
        aria-expanded={running ? undefined : open}
        aria-disabled={running || undefined}
        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left font-mono text-xs transition-colors duration-150 ${
          running ? "cursor-default" : "hover:bg-panel-alt/60"
        }`}
      >
        <span className="flex h-3 w-3 shrink-0 items-center justify-center">
          {running ? (
            <span className="spinner" />
          ) : failed ? (
            <CloseIcon width={12} height={12} className="text-danger" />
          ) : (
            <CheckIcon width={12} height={12} className="text-phosphor" />
          )}
        </span>
        <span className="shrink-0 text-ink/90">{call.name}</span>
        <span className="min-w-0 flex-1 truncate text-ink-muted">{args}</span>
        {call.args?.auto && <span className="shrink-0 text-[10px] uppercase tracking-wider text-ink-muted">auto</span>}
        {!running && (
          <ChevronIcon className={`shrink-0 text-ink-muted transition-transform duration-200 ease-smooth ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      <div className="expander" data-open={open}>
        <div>
          {results ? (
            <div className="max-h-96 overflow-y-auto border-t border-line px-3 py-2.5">
              <SearchResults items={results} query={call.args?.query} />
            </div>
          ) : (
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words border-t border-line px-3 py-2.5 font-mono text-xs leading-relaxed text-ink-muted">
              {body}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
