/* ──────────────────────────────────────────────────────────────────────
   DEV ONLY — delete this file, its one import in VoiceScreen.jsx, and
   the <VoiceDevBar …/> line next to it. Nothing else references it.

   It exists so the states can be seen before any audio exists. The same
   states can also be set from the address bar:
     ?voice=listening   ?voice=thinking   ?voice=speaking
     &panel=list|chart|image|none
   ────────────────────────────────────────────────────────────────────── */

const STATES = ["idle", "listening", "thinking", "speaking"];
const PANELS = ["list", "chart", "image", "none"];

export default function VoiceDevBar({ state, onState, panel, onPanel }) {
  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-30 flex flex-col gap-1.5 rounded-lg border border-dashed border-line bg-panel/90 p-2">
      <div className="px-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-muted">dev</div>
      <div className="flex gap-1">
        {STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onState(s)}
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors duration-150 ${
              state === s ? "bg-panel-alt text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {PANELS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPanel(p)}
            className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors duration-150 ${
              panel === p ? "bg-panel-alt text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
