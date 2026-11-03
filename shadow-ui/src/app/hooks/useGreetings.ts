import { useCallback, useEffect, useRef, useState } from "react";
import { getGreetings } from "@/lib/api";

const FALLBACK = ["What's on your mind?", "Where should we start?", "What are we building today?"];

/* Personal greetings from the brain (built from this assistant's memory),
   fetched once per assistant. The empty chat cycles through them. */
export function useGreetings(connected: boolean) {
  const [greetings, setGreetings] = useState<string[]>(FALLBACK);
  const loaded = useRef(false);

  const load = useCallback(() => {
    return getGreetings()
      .then((r) => {
        if (r.greetings?.length) setGreetings(r.greetings);
      })
      .catch((e) => {
        loaded.current = false; // let it retry
        console.warn("[greetings] couldn't load, using the defaults:", (e as Error).message);
      });
  }, []);

  useEffect(() => {
    if (!connected || loaded.current) return;
    loaded.current = true;
    load();
  }, [connected, load]);

  return { greetings, reloadGreetings: load };
}
