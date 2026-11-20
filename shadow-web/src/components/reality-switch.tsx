"use client";

import { useRef } from "react";
import { Globe } from "lucide-react";
import { gsap } from "gsap";
import { REALITIES, setReality, useReality } from "@/lib/reality";

export function RealitySwitch() {
  const reality = useReality();
  const busy = useRef(false);
  const i = REALITIES.indexOf(reality);

  const next = () => {
    if (busy.current) return;
    const to = REALITIES[(i + 1) % REALITIES.length];
    const scan = document.getElementById("reality-scan");
    if (!scan || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setReality(to); return; }
    busy.current = true;
    gsap.timeline({ onComplete: () => { busy.current = false; } })
      .set(scan, { xPercent: -100, autoAlpha: 1 })
      .to(scan, { xPercent: 0, duration: 0.45, ease: "expo.in" })
      .add(() => setReality(to))
      .to(scan, { xPercent: 100, duration: 0.55, ease: "expo.out" })
      .set(scan, { autoAlpha: 0 });
  };

  return (
    <button type="button" onClick={next}
      className="group flex flex-col items-center gap-1.5 font-mono text-[11px] text-ink transition-[scale] duration-150 active:scale-[.96]"
      aria-label={`Change reality. Now ${reality}, ${i + 1} of ${REALITIES.length}.`}>
      <span className="border border-ink px-2 py-0.5 transition-colors duration-150 group-hover:bg-ink group-hover:text-bg">Change reality</span>
      <span className="flex items-center gap-1.5 text-ink-faint">
        <Globe className="size-3.5 transition-transform duration-500 ease-[var(--ease-smooth)] group-hover:rotate-180" aria-hidden="true" />
        {i + 1} / {REALITIES.length} · {reality}
      </span>
    </button>
  );
}
