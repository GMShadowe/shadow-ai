import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ChevronIcon, EyeIcon, OutboundIcon, SparkleIcon } from "@/components/icons";
import type { Option } from "@/components/ui/Segmented";
import { useDismiss } from "@/hooks/useDismiss";
import { useExit } from "@/hooks/useExit";
import type { ModelInfo } from "@/types";

export const EFFORTS: readonly (Option<string> & { steps: number; mood: string })[] = [
  { id: "low", label: "Low", hint: "Fastest", steps: 3, mood: "Quick look" },
  { id: "medium", label: "Medium", hint: "Balanced", steps: 6, mood: "Balanced" },
  { id: "high", label: "High", hint: "Thorough", steps: 12, mood: "Rolls up its sleeves" },
  { id: "extra", label: "Extra", hint: "Deeper", steps: 20, mood: "Digs deep" },
  { id: "ultra", label: "Ultra", hint: "Maximum", steps: 32, mood: "Leaves no stone unturned" },
];

/* The Ultra celebration: a shockwave ring and fourteen sparkles thrown out
   of the dial's thumb, drawn in a layer on <body> so the menu's edge doesn't
   clip them. Plain DOM on purpose: it is decoration that removes itself
   after a second. */
const SPARKLE_PATH =
  "M12 2.5c.6 4.6 2.9 6.9 7.5 7.5v.01c-4.6.6-6.9 2.9-7.5 7.5h-.01c-.6-4.6-2.9-6.9-7.5-7.5V10c4.6-.6 6.9-2.9 7.5-7.5z";

function ultraBurst(from: HTMLElement) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = from.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.style.cssText = `position:fixed;left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;z-index:100;pointer-events:none`;
  let html = '<span class="ultra-ring"></span><span class="ultra-ring" style="animation-delay:120ms"></span>';
  for (let i = 0; i < 14; i++) {
    const angle = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
    const far = [58, 84, 70, 96][i % 4];
    const size = [16, 10, 13, 8][i % 4];
    const tone = i % 3 === 0 ? "var(--color-glow-b)" : "var(--color-signal)";
    html +=
      `<svg class="ultra-spark" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
      `style="position:absolute;left:0;top:0;color:${tone};--dx:${(Math.cos(angle) * far).toFixed(1)}px;--dy:${(Math.sin(angle) * far).toFixed(1)}px;animation-delay:${(i % 5) * 22}ms">` +
      `<path d="${SPARKLE_PATH}" transform="translate(0 2)" fill="currentColor"/></svg>`;
  }
  layer.innerHTML = html;
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1200);
}

/* Effort as a dial: five notches on a track, and a Blue Regatta thumb that
   slides between them. The track fills up to the thumb, and the caption
   says what that level buys. A radio group: arrows move, Home/End jump. */
function EffortDial({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const index = Math.max(0, EFFORTS.findIndex((e) => e.id === value));
  const current = EFFORTS[index];
  const pct = (index / (EFFORTS.length - 1)) * 100;
  const ultra = current.id === "ultra";

  // Arriving at Ultra (not opening the menu already on it) sets off a burst.
  const [jolt, setJolt] = useState(false);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  useEffect(() => {
    if (value === "ultra" && previous.current !== "ultra") {
      setJolt(true);
      // Once the thumb has slid most of the way there.
      setTimeout(() => thumbRef.current && ultraBurst(thumbRef.current), 220);
    }
    previous.current = value;
  }, [value]);
  useEffect(() => {
    if (!jolt) return;
    const t = setTimeout(() => setJolt(false), 420);
    return () => clearTimeout(t);
  }, [jolt]);

  function onKey(e: KeyboardEvent) {
    let next = index;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = Math.min(EFFORTS.length - 1, index + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = Math.max(0, index - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = EFFORTS.length - 1;
    else return;
    e.preventDefault();
    onChange(EFFORTS[next].id);
    (e.currentTarget.querySelector(`[data-effort="${EFFORTS[next].id}"]`) as HTMLElement | null)?.focus();
  }

  return (
    <div className={jolt ? "ultra-jolt" : undefined}>
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-[13.5px] font-medium text-ink">
          {ultra ? <span className="ultra-text">{current.label}</span> : current.label}
          <span className="ml-1.5 font-normal text-ink-faint">· {current.mood}</span>
        </span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink-faint">≤ {current.steps} steps</span>
      </div>

      {/* Everything on the dial sits at the same x: 14px in from each end, then evenly spaced. */}
      <div role="radiogroup" aria-label="Effort" onKeyDown={onKey} className="relative h-[52px]">
        <div className="absolute inset-x-[14px] top-[9px] h-1.5 rounded-full bg-ink/10" aria-hidden="true">
          <div className={`h-full rounded-full transition-[width] duration-300 ease-smooth ${ultra ? "ultra-track" : "bg-signal/45"}`} style={{ width: `${pct}%` }} />
        </div>
        {EFFORTS.map((e, i) => {
          const chosen = i === index;
          const at = `calc(14px + (100% - 28px) * ${i / (EFFORTS.length - 1)})`;
          return (
            <button
              key={e.id}
              type="button"
              role="radio"
              data-effort={e.id}
              aria-checked={chosen}
              aria-label={`${e.label}, up to ${e.steps} steps`}
              tabIndex={chosen ? 0 : -1}
              onClick={() => onChange(e.id)}
              style={{ left: at }}
              className="group absolute top-0 flex -translate-x-1/2 flex-col items-center gap-2 rounded-md px-1"
            >
              <span className="grid h-6 w-6 place-items-center">
                <span
                  className={`h-2 w-2 rounded-full transition-[background-color,scale] duration-150 ${
                    i <= index ? "bg-transparent" : "bg-ink/25 group-hover:scale-125 group-hover:bg-ink/50"
                  }`}
                />
              </span>
              <span className={`text-[11.5px] transition-colors duration-150 ${chosen ? "font-medium text-ink" : "text-ink-faint group-hover:text-ink-muted"}`}>
                {e.label}
              </span>
            </button>
          );
        })}
        {/* The thumb: one element that slides, so a change reads as motion, not a swap. */}
        <span
          ref={thumbRef}
          aria-hidden="true"
          className={`pointer-events-none absolute top-px grid h-[22px] w-[22px] -translate-x-1/2 place-items-center rounded-full bg-signal text-bubble-ink shadow-[0_0_0_3px_var(--color-menu)] transition-[left,scale] duration-300 ease-smooth ${
            ultra ? "ultra-thumb scale-[1.18]" : ""
          }`}
          style={{ left: `calc(14px + (100% - 28px) * ${pct / 100})` }}
        >
          <SparkleIcon width={12} height={12} className={ultra ? "ultra-spin" : undefined} />
        </span>
      </div>
    </div>
  );
}

interface RunPickerProps {
  models: ModelInfo[];
  model: string | null;
  onModelChange: (id: string) => void;
  effort: string;
  onEffortChange: (id: string) => void;
}

/* Model and effort in one quiet button: what runs, and how hard it tries.
   The menu grows out of the button - upward when there is room above it,
   downward when there isn't (the empty chat's prompt bar sits mid-screen) -
   and never taller than the space it has. */
export default function RunPicker({ models, model, onModelChange, effort, onEffortChange }: RunPickerProps) {
  const [open, setOpen] = useState(false);
  const { mounted, leaving } = useExit(open);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState<{ up: boolean; max: number }>({ up: true, max: 480 });
  useDismiss(ref, open, () => setOpen(false));

  // Decide where it opens before it paints, from the room around the button.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--zoom")) || 1;
    const above = rect.top / zoom - 16;
    const below = (window.innerHeight - rect.bottom) / zoom - 16;
    const up = above >= 380 || above >= below;
    setPlace({ up, max: Math.max(220, Math.floor(up ? above : below)) });
  }, [open]);

  const currentModel = models.find((m) => m.id === model);
  const currentEffort = EFFORTS.find((e) => e.id === effort);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] transition-[background-color,color,scale] duration-150 ease-smooth active:scale-[0.96] ${
          open ? "bg-ink/[0.08] text-ink" : "text-ink hover:bg-ink/[0.06]"
        }`}
      >
        <span className="max-w-[9rem] truncate font-medium">{currentModel?.label ?? "Model"}</span>
        {effort === "ultra" ? (
          <span className="hidden items-center gap-1 sm:flex">
            <span className="ultra-text font-medium">Ultra</span>
            <SparkleIcon width={10} height={10} className="ultra-twinkle text-signal" />
          </span>
        ) : (
          <span className="hidden text-ink-muted sm:inline">{currentEffort?.label}</span>
        )}
        <ChevronIcon
          width={13}
          height={13}
          className={`text-ink-muted transition-transform duration-200 ease-smooth ${open !== place.up ? "rotate-180" : ""}`}
        />
      </button>

      {mounted && (
        <div
          role="dialog"
          aria-label="Model and effort"
          style={{ maxHeight: place.max }}
          className={`${leaving ? "animate-pop-out pointer-events-none" : "animate-pop"} glass-menu absolute right-0 z-30 flex w-[21rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl ${
            place.up ? "bottom-full mb-2 origin-bottom-right" : "top-full mt-2 origin-top-right"
          }`}
        >
          <div className="min-h-0 overflow-y-auto overscroll-contain p-1.5">
            <div className="px-2.5 pb-1.5 pt-1.5 text-[12.5px] font-medium text-ink-faint">Who answers</div>
            <div role="radiogroup" aria-label="Model" className="space-y-0.5">
              {models.map((m) => {
                const selected = m.id === model;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!m.available}
                    onClick={() => onModelChange(m.id)}
                    title={m.reason ?? m.description}
                    className={`group flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-[background-color] duration-150 disabled:cursor-not-allowed ${
                      selected ? "bg-signal/[0.12]" : "enabled:hover:bg-ink/[0.05]"
                    }`}
                  >
                    {/* A radio that turns into the brand sparkle when chosen. */}
                    <span
                      className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition-[background-color,border-color] duration-200 ${
                        selected ? "border-signal bg-signal text-bubble-ink" : "border-ink/25 group-enabled:group-hover:border-ink/50"
                      }`}
                    >
                      {selected && <SparkleIcon width={11} height={11} className="animate-pop" />}
                    </span>
                    <span className={`min-w-0 flex-1 ${m.available ? "" : "opacity-50"}`}>
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-medium text-ink">{m.label}</span>
                        {m.vision && <EyeIcon width={13} height={13} className="shrink-0 text-ink-faint" aria-label="Sees images" />}
                        <span className="ml-auto shrink-0">
                          {m.sends_data ? (
                            <span className="flex items-center gap-1 font-mono text-[10.5px] text-danger">
                              <OutboundIcon width={10} height={10} /> {m.host || "remote"}
                            </span>
                          ) : (
                            <span className="font-mono text-[10.5px] text-ink-faint">{m.model ?? "local"}</span>
                          )}
                        </span>
                      </span>
                      {/* The longer story only for the one that's chosen, or one that can't be. */}
                      {(selected || !m.available) && (
                        <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">{m.reason ?? m.description}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mx-2.5 my-2 h-px bg-line" />

            <div className="px-2.5 pb-1.5 pt-1 text-[12.5px] font-medium text-ink-faint">How hard it tries</div>
            <div className="px-2.5 pb-2.5">
              <EffortDial value={effort} onChange={onEffortChange} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
