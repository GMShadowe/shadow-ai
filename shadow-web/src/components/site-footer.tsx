"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { Mark } from "@/components/brand";
import { LocalTime } from "@/components/local-time";
import { UfoCraft } from "@/components/ufo-craft";

gsap.registerPlugin(useGSAP);


const REPO = "https://github.com/GMShadowe/shadow-ai";
const WORD = "shadow".split("");

function Row({ n, href, title, children, onClick }: { n: number; href?: string; title: string; children: ReactNode; onClick?: () => void }) {
  const inner = (
    <>
      <span className="flex items-baseline gap-3">
        <span className="font-mono text-[12px] font-normal tracking-normal text-ink-faint transition-colors duration-150 group-hover:text-signal">({n})</span>
        <span className="transition-transform duration-300 ease-[var(--ease-smooth)] group-hover:translate-x-2">{title}</span>
      </span>
      <span className="font-mono text-[11.5px] font-normal tracking-normal text-ink-muted sm:text-right">{children}</span>
    </>
  );
  const cls = "group grid gap-1 border-b border-bubble/40 py-3.5 text-[30px] leading-none font-extrabold tracking-[-0.035em] transition-colors duration-150 hover:border-signal sm:grid-cols-[1fr_auto] sm:items-end sm:text-[44px] lg:text-[52px]";
  if (onClick) return <li><button type="button" onClick={onClick} className={`${cls} w-full text-left`}>{inner}</button></li>;
  return <li><a href={href} className={cls}>{inner}</a></li>;
}

function Eyes() {
  return (
    <div aria-hidden="true" className="eyes flex gap-1.5">
      {[0, 1].map((i) => (
        <span key={i} className="eye relative grid size-14 place-items-center rounded-full border-2 border-ink bg-white shadow-[0_4px_10px_-4px_rgba(41,37,33,0.4)] sm:size-16">
          <span className="pupil size-6 rounded-full bg-charcoal sm:size-7" />
        </span>
      ))}
    </div>
  );
}

export function SiteFooter() {
  const root = useRef<HTMLElement>(null);
  const ufo = useRef<HTMLDivElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const abduct = useRef<(i: number | null) => void>(() => {});

  useGSAP((_, contextSafe) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const craft = ufo.current, line = word.current;
    if (!craft || !line) return;
    const letters = gsap.utils.toArray<HTMLElement>(".fw-letter", line);

    const drift = reduce ? null : gsap.fromTo(craft, { x: () => line.offsetWidth * 0.05 }, {
      x: () => line.offsetWidth * 0.95 - craft.offsetWidth, duration: 7, ease: "sine.inOut", yoyo: true, repeat: -1,
    });

    abduct.current = contextSafe!((i: number | null) => {
      if (i === null) {
        drift?.resume();
        gsap.to(".fw-beam", { autoAlpha: 0, duration: 0.3 });
        gsap.to(letters, { y: 0, rotate: 0, duration: 0.6, ease: "back.out(2)" });
        letters.forEach((l) => l.classList.remove("fw-up"));
        return;
      }
      drift?.pause();
      const l = letters[i];
      const box = (craft.offsetParent as HTMLElement).getBoundingClientRect();
      const lr = l.getBoundingClientRect();
      const x = lr.left - box.left + lr.width / 2 - craft.offsetWidth / 2;
      gsap.to(craft, { x, duration: reduce ? 0 : 0.5, ease: "expo.out" });
      gsap.to(".fw-beam", { autoAlpha: 1, duration: 0.25, delay: reduce ? 0 : 0.2 });
      letters.forEach((o, j) => {
        o.classList.toggle("fw-up", j === i);
        if (j !== i) gsap.to(o, { y: 0, rotate: 0, duration: 0.4 });
      });
      if (!reduce) gsap.to(l, { y: "-0.16em", rotate: i % 2 ? 6 : -6, duration: 0.7, ease: "back.out(1.8)", delay: 0.15 });
    });

    const pupils = gsap.utils.toArray<HTMLElement>(".pupil", root.current!);
    const onMove = (e: PointerEvent) => {
      pupils.forEach((p) => {
        const r = (p.parentElement as HTMLElement).getBoundingClientRect();
        const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
        const d = Math.min(r.width * 0.2, Math.hypot(e.clientX - r.left, e.clientY - r.top) / 30);
        gsap.to(p, { x: Math.cos(a) * d, y: Math.sin(a) * d, duration: reduce ? 0 : 0.3, ease: "power3.out" });
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, { scope: root });

  return (
    <footer ref={root} className="relative overflow-hidden border-t border-ink/15 pt-20">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-6">
          <p className="max-w-[24ch] font-serif text-[30px] leading-[1.1] sm:text-[40px]">That’s everything. Go try it.</p>
          <Eyes />
        </div>
        <ol className="border-t border-bubble/40">
          <Row n={1} href={REPO} title="Code">github.com/GMShadowe/shadow-ai</Row>
          <Row n={2} href="#start" title="Install">ollama, python and node</Row>
          <Row n={3} href="#privacy" title="Privacy">127.0.0.1 only · nothing to sign up for</Row>
          <Row n={4} href="#how" title="Your time"><LocalTime /> on this computer</Row>
          <Row n={5} title="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>↑ where it started</Row>
        </ol>
      </div>

      <div className="relative mx-auto mt-16 max-w-[1320px] px-2 sm:mt-24">
        <div ref={ufo} aria-hidden="true" className="pointer-events-none absolute top-0 left-0 z-10 w-[110px] sm:w-[170px]">
          <UfoCraft className="w-full overflow-visible" />
          <div className="fw-beam invisible mx-auto -mt-2 h-[14vw] max-h-[190px] w-[70%] bg-[linear-gradient(to_bottom,rgba(180,198,240,0.85),rgba(180,198,240,0.1))] opacity-0 blur-[2px] [clip-path:polygon(35%_0,65%_0,100%_100%,0_100%)]" />
        </div>
        <div ref={word} role="img" aria-label="shadow"
          className="relative flex justify-center pt-[9vw] select-none" onMouseLeave={() => abduct.current(null)}>
          {WORD.map((ch, i) => (
            <span key={i} className="relative inline-block cursor-default" onMouseEnter={() => abduct.current(i)} onClick={() => abduct.current(i)}>
              <span aria-hidden="true" className="fw-shadow absolute inset-0 translate-x-[0.035em] translate-y-[0.035em] text-[25vw] leading-[0.8] font-black tracking-[-0.06em]">{ch}</span>
              <span aria-hidden="true" className="fw-letter halftone relative block text-[25vw] leading-[0.8] font-black tracking-[-0.06em]">{ch}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-[1180px] flex-col gap-2 border-t border-ink/15 px-4 py-6 font-mono text-[11.5px] text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-sans text-[14px] font-semibold text-ink" aria-label="Shadow home">
          <Mark className="size-[18px]" /> shadow
        </Link>
        <p>Built by <a href="https://github.com/GMShadowe" className="text-signal hover:underline">shadow</a> · runs on your computer · point at a letter</p>
      </div>
    </footer>
  );
}
