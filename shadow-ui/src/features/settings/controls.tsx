import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { formatBytes } from "./format";

export { default as Segmented } from "@/components/ui/Segmented";

export function Row({
  label,
  description,
  children,
  stacked = false,
}: {
  label: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  stacked?: boolean;
}) {
  // A row you can change something in lights up under the pointer; a row
  // that is only text stays still, so the highlight means something.
  const live = children ? "rounded-md transition-colors duration-150 hover:bg-ink/[0.025]" : "";
  return (
    <div className={`py-3.5 ${live} ${stacked ? "space-y-2.5" : "flex items-center gap-4"}`}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{label}</div>
        {description && <div className="mt-0.5 text-xs leading-normal text-ink-muted">{description}</div>}
      </div>
      {children && <div className={stacked ? "" : "shrink-0"}>{children}</div>}
    </div>
  );
}

export function GroupTitle({ children }: { children: ReactNode }) {
  return <h3 className="pb-1 pt-5 text-[13px] font-medium text-ink-faint ">{children}</h3>;
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-panel-alt px-3 py-2 text-xs leading-normal text-ink-muted">{children}</div>
  );
}

export type TriValue = "off" | "ask" | "on";

const TRI_STATES: { id: TriValue; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "ask", label: "Ask" },
  { id: "on", label: "On" },
];

export function TriState({ value, onChange }: { value: TriValue | string; onChange: (v: TriValue) => void }) {
  const index = Math.max(0, TRI_STATES.findIndex((s) => s.id === value));
  const thumb = value === "on" ? "bg-phosphor-dim" : value === "ask" ? "bg-signal/70" : "bg-line";

  return (
    <div role="radiogroup" className="relative grid w-36 grid-cols-3 rounded-full border border-line bg-panel-alt p-0.5">
      <span
        aria-hidden="true"
        className={`absolute bottom-0.5 left-0.5 top-0.5 w-[calc((100%-4px)/3)] rounded-full transition-[transform,background-color] duration-200 ease-smooth ${thumb}`}
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

export function SmallButton({
  children,
  danger = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`rounded-md border px-3 py-1.5 text-xs transition-[background-color,border-color,color,scale] duration-150 ease-smooth enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "border-danger/40 text-danger enabled:hover:bg-danger/10" : "border-line text-ink/85 enabled:hover:border-ink/25 enabled:hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 rounded-full transition-[background-color,scale] duration-200 active:scale-[0.96] ${
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
export function SavedInput({
  value,
  onSave,
  placeholder,
  mono = false,
  label = "Save",
}: {
  value: string | null | undefined;
  onSave: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  label?: string;
}) {
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
        className={`min-w-0 flex-1 rounded-md border border-line bg-panel-alt px-3 py-1.5 text-base text-ink transition-colors placeholder:text-ink-muted focus:border-signal focus:outline-none ${
          mono ? "font-mono sm:text-xs" : "sm:text-sm"
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
export function Pill({ tone = "quiet", children }: { tone?: keyof typeof PILL_TONES; children: ReactNode }) {
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[13px] font-medium text-ink-faint ${PILL_TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Bytes({ value }: { value: number | null | undefined }) {
  return <span className="font-mono text-xs tabular-nums text-ink-muted">{formatBytes(value)}</span>;
}
