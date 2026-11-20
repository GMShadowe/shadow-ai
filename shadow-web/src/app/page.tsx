import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { AppDemo } from "@/components/app-demo";
import { Mark, Sparkle } from "@/components/brand";
import { LocalTime } from "@/components/local-time";
import { RealitySwitch } from "@/components/reality-switch";
import { SiteFooter } from "@/components/site-footer";
import { CopyButton, RevealOnScroll } from "@/components/motion";
import { PipelineFigure } from "@/components/pipeline-figure";
import { HeroOrb, RingBand } from "@/components/three/lazy";
import { TierMachines } from "@/components/tier-machines";
import { UfoList } from "@/components/ufo-list";
import { buttonVariants } from "@/components/ui/button";
import { BAND_ROWS } from "@/lib/facts";
import { cn } from "@/lib/utils";

const REPO = "https://github.com/GMShadowe/shadow-ai";

const PRIVACY = [
  ["Localhost only", "The brain and the app both listen on 127.0.0.1. Nothing on your network can reach them."],
  ["A token on every request", "Other web pages can't drive Shadow. The token is added by the dev server, so the browser never holds it."],
  ["Your data, your folder", "Chats live in SQLite, memories and images sit next to them, and Settings can delete them."],
  ["Every way out, listed", "Settings shows each thing that can go online: web searches, pages you ask for, one-time model downloads. A remote model is flagged in red."],
];

const INSTALL = `# 1. Install Ollama from ollama.com, then:
git clone ${REPO}.git
cd shadow-ai/shadow-brain
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8765

# 2. In a second terminal
cd shadow-ai/shadow-ui
npm install && npm run dev`;

const NAV = [["#how", "How it works"], ["#features", "Features"], ["#privacy", "Privacy"], ["#models", "Models"]];

const big = "h-11 px-5 text-sm";
const pill = "rounded-[10px] border border-ink/25 bg-panel px-3 py-1.5 text-[13.5px] text-ink transition-[background-color,border-color,scale] duration-150 hover:border-ink hover:bg-menu active:scale-[.96]";
const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export default function Home() {
  return (
    <>
      <a href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-menu focus:px-3 focus:py-2 focus:text-sm">
        Skip to content
      </a>

      <div className="mx-auto max-w-[1320px] px-3 pt-3 sm:px-5 sm:pt-5">
        <div className="relative">
          <div className="relative h-[56px]">
            <svg width="232" height="56" className="absolute top-0 left-0 text-ink" aria-hidden="true">
              <path d="M0.5 56V20.5A20 20 0 0 1 20.5 0.5H178C188 0.5 192 3 196 9.5L216 46C219 52 223 55.5 232 55.5" fill="none" stroke="currentColor" />
            </svg>
            <div className="absolute top-[55px] right-0 left-[231px] h-6 rounded-tr-[20px] border-t border-r border-ink" aria-hidden="true" />
            <Link href="/" className="absolute top-3 left-5 flex items-center gap-2 text-[17px] font-semibold tracking-tight" aria-label="Shadow home">
              <Mark className="size-[22px] text-ink" />
              shadow
            </Link>
            <nav aria-label="Main" className="absolute top-1 right-0 flex items-center gap-1.5">
              {NAV.map(([href, label]) => (
                <a key={href} href={href} className={cn(pill, "hidden lg:block")}>{label}</a>
              ))}
              <a href={REPO} className="rounded-[10px] bg-charcoal px-3 py-1.5 text-[13.5px] text-cream transition-[opacity,scale] duration-150 hover:opacity-90 active:scale-[.96]">
                GitHub
              </a>
            </nav>
          </div>

          <header id="main" data-reality="paper" className="reality relative flex min-h-[calc(100svh-68px)] flex-col justify-center overflow-hidden rounded-b-[20px] border-x border-b border-[#292521] bg-bg text-ink sm:min-h-[calc(100svh-76px)]">
            <div id="reality-scan" aria-hidden="true" className="pointer-events-none invisible absolute inset-y-0 left-0 z-30 w-full bg-[linear-gradient(90deg,transparent,rgba(111,143,232,0.35)_45%,var(--bubble)_50%,rgba(111,143,232,0.35)_55%,transparent)]" />
            <div aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 bg-[linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] bg-[size:28px_28px] [clip-path:polygon(100%_0,100%_100%,0_100%)] lg:block" />

            <div className="relative grid w-full gap-6 px-5 pt-10 pb-20 sm:px-10 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-4 lg:px-14 lg:pb-14">
              <div>
                <p className="rise flex items-center gap-2 font-mono text-[11.5px] text-ink-muted">
                  <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
                  A local-first AI assistant
                </p>
                <h1 className="rise mt-6 font-serif text-[46px] leading-[1.04] font-normal tracking-[-0.02em] sm:text-[72px] xl:text-[88px]"
                  style={delay(60)}>
                  Ask once.{" "}
                  <span data-wipe="0.4"
                    className="bg-[linear-gradient(var(--bubble),var(--bubble))] bg-left bg-no-repeat px-[0.08em] text-bubble-ink [box-decoration-break:clone]">
                    Shadow does the rest.
                  </span>
                  <span className="caret" aria-hidden="true" />
                </h1>

                <div className="rise relative mt-12 max-w-[440px]" style={delay(180)}>
                  <Ticks />
                  <div className="bg-ink/[.07]">
                    <p className="bg-ink/[.06] px-5 py-2.5 font-serif text-[22px] leading-tight">Your computer, your rules.</p>
                    <p className="px-5 pt-3 pb-5 text-[15px] leading-[1.6] text-ink">
                      Shadow runs local models through Ollama and keeps your chats on your computer. It works with
                      your files, runs commands and searches the web, and asks before anything risky. Only the
                      searches and pages you ask for go online.
                    </p>
                  </div>
                </div>
                <div className="rise mt-8 flex flex-wrap gap-3" style={delay(240)}>
                  <a href="#start" className={cn(buttonVariants({ size: "lg" }), big)}>Get started</a>
                  <a href={REPO} className={cn(buttonVariants({ variant: "outline", size: "lg" }), big, "border-ink/25")}>View the code</a>
                </div>
              </div>

              <div className="relative mx-auto aspect-square w-full max-w-[560px]">
                <Cross className="top-[6%] left-[4%]" />
                <Cross className="top-[6%] right-[4%]" />
                <Cross className="bottom-[6%] left-[4%]" />
                <Cross className="right-[4%] bottom-[6%]" />
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="var(--line)" vectorEffect="non-scaling-stroke" />
                  <circle cx="50" cy="50" r="34" fill="none" stroke="var(--line)" vectorEffect="non-scaling-stroke" />
                  <g className="orbit">
                    <circle cx="94" cy="50" r="1.1" fill="var(--bubble)" />
                  </g>
                  <path className="hud-line" pathLength={1} data-draw="0.6" d="M38 36 L22 14 L4 14" vectorEffect="non-scaling-stroke" />
                  <path className="hud-line" pathLength={1} data-draw="0.8" d="M64 66 L80 84 L97 84" vectorEffect="non-scaling-stroke" />
                </svg>
                <HeroOrb />
                <div className="absolute top-[2%] right-[2%] z-20"><RealitySwitch /></div>
                <Hud className="top-[1%] left-0">
                  <b>The form</b>
                  your chats, memory and files, kept on this computer
                </Hud>
                <Hud className="right-0 bottom-[1%] text-right">
                  <b>Its shadow</b>
                  Shadow at work beside you: it reads, runs and searches, and asks first
                </Hud>
                <p className="absolute top-[40%] -right-1 hidden rotate-90 font-mono text-[10.5px] text-ink-faint sm:block">
                  your time <LocalTime /> · 127.0.0.1
                </p>
              </div>
            </div>

            <a href="#how" aria-label="Scroll to how it works"
              className="absolute bottom-5 left-5 grid size-10 place-items-center rounded-full border border-ink/40 text-ink transition-[background-color,scale] duration-150 hover:bg-accent active:scale-[.96] sm:left-8">
              <ArrowDown className="size-4 motion-safe:animate-bounce" aria-hidden="true" />
            </a>
          </header>
        </div>
      </div>

      <section aria-label="Shadow in short" className="relative mt-16 h-[260px] overflow-hidden sm:h-[380px]">
        <div aria-hidden="true" className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-bubble py-1 font-mono text-[13px] text-bubble-ink">
          {BAND_ROWS.map((r) => <p key={r} className="truncate px-4 leading-[26px] whitespace-pre sm:leading-[36px]">{r.repeat(3)}</p>)}
        </div>
        <RingBand />
        <ul className="sr-only">
          {BAND_ROWS.map((r) => <li key={r}>{r.replace(/\s+·\s+$/, "").replace(/\s+·\s+/g, ", ")}</li>)}
        </ul>
      </section>

      <main>
        <section id="how" className="mx-auto flex min-h-svh max-w-[1180px] flex-col justify-center px-4 py-24 sm:px-6">
          <div data-reveal>
            <SectionHead label="How it works" title="One message, start to finish, on your machine." />
          </div>
          <div className="relative mt-14" data-reveal>
            <div aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-1/4 bottom-0 bg-[radial-gradient(ellipse_at_50%_55%,rgba(111,143,232,0.26),transparent_65%)] blur-2xl" />
            <div className="relative mx-auto max-w-[1000px]"><PipelineFigure /></div>
          </div>
        </section>

        <section id="features" className="mx-auto flex min-h-svh max-w-[1180px] flex-col justify-center px-4 py-24 sm:px-6">
          <div data-reveal>
            <SectionHead label="What it does" title="A real assistant, kept at home." />
          </div>
          <div className="mt-12" data-reveal><UfoList /></div>
        </section>

        <section className="flex min-h-svh items-center bg-charcoal text-cream">
          <div className="mx-auto w-full max-w-[1320px] px-4 py-24 sm:px-6">
            <div data-reveal className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
              <div><SectionHead label="In the app" title="Every step, out in the open." dark /></div>
              <p className="max-w-[44ch] text-[16px] leading-[1.6] text-cream/70 lg:pb-2">
                Each reply shows which kind of help it was, every tool that ran, and what it touched.
                Try a prompt, answer the permission card yourself, and point at any part to look closer.
              </p>
            </div>
            <div className="mt-10" data-reveal><AppDemo /></div>
          </div>
        </section>

        <section id="privacy" className="mx-auto flex min-h-svh max-w-[1180px] flex-col justify-center px-4 py-24 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
            <div data-reveal>
              <SectionHead label="Privacy" title="Nothing leaves unless you choose." />
              <p className="mt-5 max-w-[46ch] text-[16px] leading-[1.6] text-ink-muted">
                There’s no Shadow server to send things to. Any program running as you can still read
                your files, and Shadow says that plainly instead of promising more than it can.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {PRIVACY.map(([title, body], i) => (
                <li key={title} data-reveal className="group relative border border-line-strong/60 bg-panel p-5 pt-4 transition-[border-color,translate] duration-200 ease-[var(--ease-smooth)] hover:-translate-y-[3px] hover:border-signal">
                  <Ticks hover />
                  <p className="flex items-center justify-between font-mono text-[11px] text-ink-faint">
                    <span>{String(i + 1).padStart(2, "0")} / {String(PRIVACY.length).padStart(2, "0")}</span>
                    <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
                      {[3, 7, 5, 9, 4, 8, 6].map((h, j) => (
                        <span key={j} className="w-[2px] bg-ink/40 transition-colors duration-300 group-hover:bg-signal" style={{ height: `${h + 3}px` }} />
                      ))}
                    </span>
                  </p>
                  <h3 className="mt-6 text-[17px] font-semibold">{title}</h3>
                  <p className="mt-2 text-[14px] leading-[1.6] text-ink-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="models" className="flex min-h-svh items-center border-y border-line bg-sidebar">
          <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div data-reveal>
              <SectionHead label="Models" title="Picked for your hardware." />
              <p className="mt-5 max-w-[44ch] text-[16px] leading-[1.6] text-ink-muted">
                On first run Shadow checks your computer and downloads the right model for you.
                You can switch tiers at any time, and choose how hard it works on each message.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2 text-[13px] text-ink-faint">
                <span>Effort, in tool steps per message:</span>
                {["3", "6", "12", "20", "32"].map((n) => (
                  <span key={n} className="rounded-full border border-line bg-panel px-2.5 py-0.5 font-mono text-[11px] tabular-nums transition-colors duration-150 hover:border-signal hover:text-signal">{n}</span>
                ))}
              </div>
            </div>
            <div data-reveal>
              <TierMachines />
              <ul className="mt-4 space-y-1 font-mono text-[11.5px] text-ink-muted sm:hidden">
                <li>Default · qwen3.5:4b · 8 GB RAM</li>
                <li>Plus · qwen3.5:9b · 16 GB RAM</li>
                <li>Primal · gemma4:12b · 16 GB RAM</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="start" className="mx-auto flex min-h-[80svh] max-w-[1180px] flex-col justify-center px-4 py-24 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:items-start">
            <div data-reveal>
              <SectionHead label="Get started" title="Running in a few minutes." />
              <p className="mt-5 max-w-[46ch] text-[16px] leading-[1.6] text-ink-muted">
                You need Ollama, Python and Node. Open the app on localhost, and the first-run
                setup scans your hardware and downloads a model.
              </p>
              <a href={REPO} className={cn(buttonVariants({ size: "lg" }), big, "mt-8")}>Get the code</a>
            </div>
            <figure className="relative min-w-0" data-reveal>
              <Ticks />
              <div className="bg-ink/[.07]">
                <figcaption className="flex items-center justify-between bg-ink/[.06] py-1.5 pr-1.5 pl-5 font-mono text-[11.5px] text-ink-muted">
                  bash
                  <CopyButton text={INSTALL} />
                </figcaption>
                <pre className="overflow-x-auto px-5 py-4 font-mono text-[12.5px] leading-[1.75] text-ink"><code>{INSTALL}</code></pre>
              </div>
            </figure>
          </div>
        </section>
      </main>

      <SiteFooter />

      <RevealOnScroll />
    </>
  );
}

function SectionHead({ label, title, dark }: { label: string; title: string; dark?: boolean }) {
  return (
    <>
      <p className={cn("flex items-center gap-1.5 font-mono text-[11.5px]", dark ? "text-cream/60" : "text-ink-faint")}>
        <Sparkle className={cn("size-3", dark ? "text-bubble" : "text-signal")} />
        {label}
      </p>
      <h2 className="mt-4 max-w-[18ch] font-serif text-[40px] leading-[1.04] font-normal tracking-[-0.02em] text-balance sm:text-[56px] lg:text-[64px]">
        {title}
      </h2>
    </>
  );
}

function Ticks({ hover }: { hover?: boolean }) {
  const t = cn("pointer-events-none absolute size-3 border-ink/60", hover && "opacity-0 transition-[opacity,translate] duration-200 ease-[var(--ease-smooth)] group-hover:opacity-100");
  return (
    <span aria-hidden="true">
      <span className={cn(t, "-top-2 -left-2 border-t border-l", hover && "translate-x-1 translate-y-1 group-hover:translate-0")} />
      <span className={cn(t, "-top-2 -right-2 border-t border-r", hover && "-translate-x-1 translate-y-1 group-hover:translate-0")} />
      <span className={cn(t, "-bottom-2 -left-2 border-b border-l", hover && "translate-x-1 -translate-y-1 group-hover:translate-0")} />
      <span className={cn(t, "-right-2 -bottom-2 border-r border-b", hover && "-translate-x-1 -translate-y-1 group-hover:translate-0")} />
    </span>
  );
}

function Cross({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={cn("pointer-events-none absolute size-4", className)}>
      <span className="absolute top-1/2 left-0 h-px w-full bg-ink/50" />
      <span className="absolute top-0 left-1/2 h-full w-px bg-ink/50" />
    </span>
  );
}

function Hud({ className, children }: { className: string; children: ReactNode }) {
  return (
    <p className={cn("absolute z-10 hidden max-w-[210px] border border-ink/70 bg-bg/85 p-2.5 font-mono text-[10.5px] leading-[1.45] text-ink-muted backdrop-blur-sm sm:block [&_b]:mb-1 [&_b]:block [&_b]:font-sans [&_b]:text-[12px] [&_b]:font-semibold [&_b]:text-ink", className)}>
      {children}
    </p>
  );
}
