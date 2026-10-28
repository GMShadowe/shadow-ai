export default function Slider({ options, value, onChange }) {
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  const n = options.length;
  const pct = n > 1 ? (index / (n - 1)) * 100 : 0;
  const current = options[index];

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink">{current?.label}</span>
        <span className="text-[11px] text-ink-muted">{current?.hint}</span>
      </div>

      <div className="relative h-6">
        <input
          type="range"
          min={0}
          max={n - 1}
          step={1}
          value={index}
          onChange={(e) => onChange(options[Number(e.target.value)].id)}
          aria-label="Effort level"
          className="peer absolute inset-0 z-20 w-full cursor-pointer opacity-0"
        />
        {/* track */}
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
        {/* fill */}
        <div
          className="pointer-events-none absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-phosphor-dim transition-all duration-200 ease-smooth"
          style={{ width: `${pct}%` }}
        />
        {/* ticks */}
        {options.map((o, i) => (
          <span
            key={o.id}
            className={`pointer-events-none absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-200 ${
              i <= index ? "bg-phosphor" : "bg-ink-muted/40"
            }`}
            style={{ left: `${(i / (n - 1)) * 100}%` }}
          />
        ))}
        {/* thumb */}
        <span
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink shadow ring-2 ring-bg transition-all duration-200 ease-smooth peer-focus-visible:ring-signal"
          style={{ left: `${pct}%` }}
        />
      </div>

      <div className="flex justify-between px-0.5">
        {options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`text-[10px] transition-colors duration-150 ${
              i === index ? "font-medium text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
