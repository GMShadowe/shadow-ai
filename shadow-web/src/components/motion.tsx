"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
// Without this, slow frames stretch the reveals and content stays hidden.
gsap.ticker.lagSmoothing(0);

export function RevealOnScroll() {
  useEffect(() => {
    const mm = gsap.matchMedia();
    mm.add(
      { full: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" },
      (ctx) => {
        const reduce = ctx.conditions?.reduce;
        const items = gsap.utils.toArray<HTMLElement>("[data-reveal]");
        gsap.set(items, { autoAlpha: 0, y: reduce ? 0 : 14 });
        ScrollTrigger.batch(items, {
          start: "top 88%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.08, overwrite: true }),
        });

        gsap.utils.toArray<SVGPathElement>("[data-draw]").forEach((p) => {
          gsap.fromTo(p, { strokeDashoffset: 1 }, {
            strokeDashoffset: 0, duration: reduce ? 0 : 1.1, ease: "power2.out",
            delay: Number(p.dataset.draw) || 0,
            scrollTrigger: { trigger: p, start: "top 90%", once: true },
          });
        });

        gsap.utils.toArray<HTMLElement>("[data-wipe]").forEach((el) => {
          gsap.fromTo(el, { backgroundSize: "0% 100%" }, {
            backgroundSize: "100% 100%", duration: reduce ? 0 : 0.9, ease: "expo.inOut",
            delay: Number(el.dataset.wipe) || 0,
            scrollTrigger: { trigger: el, start: "top 92%", once: true },
          });
        });
      },
    );
    return () => mm.revert();
  }, []);
  return null;
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const icon = "absolute inset-0 m-auto size-3.5 transition-[opacity,scale,filter] duration-150 ease-[var(--ease-smooth)]";
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})}
      aria-label={copied ? "Copied" : "Copy commands"}
      className="relative grid size-7 place-items-center rounded-lg text-ink-faint transition-[color,background-color,scale] duration-150 hover:bg-accent hover:text-ink active:scale-[.96]"
    >
      <Copy className={`${icon} ${copied ? "scale-50 opacity-0 blur-[2px]" : ""}`} aria-hidden="true" />
      <Check className={`${icon} text-signal ${copied ? "" : "scale-50 opacity-0 blur-[2px]"}`} aria-hidden="true" />
      <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
    </button>
  );
}
