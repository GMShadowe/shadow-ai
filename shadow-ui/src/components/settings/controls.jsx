import { useEffect, useState } from "react";

import { formatBytes } from "./format.js";

export { default as Segmented } from "../ui/Segmented.jsx";

export function Row({ label, description, children, stacked = false }) {
  // A row you can change something in lights up under the pointer; a row
  // that is only text stays still, so the highlight means something.
  const live = children ? "rounded-md transition-colors duration-150 hover:bg-panel-alt/30" : "";
  return (
    <div className={`py-3.5 ${live} ${stacked ? "space-y-2.5" : "flex items-center gap-4"}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-ink">{label}</div>
        {description && <div className="text-xs text-ink-muted mt-0.5 leading-relaxed">{description}</div>}
      </div>
      {children && <div className={stacked ? "" : "shrink-0"}>{children}</div>}
    </div>
  );
}

export function GroupTitle({ children }) {
  return (
    <h3 className="font-mono text-[11px] uppercase tracking-wider text-ink-muted pt-5 pb-1">{children}</h3>
  );
}

export function Note({ children }) {
  return (
    <div className="rounded-md border border-line bg-panel-alt px-3 py-2 text-xs text-ink-muted leading-relaxed">
      {children}
    </div>
  );
}

const TRI_STATES = [
  { id: "off", label: "Off" },
  { id: "ask", label: "Ask" },
  { id: "on", label: "On" },
];

export function TriState({ value, onChange }) {
  const index = Math.max(0, TRI_STATES.findIndex((s) => s.id === value));
  const thumb = value === "on" ? "bg-phosphor-dim" : value === "ask" ? "bg-signal/70" : "bg-line";

  return (
    <div role="radiogroup" className="relative grid grid-cols-3 w-36 rounded-full border border-line bg-panel-alt p-0.5">
      <span
        aria-hidden="true"
        className={`absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-full transition-all duration-200 ${thumb}`}
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {TRI_STATES.map((s) => {
        const selected = value === s.id;
        return (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(s.id)}
            className={`relative z-10 rounded-full py-0.5 text-[11px] font-medium transition-colors duration-150 ${
              selected ? (s.id === "off" ? "text-ink" : "text-bg") : "text-ink-muted hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function SmallButton({ children, danger = false, ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-md border px-3 py-1.5 text-xs transition-[background-color,border-color,color,transform] duration-150 ease-smooth active:scale-[0.97] disabled:opacity-35 disabled:cursor-not-allowed disabled:active:scale-100 ${
        danger
          ? "border-danger/40 text-danger hover:bg-danger/10"
          : "border-line text-ink/80 hover:border-phosphor-dim hover:text-phosphor"
      }`}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-colors duration-200 active:scale-95 ${
        checked ? "bg-phosphor-dim" : "bg-line hover:bg-line/80"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink transition-transform duration-200 ease-smooth ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}


/* A text setting that is only sent when you mean it: Enter or the Save
   button, and Save stays disabled until the value actually changes. */
export function SavedInput({ value, onSave, placeholder, mono = false, label = "Save" }) {
  const [draft, setDraft] = useState(value ?? "");
  useEffect(() => setDraft(value ?? ""), [value]);
  const unchanged = draft === (value ?? "");

  return (
    <div className="flex gap-2">
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !unchanged && onSave(draft)}
        placeholder={placeholder}
        spellCheck={false}
        className={`min-w-0 flex-1 rounded-md border border-line bg-panel-alt px-3 py-1.5 text-ink placeholder:text-ink-muted transition-colors focus:border-signal focus:outline-none ${
          mono ? "font-mono text-xs" : "text-sm"
        }`}
      />
      <SmallButton onClick={() => onSave(draft)} disabled={unchanged}>
        {label}
      </SmallButton>
    </div>
  );
}

const PILL_TONES = {
  live: "border-phosphor-dim/50 text-phosphor",
  quiet: "border-line text-ink-muted",
  warn: "border-signal/40 text-signal",
  danger: "border-danger/40 text-danger",
};

/* Small state label. Used for "live"/"blocked" rather than decoration. */
export function Pill({ tone = "quiet", children }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${PILL_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Bytes({ value }) {
  return <span className="font-mono text-xs text-ink-muted">{formatBytes(value)}</span>;
}
