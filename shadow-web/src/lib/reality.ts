"use client";

import { useSyncExternalStore } from "react";

export const REALITIES = ["paper", "blueprint", "night"] as const;
export type Reality = (typeof REALITIES)[number];

let current: Reality = "paper";
const subs = new Set<() => void>();

export function setReality(r: Reality) {
  current = r;
  document.getElementById("main")?.setAttribute("data-reality", r);
  subs.forEach((f) => f());
}

export function useReality(): Reality {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => current,
    () => "paper",
  );
}
