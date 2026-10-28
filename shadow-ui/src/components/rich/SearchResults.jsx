/* The same data web_search already returned, as a list instead of the raw
   numbered text the tool prints. Nothing is fetched here. */

export default function SearchResults({ items, query }) {
  return (
    <div className="space-y-1.5">
      {query && (
        <div className="font-mono text-[11px] text-ink-muted">
          {items.length} result{items.length === 1 ? "" : "s"} for “{query}”
        </div>
      )}
      <ol className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="rounded-lg border border-line bg-panel/60 px-3 py-2">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm font-medium text-ink no-underline transition-colors duration-150 hover:text-signal"
            >
              {item.title || item.url}
            </a>
            <div className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">{item.url}</div>
            {item.snippet && (
              <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{item.snippet}</div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
