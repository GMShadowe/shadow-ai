import { useState } from "react";
import { ImageIcon } from "../../Icons.jsx";
import { API_BASE } from "../../../api.js";
import Lightbox from "../../ui/Lightbox.jsx";
import { hostOf } from "../display.js";
import Frame from "./Frame.jsx";

/* Pictures from a search. Each thumbnail comes through the brain
   (/preview/image), never straight from the site, so looking at them
   doesn't tell anyone who is looking. A picture that won't load is dropped
   rather than left as a broken frame. */
// Rows without a gap: three pictures sit in one row, not two and a hole.
const COLUMNS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2" };

export default function ImagesCard({ panel }) {
  const [failed, setFailed] = useState(() => new Set());
  const [open, setOpen] = useState(null);
  const shown = panel.images.filter((img) => !failed.has(img.thumb));
  const src = (img) => `${API_BASE}/preview/image?u=${encodeURIComponent(img.thumb)}`;

  if (shown.length === 0) {
    return (
      <Frame icon={ImageIcon} title={panel.title}>
        <p className="px-5 py-4 text-[13px] text-ink-muted">None of these pictures could be loaded.</p>
      </Frame>
    );
  }

  return (
    <Frame icon={ImageIcon} title={panel.title} meta={`${shown.length} pictures`}>
      <div className={`grid gap-2 p-2 ${COLUMNS[shown.length] ?? "grid-cols-3"}`}>
        {shown.map((img, i) => (
          <figure key={img.thumb} className="animate-rise min-w-0" style={{ animationDelay: `${i * 60}ms` }}>
            <button
              type="button"
              onClick={() => setOpen(img)}
              className="group block aspect-[4/3] w-full overflow-hidden rounded-xl bg-panel-alt"
              aria-label={`Open ${img.title || "picture"}`}
            >
              <img
                src={src(img)}
                alt={img.title}
                loading="lazy"
                onError={() => setFailed((f) => new Set(f).add(img.thumb))}
                className="h-full w-full object-cover transition-transform duration-300 ease-smooth group-hover:scale-[1.03]"
              />
            </button>
            <figcaption className="truncate px-1 pb-1 pt-1.5 font-mono text-[11px] text-ink-muted">
              <a href={img.page} target="_blank" rel="noreferrer noopener" className="hover:text-ink hover:underline">
                {hostOf(img.page) || img.source}
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
      {open && <Lightbox src={src(open)} alt={open.title} onClose={() => setOpen(null)} />}
    </Frame>
  );
}
