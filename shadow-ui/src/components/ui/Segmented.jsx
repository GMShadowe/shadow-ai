export default function Segmented({ options, value, onChange, size = "md" }) {
  const index = options.findIndex((o) => o.id === value);
  const n = options.length;
  const pad = size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs";

  return (
    <div
      className="relative inline-grid rounded-md border border-line bg-panel-alt/60 p-0.5"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      {index >= 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 bottom-0.5 left-0.5 rounded-sm bg-panel ring-1 ring-line transition-transform duration-200 ease-smooth"
          style={{ width: `calc((100% - 4px) / ${n})`, transform: `translateX(${index * 100}%)` }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.hint}
          disabled={o.disabled}
          onClick={() => onChange(o.id)}
          className={`relative z-10 whitespace-nowrap rounded-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${pad} ${
            value === o.id ? "text-phosphor" : "text-ink-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
