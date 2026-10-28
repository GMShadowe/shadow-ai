import { ListIcon } from "../../Icons.jsx";

/* Search results or files. Driven by plain data: a title and an optional
   subtitle per row, which is all a tool result actually gives us. */
export default function ListCard({ panel }) {
  return (
    <section className="animate-rise" aria-label={panel.title}>
      <header className="mb-3 flex items-center gap-2 px-1">
        <ListIcon width={14} height={14} className="shrink-0 text-ink-muted" />
        <h2 className="min-w-0 truncate text-sm text-ink">{panel.title}</h2>
      </header>
      <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-panel">
        {panel.items.map((item, i) => (
          <li key={`${item.title}-${i}`} className="flex items-baseline gap-3 px-4 py-3">
            <span className="w-4 shrink-0 font-mono text-[11px] text-ink-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[0.9375rem] leading-snug text-ink">{item.title}</div>
              {item.subtitle && (
                <div className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">{item.subtitle}</div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
