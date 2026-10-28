import { useEffect, useState } from "react";

/* Keeps a floating layer mounted for the length of its closing animation.

   React unmounts the moment a flag goes false, so without this a popover
   fades in over 200ms and then vanishes between two frames - which reads as
   a glitch rather than as the same gesture ending. */
export function useExit(open, ms = 150) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(timer);
  }, [open, ms]);

  return { mounted, leaving: mounted && !open };
}
