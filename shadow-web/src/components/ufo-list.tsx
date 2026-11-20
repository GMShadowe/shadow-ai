"use client";

import { useRef, useState, type ComponentType, type SVGProps } from "react";
import { AudioLines, Brain, Cpu, ShieldCheck, SquareSlash, Users } from "lucide-react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { UfoCraft } from "./ufo-craft";

gsap.registerPlugin(ScrollTrigger, useGSAP);


type Row = { title: string; detail: string; icon: ComponentType<SVGProps<SVGSVGElement>>; tilt: number };

const ROWS: Row[] = [
  { title: "Runs locally", detail: "models through Ollama · no account · no server", icon: Cpu, tilt: -8 },
  { title: "Asks before risky tools", detail: "files · shell · web search · always allow when you trust it", icon: ShieldCheck, tilt: 6 },
  { title: "Talks back", detail: "whisper listens · piper speaks · both on your computer", icon: AudioLines, tilt: -5 },
  { title: "Three assistants", detail: "each with its own chats, memory and folder", icon: Users, tilt: 9 },
  { title: "Remembers, visibly", detail: "every memory listed in Settings · delete any of them", icon: Brain, tilt: -7 },
  { title: "Skills you start", detail: "markdown · started by a slash command · never by the model", icon: SquareSlash, tilt: 5 },
];

function Sticker({ row, className = "" }: { row: Row; className?: string }) {
  const Icon = row.icon;
  return (
    <span className={`grid size-14 place-items-center rounded-2xl border-[3px] border-white bg-bubble text-bubble-ink shadow-[0_6px_14px_-4px_rgba(41,37,33,0.35)] ${className}`}
      style={{ rotate: `${row.tilt}deg` }}>
      <Icon className="size-6" aria-hidden="true" />
    </span>
  );
}

export function UfoList() {
  const wrap = useRef<HTMLDivElement>(null);
  const ufo = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const pinned = useRef(false);

  const goRef = useRef<(i: number) => void>(() => {});

  useGSAP((_, contextSafe) => {
    const go = contextSafe!((i: number) => {
      const list = wrap.current;
      const craft = ufo.current;
      if (!list || !craft) return;
      const row = list.querySelectorAll<HTMLElement>("[data-row]")[i];
      if (!row) return;
      setActive(i);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const y = row.offsetTop + row.offsetHeight / 2 - craft.offsetHeight + 28;
      gsap.to(craft, { y, duration: reduce ? 0 : 0.8, ease: "expo.out", overwrite: "auto" });
      if (!reduce) {
        gsap.fromTo(".ufo-beam", { scaleX: 0.2, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.5, ease: "expo.out", delay: 0.25 });
        gsap.fromTo(".ufo-cargo", { y: 46, opacity: 0, scale: 0.7 }, { y: 0, opacity: 1, scale: 1, duration: 0.9, ease: "back.out(1.6)", delay: 0.35 });
      }
    });
    goRef.current = go;
    go(0);

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(".ufo-craft", { y: -6, rotate: 2, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(".ufo-lights circle", { opacity: 0.3, duration: 0.5, stagger: { each: 0.12, repeat: -1, yoyo: true } });
    });
    gsap.utils.toArray<HTMLElement>("[data-row]").forEach((row, i) => {
      ScrollTrigger.create({
        trigger: row, start: "top 60%", end: "bottom 40%",
        onToggle: (self) => { if (self.isActive && !pinned.current) go(i); },
      });
    });
    return () => mm.revert();
  }, { scope: wrap });

  return (
    <div ref={wrap} className="relative">
      <ol className="lg:pr-[260px]">
        {ROWS.map((row, i) => (
          <li key={row.title} data-row
            onMouseEnter={() => { pinned.current = true; goRef.current(i); }}
            onMouseLeave={() => { pinned.current = false; }}
            className="group relative grid gap-2 border-b border-bubble/35 py-5 transition-colors duration-150 first:border-t hover:border-signal sm:py-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <h3 className="flex items-baseline gap-3 font-sans text-[34px] leading-[0.95] font-extrabold tracking-[-0.035em] transition-transform duration-300 ease-[var(--ease-smooth)] group-hover:translate-x-2 sm:text-[52px] lg:text-[64px]">
              <span className={`font-mono text-[13px] font-normal tracking-normal transition-colors duration-150 ${active === i ? "text-signal" : "text-ink-faint"}`}>
                ({i + 1})
              </span>
              {row.title}
            </h3>
            <p className="font-mono text-[11.5px] text-ink-muted lg:max-w-[30ch] lg:pb-2 lg:text-right">{row.detail}</p>
            <Sticker row={row} className="absolute top-4 right-0 scale-75 lg:hidden" />
          </li>
        ))}
      </ol>

      <div ref={ufo} aria-hidden="true" className="pointer-events-none absolute top-0 right-6 hidden w-[200px] lg:block">
        <UfoCraft className="ufo-craft relative z-10 w-full overflow-visible" />
        <div className="relative -mt-3 h-[150px]">
          <div className="ufo-beam absolute inset-x-6 top-0 bottom-0 origin-top bg-[linear-gradient(to_bottom,rgba(180,198,240,0.9),rgba(180,198,240,0.15))] blur-[2px] [clip-path:polygon(38%_0,62%_0,100%_100%,0_100%)]" />
          <div className="ufo-cargo absolute inset-x-0 bottom-6 flex justify-center">
            <Sticker row={ROWS[active]} />
          </div>
        </div>
      </div>
    </div>
  );
}
