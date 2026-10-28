import { ImageIcon } from "../../Icons.jsx";

/* When the answer is visual. The caption carries what would otherwise be
   said out loud, so the screen and the voice don't repeat each other. */
export default function ImageCard({ panel }) {
  return (
    <section className="animate-rise" aria-label={panel.title}>
      <header className="mb-3 flex items-center gap-2 px-1">
        <ImageIcon width={14} height={14} className="shrink-0 text-ink-muted" />
        <h2 className="min-w-0 truncate font-mono text-xs text-ink">{panel.title}</h2>
      </header>
      <figure className="overflow-hidden rounded-lg border border-line bg-panel">
        <img src={panel.src} alt={panel.caption ?? panel.title} className="block max-h-[46vh] w-full object-cover" />
        {panel.caption && (
          <figcaption className="border-t border-line px-4 py-2.5 text-xs text-ink-muted">{panel.caption}</figcaption>
        )}
      </figure>
    </section>
  );
}
