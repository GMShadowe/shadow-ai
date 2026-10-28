import { useEffect, useRef, useState } from "react";
import { ChevronIcon, CheckIcon } from "./Icons.jsx";

export default function ModelPicker({ models, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = models.find((m) => m.id === value);

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
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150 hover:bg-panel hover:text-ink active:scale-[0.97] ${
          open ? "bg-panel text-ink" : "text-ink/80"
        }`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-phosphor" />
        {current?.label ?? "Model"}
        <ChevronIcon className={`text-ink-muted transition-transform duration-200 ease-smooth ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="animate-pop absolute bottom-full left-0 z-20 mb-2 w-72 origin-bottom-left rounded-xl border border-line bg-panel p-1.5 shadow-2xl shadow-black/40">
          <div className="px-2.5 pb-1.5 pt-1 text-[11px] font-medium text-ink-muted">Model</div>
          {models.map((m) => {
            const selected = m.id === value;
            return (
              <button
                key={m.id}
                type="button"
                disabled={!m.available}
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className={`w-full rounded-lg px-2.5 py-2 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${
                  selected ? "bg-panel-alt" : "hover:bg-panel-alt disabled:hover:bg-transparent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{m.label}</span>
                  {selected && <CheckIcon width={14} height={14} className="text-phosphor" />}
                </div>
                <div className="mt-0.5 text-xs text-ink-muted">{m.reason ?? m.description}</div>
                <div className="mt-0.5 font-mono text-[11px] text-ink-muted/70">{m.model}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
