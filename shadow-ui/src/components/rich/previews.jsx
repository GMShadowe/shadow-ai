import { useEffect, useRef, useState } from "react";
import { getPreviews } from "../../api.js";
import { PreviewContext } from "./previews.js";

/* One request for all the links on screen, instead of one per card.

   Cards mount independently as a reply streams in, so each registers the URL
   it wants and the batch goes out on the next tick. Results are kept for the
   life of the page, and the brain caches them beyond that, so the same link
   is never fetched twice. */

export default function PreviewProvider({ children }) {
  const [cards, setCards] = useState({});
  const [queued, setQueued] = useState(0);
  const pending = useRef(new Set());
  const asked = useRef(new Set());

  function request(url) {
    if (!url || asked.current.has(url)) return;
    asked.current.add(url);
    pending.current.add(url);
    // State, not a bare setTimeout: under StrictMode the double mount's
    // cleanup cancelled the timer, and `asked` had already recorded the URL,
    // so the batch was dropped and every card sat on its spinner forever.
    setQueued((n) => n + 1);
  }

  async function flush() {
    const urls = [...pending.current];
    pending.current.clear();
    if (urls.length === 0) return;
    try {
      const { cards: fetched } = await getPreviews(urls);
      setCards((prev) => {
        const next = { ...prev };
        for (const card of fetched) next[card.url] = card;
        return next;
      });
    } catch (e) {
      // The brain itself is unreachable; every card falls back to a plain link.
      setCards((prev) => {
        const next = { ...prev };
        for (const url of urls) next[url] = { ok: false, url, reason: e.message };
        return next;
      });
    }
  }

  // Batched: a reply streaming in mounts its cards a few milliseconds apart.
  useEffect(() => {
    if (pending.current.size === 0) return undefined;
    const timer = setTimeout(flush, 80);
    return () => clearTimeout(timer);
  }, [queued]);

  return <PreviewContext.Provider value={{ cards, request }}>{children}</PreviewContext.Provider>;
}
