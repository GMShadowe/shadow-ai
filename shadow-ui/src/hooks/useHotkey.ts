import { useEffect, useRef } from "react";

/* ⌘/Ctrl + key, anywhere in the app. Handlers can change every render
   without re-binding the listener. */
export function useHotkey(key: string, handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === key) {
        e.preventDefault();
        ref.current(e);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [key]);
}
