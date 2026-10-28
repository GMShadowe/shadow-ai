import { useEffect, useRef, useState } from "react";

import { pullModel } from "../../api.js";
import { CheckIcon } from "../Icons.jsx";

/* Models are gigabytes, and settings/format.js stops at MB because it
   measures the small files Shadow keeps. "7.6 GB" beats "7782.4 MB" when
   someone is deciding whether to wait. */
function size(n) {
  if (!n) return "0 MB";
  const mb = n / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/* Downloads a list of models one at a time, reporting real progress.

   A determinate bar, not a spinner: this is a multi-gigabyte wait, and a
   spinner that turns for ten minutes reads as hung. Ollama sends no byte
   counts while it resolves the manifest, so the bar is indeterminate for
   those first moments and says which stage it is in - inventing a
   percentage there would only have to jump backwards later. */

function Bar({ fraction, indeterminate }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-panel-alt">
      {indeterminate ? (
        // No byte counts yet. A dim full-width fill says "working" without
        // claiming a position.
        <div className="h-full w-full animate-pulse bg-phosphor-dim/40" />
      ) : (
        <div
          className="h-full rounded-full bg-phosphor transition-[width] duration-200 ease-smooth"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      )}
    </div>
  );
}

export default function PullProgress({ models, onDone, onError }) {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [completed, setCompleted] = useState(null);
  const [total, setTotal] = useState(null);
  const [failed, setFailed] = useState(null);
  const started = useRef(false);

  useEffect(() => {
    // One download at a time, in order, and only ever started once: React
    // may run an effect twice in development and two pulls of the same
    // model would fight over the same progress bar.
    if (started.current) return;
    started.current = true;

    let cancelled = false;

    (async () => {
      for (let i = 0; i < models.length; i++) {
        if (cancelled) return;
        setIndex(i);
        setStatus("");
        setCompleted(null);
        setTotal(null);

        let streamError = null;
        try {
          await pullModel(models[i], (event) => {
            if (cancelled) return;
            if (event.type === "progress") {
              setStatus(event.status ?? "");
              setCompleted(event.completed ?? null);
              setTotal(event.total ?? null);
            } else if (event.type === "error") {
              // The brain reports the reason verbatim rather than ending
              // the stream silently, so pass it straight through.
              streamError = event.message;
            }
          });
        } catch (e) {
          streamError = e.message;
        }

        if (cancelled) return;
        if (streamError) {
          setFailed(streamError);
          onError?.(streamError);
          return;
        }
      }
      if (!cancelled) onDone?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [models, onDone, onError]);

  if (failed) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2.5 text-xs leading-relaxed text-ink">
          {failed}
        </div>
        <div className="text-xs text-ink-muted">
          You can also download it yourself with{" "}
          <code className="font-mono text-ink">ollama pull {models[index]}</code>, then come back.
        </div>
      </div>
    );
  }

  const fraction = completed && total ? Math.min(1, completed / total) : 0;
  const indeterminate = !(completed && total);

  return (
    <div className="space-y-4">
      {models.map((name, i) => {
        const done = i < index;
        const current = i === index;
        return (
          <div key={name} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className={`font-mono text-xs ${current || done ? "text-ink" : "text-ink-muted"}`}>
                {name}
              </span>
              {done ? (
                <span className="flex items-center gap-1 text-[11px] text-phosphor">
                  <CheckIcon width={12} height={12} />
                  Done
                </span>
              ) : current ? (
                <span className="font-mono text-[11px] text-ink-muted">
                  {completed && total
                    ? `${size(completed)} of ${size(total)}`
                    : status || "Starting…"}
                </span>
              ) : (
                <span className="text-[11px] text-ink-muted">Waiting</span>
              )}
            </div>
            {done ? (
              <div className="h-1 w-full rounded-full bg-phosphor/30" />
            ) : current ? (
              <Bar fraction={fraction} indeterminate={indeterminate} />
            ) : (
              <div className="h-1 w-full rounded-full bg-panel-alt" />
            )}
          </div>
        );
      })}
      <div className="text-xs leading-relaxed text-ink-muted">
        This runs once. The models stay on this computer and are shared by every assistant,
        so a second assistant downloads nothing.
      </div>
    </div>
  );
}
