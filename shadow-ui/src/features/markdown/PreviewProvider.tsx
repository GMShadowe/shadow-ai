import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getPreviews } from "@/lib/api";
import { PreviewContext, type PreviewCard } from "./previewContext";

/* One request for all the links on screen, instead of one per card.

   Cards mount independently as a reply streams in, so each registers the URL
   it wants and the batch goes out on the next tick. Results are kept for the
   life of the page, and the brain caches them beyond that. */
export default function PreviewProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<Record<string, PreviewCard>>({});
  const [queued, setQueued] = useState(0);
  const pending = useRef(new Set<string>());
  const asked = useRef(new Set<string>());

  const request = useCallback((url: string) => {
    if (!url || asked.current.has(url)) return;
    asked.current.add(url);
    pending.current.add(url);
    // State, not a bare setTimeout: under StrictMode the double mount's
    // cleanup cancelled the timer and the batch was dropped.
    setQueued((n) => n + 1);
  }, []);

  // Batched: a reply streaming in mounts its cards a few milliseconds apart.
  useEffect(() => {
    if (pending.current.size === 0) return undefined;
    const timer = setTimeout(async () => {
      const urls = [...pending.current];
      pending.current.clear();
      if (urls.length === 0) return;
      try {
        const { cards: fetched } = (await getPreviews(urls)) as { cards: PreviewCard[] };
        setCards((prev) => {
          const next = { ...prev };
          for (const card of fetched) next[card.url] = card;
          return next;
        });
      } catch (e) {
        // The brain is unreachable; every card falls back to a plain link.
        setCards((prev) => {
          const next = { ...prev };
          for (const url of urls) next[url] = { ok: false, url, reason: (e as Error).message };
          return next;
        });
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [queued]);

  const value = useMemo(() => ({ cards, request }), [cards, request]);
  return <PreviewContext.Provider value={value}>{children}</PreviewContext.Provider>;
}
