"use client";

import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

export function useFrameloop(ref: RefObject<HTMLElement | null>): "always" | "demand" | "never" {
  const [visible, setVisible] = useState(false);
  const reduce = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  if (reduce) return "demand";
  return visible ? "always" : "never";
}
