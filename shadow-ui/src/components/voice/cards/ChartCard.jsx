import { ChartIcon } from "../../Icons.jsx";

/* A numeric answer, drawn as bars. Horizontal, because the labels are
   words ("4b", "Tuesday") and they stay readable without turning them
   sideways. Bars are ink, not accent: the accent belongs to live status.

   Takes plain points — [{ label, value }] — so a tool result can be
   turned into one without the model describing a chart. */
export default function ChartCard({ panel }) {
  const points = panel.points ?? [];
  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <section className="animate-rise" aria-label={panel.title}>
      <header className="mb-3 flex items-center gap-2 px-1">
        <ChartIcon width={14} height={14} className="shrink-0 text-ink-muted" />
        <h2 className="min-w-0 truncate text-sm text-ink">{panel.title}</h2>
        {panel.unit && <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-muted">{panel.unit}</span>}
      </header>

      <div className="space-y-2.5 rounded-lg border border-line bg-panel px-4 py-4">
        {points.map((p) => (
          <div key={p.label} className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-right font-mono text-[11px] text-ink-muted">{p.label}</span>
            <div className="h-5 min-w-0 flex-1 overflow-hidden rounded-sm bg-panel-alt">
              <div
                className="h-full rounded-sm bg-ink-muted/55 transition-[width] duration-200 ease-smooth"
                style={{ width: `${Math.max((p.value / max) * 100, 2)}%` }}
              />
            </div>
            <span className="w-10 shrink-0 font-mono text-xs text-ink/90">{p.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
