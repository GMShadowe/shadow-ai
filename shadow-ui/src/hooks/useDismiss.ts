import { useEffect, useRef, type RefObject } from "react";

/* Closes a popover on a click outside it or on Escape. Every menu in the app
   used to carry its own copy of these two listeners. */
export function useDismiss(ref: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void) {
  const callback = useRef(onDismiss);
  useEffect(() => {
    callback.current = onDismiss;
  });

  useEffect(() => {
    if (!active) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) callback.current();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") callback.current();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, active]);
}
