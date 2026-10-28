import { useEffect, useRef, useState } from "react";
import { ChevronIcon, CheckIcon } from "./Icons.jsx";
import Slider from "./ui/Slider.jsx";
import { useExit } from "./ui/useExit.js";

const EFFORTS = [
  { id: "low", label: "Low", hint: "Fastest · up to 3 steps" },
  { id: "medium", label: "Medium", hint: "Balanced · up to 6 steps" },
  { id: "high", label: "High", hint: "Thorough · up to 12 steps" },
  { id: "extra", label: "Extra", hint: "Deeper · up to 20 steps" },
  { id: "ultra", label: "Ultra", hint: "Maximum · up to 32 steps" },
];

export default function RunPicker({ models, model, onModelChange, effort, onEffortChange }) {
  const [open, setOpen] = useState(false);
  const { mounted, leaving } = useExit(open);
  const ref = useRef(null);
  const currentModel = models.find((m) => m.id === model);
  const currentEffort = EFFORTS.find((e) => e.id === effort);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150 hover:bg-panel hover:text-ink active:scale-[0.97] ${
          open ? "bg-panel text-ink" : "text-ink/80"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-phosphor" />
        {currentModel?.label ?? "Model"}
        <span className="text-ink-muted">·</span>
        <span className="text-ink-muted">{currentEffort?.label}</span>
        <ChevronIcon className={`text-ink-muted transition-transform duration-200 ease-smooth ${open ? "rotate-180" : ""}`} />
      </button>

      {mounted && (
        <div
          className={`${
            leaving ? "animate-pop-out pointer-events-none" : "animate-pop"
          } absolute bottom-full left-0 z-30 mb-2 w-80 origin-bottom-left rounded-xl border border-line bg-panel p-2 shadow-2xl shadow-black/40`}
        >
          <div className="px-2 pb-1.5 pt-1 text-[11px] font-medium text-ink-muted">Model</div>
          <div className="space-y-0.5">
            {models.map((m) => {
              const selected = m.id === model;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={!m.available}
                  onClick={() => onModelChange(m.id)}
                  className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected ? "bg-panel-alt" : "hover:bg-panel-alt disabled:hover:bg-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-ink">{m.label}</span>
                      {m.sends_data && (
                        <span className="shrink-0 rounded border border-danger/40 px-1 py-px font-mono text-[9px] uppercase tracking-wider text-danger">
                          sends out
                        </span>
                      )}
                    </span>
                    {selected && <CheckIcon width={14} height={14} className="shrink-0 text-phosphor" />}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-muted">{m.reason ?? m.description}</div>
                </button>
              );
            })}
          </div>

          <div className="my-2 border-t border-line" />

          <div className="px-2 pb-2 pt-1 text-[11px] font-medium text-ink-muted">Effort</div>
          <div className="px-2 pb-2">
            <Slider options={EFFORTS} value={effort} onChange={onEffortChange} />
          </div>
        </div>
      )}
    </div>
  );
}
