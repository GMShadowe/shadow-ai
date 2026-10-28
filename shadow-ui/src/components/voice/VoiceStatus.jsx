/* Whose turn it is. Small on purpose.

   While the mic is open the three bars follow the actual input level, so
   you can see it hearing you — the quickest way to know the microphone
   works. While Shadow talks they just breathe. Accent only for those live
   states, signal for work in progress, per DESIGN.md. */

const LABELS = {
  idle: "Not listening",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

function Bars({ level }) {
  // A quiet room sits near 0.01, normal speech near 0.1.
  const live = typeof level === "number";
  const scale = live ? Math.min(1, Math.max(0.2, level * 7)) : null;
  const heights = live ? [scale, Math.min(1, scale * 1.25), scale * 0.8] : [null, null, null];

  return (
    <span
      className={`flex h-3.5 items-center gap-[3px] text-phosphor ${live ? "" : "voice-bars"}`}
      aria-hidden="true"
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className="h-full w-[3px] origin-center rounded-full bg-current transition-transform duration-150 ease-smooth"
          style={h === null ? undefined : { transform: `scaleY(${Math.max(0.15, h)})` }}
        />
      ))}
    </span>
  );
}

export default function VoiceStatus({ state, level }) {
  const label = LABELS[state] ?? LABELS.idle;
  const live = state === "listening" || state === "speaking";

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2.5 rounded-full border border-line bg-panel/70 px-3 py-1.5"
    >
      {live ? (
        <Bars level={state === "listening" ? (level ?? 0) : undefined} />
      ) : state === "thinking" ? (
        <span className="flex h-3.5 w-[15px] items-center justify-center" aria-hidden="true">
          <span className="spinner" />
        </span>
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-ink-muted" aria-hidden="true" />
      )}
      <span className={`text-xs ${state === "thinking" ? "shimmer font-medium" : live ? "text-ink" : "text-ink-muted"}`}>
        {label}
      </span>
    </div>
  );
}
