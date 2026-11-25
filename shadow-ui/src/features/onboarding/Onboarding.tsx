import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { ModelInfo } from "@/types";

import { getNeededModels, getSettings, updateSettings } from "@/lib/api";
import { ArrowRightIcon, LogoMark } from "@/components/icons";
import AssistantWizard, { BLANK, type AssistantProfile, type ToolInfo } from "./AssistantWizard";
import MachineFigure, { type KeyPress, type Stage } from "./MachineFigure";
import PullProgress from "./PullProgress";
import { EMBEDDER, builtInTiers, callouts as makeCallouts, formatBytes, type Hardware, type PartId, type Tier } from "./machine";
import "./onboarding.css";

interface SetupReport {
  models?: ModelInfo[];
  tools?: ToolInfo[];
  recommended_model?: string;
  hardware?: Hardware;
  cool?: { on: boolean; default: boolean; frees_cpu: boolean };
}

/* First run: what this is, this computer and the model it runs, a name, the
   download, and done.

   It sets up the assistant that already exists rather than creating one: the
   brain makes a 'default' assistant the first time anything asks for one, so
   creating here would leave an unused "Shadow" beside the one the user named.
   PUT /settings writes to whichever assistant is active, which on first run
   is that one.

   Every motion in the drawing follows something real: the parts carry this
   machine's scan, the keys press as the name is typed, the download path
   fills with Ollama's own byte counts. */

const STAGES: Stage[] = ["welcome", "computer", "name", "download", "done"];

const PROMISES: [string, string][] = [
  ["Local", "The model runs in Ollama on this machine. Shadow hosts nothing."],
  ["Yours", "Chats and memory are files in a folder you can read, move or delete."],
  ["Honest", "Anything that can leave this computer is listed in Settings, with a switch to block all of it."],
];

const vars = (v: Record<string, string | number>) => v as CSSProperties;
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Button({ children, onClick, disabled, quiet, arrow }: { children: ReactNode; onClick: () => void; disabled?: boolean; quiet?: boolean; arrow?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`press inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
        quiet
          ? "border border-line text-ink-muted enabled:hover:border-ink-faint enabled:hover:text-ink"
          : "bg-ink text-bg enabled:hover:opacity-90"
      }`}
    >
      {children}
      {arrow && <ArrowRightIcon className="arrow size-4" />}
    </button>
  );
}

function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <h1 className="font-serif text-[clamp(2rem,3.6vw,3.25rem)] font-normal leading-[1.06] tracking-[-0.02em] text-balance text-ink">
        {children}
      </h1>
      {sub && <p className="mb-7 mt-4 max-w-md text-[15px] leading-relaxed text-ink-muted">{sub}</p>}
    </>
  );
}

function Steps({ index, canGoTo, onGo }: { index: number; canGoTo: (i: number) => boolean; onGo: (i: number) => void }) {
  return (
    <div className="mb-10 flex items-center gap-1.5">
      {STAGES.map((s, i) => (
        <button
          key={s}
          type="button"
          disabled={!canGoTo(i)}
          onClick={() => onGo(i)}
          aria-label={`Back to step ${i + 1}`}
          className={`step-seg h-0.5 flex-1 rounded-full enabled:cursor-pointer disabled:cursor-default ${i <= index ? "bg-signal" : "bg-line"}`}
        />
      ))}
    </div>
  );
}

function CalloutList({ items, hovered, onHover }: { items: ReturnType<typeof makeCallouts>; hovered: PartId | null; onHover: (id: PartId | null) => void }) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {items.map((c, i) => (
        <li
          key={c.id}
          onPointerEnter={() => onHover(c.id)}
          onPointerLeave={() => onHover(null)}
          className={`callout flex items-baseline justify-between gap-4 px-4 py-2.5 transition-colors duration-150 ${hovered === c.id ? "bg-panel-alt" : ""}`}
          style={vars({ "--delay": `${300 + i * 140}ms` })}
        >
          <span className="font-mono text-[12.5px] text-ink">{c.label}</span>
          <span className="text-right text-xs text-ink-faint">{c.detail}</span>
        </li>
      ))}
    </ul>
  );
}

function TierPicker({ tiers, value, recommended, onChange, onConsider }: {
  tiers: Tier[];
  value: Tier;
  recommended: string;
  onChange: (t: Tier) => void;
  onConsider: (t: Tier | null) => void;
}) {
  return (
    <div
      className={`grid gap-px overflow-hidden rounded-xl border border-line bg-line ${tiers.length === 4 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3"}`}
      role="radiogroup"
      aria-label="Model"
    >
      {tiers.map((t) => {
        const picked = t.id === value.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={picked}
            disabled={!t.fits}
            onClick={() => onChange(t)}
            onPointerEnter={() => onConsider(t)}
            onPointerLeave={() => onConsider(null)}
            onFocus={() => onConsider(t)}
            onBlur={() => onConsider(null)}
            className={`tier relative px-3.5 py-3 text-left disabled:opacity-40 ${picked ? "bg-panel" : "bg-bg enabled:hover:bg-panel/60"} ${t.strong ? "tier-strong" : ""}`}
          >
            <div className="flex items-center gap-1.5 text-sm text-ink">
              {t.label}
              {picked && <span className="size-1.5 animate-pop rounded-full bg-signal" />}
              {t.id === recommended && <span className="ml-auto font-mono text-[10px] text-ink-faint">suggested</span>}
            </div>
            <div className="mt-0.5 font-mono text-[11px] text-ink-faint">{t.base}</div>
            <div className="mt-1 text-[11px] leading-snug text-ink-faint">{t.fits ? t.blurb : `Needs ${t.needs}`}</div>
            {picked && <span className="absolute inset-x-0 bottom-0 h-0.5 animate-fade bg-signal" />}
          </button>
        );
      })}
    </div>
  );
}

/* Someone who doesn't know a model is running can read a hot, loud laptop as
   something wrong with it. Said before the first answer, not after. Freeing
   the processor is only claimed where Cool mode really does it. */
function Heat({ cool, freesCpu, onCool }: { cool: boolean; freesCpu: boolean; onCool: (on: boolean) => void }) {
  return (
    <div className="mb-7 rounded-xl border border-line">
      <div className="px-4 pb-3 pt-3.5">
        <div className="text-sm text-ink">What to expect</div>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
          While it answers, this computer does the work a data centre would. The fans may spin up and it may get warm.
          That's the model running here, and it settles once the answer is done.
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-line px-4 py-3">
        <span>
          <span className="block text-sm text-ink">Cool mode</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">
            {freesCpu
              ? "Does less at once and leaves some of the processor free, so it runs quieter and cooler."
              : "Does less at once, so it runs quieter and cooler."}{" "}
            Answers take a little longer.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={cool}
          aria-label="Cool mode"
          onClick={() => onCool(!cool)}
          className={`switch relative h-6 w-10 shrink-0 rounded-full border ${cool ? "border-signal bg-signal" : "border-ink-faint/40 bg-panel-alt"}`}
        >
          <span className={`switch-knob absolute left-px top-px size-5 rounded-full ${cool ? "translate-x-4 bg-bubble-ink" : "bg-ink-muted"}`} />
        </button>
      </div>
    </div>
  );
}

/* The Customize form picks from the same tiers. A tier that fits but isn't
   downloaded yet is the point of setup, so it is offered, not greyed out. */
function setupModels(models: ModelInfo[]): ModelInfo[] {
  return models
    .filter((m) => !m.custom)
    .map((m) => ({ ...m, available: m.fits ?? m.available, reason: m.fits === false ? `Needs ${m.needs}` : undefined }));
}

export default function Onboarding({ onFinished }: { onFinished: () => void }) {
  const [report, setReport] = useState<SetupReport | null>(null);
  const [stage, setStage] = useState<Stage>("welcome");
  const [visited, setVisited] = useState(0);
  const [profile, setProfile] = useState<AssistantProfile>(BLANK);
  const [tierId, setTierId] = useState("default");
  const [cool, setCool] = useState(false);
  const [custom, setCustom] = useState(false);
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [considering, setConsidering] = useState<Tier | null>(null);
  const [keyPress, setKeyPress] = useState<KeyPress | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [pull, setPull] = useState<{ index: number; fraction: number | null }>({ index: 0, fraction: null });
  const [promise, setPromise] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const leanRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSettings()
      .then((s: SetupReport) => {
        setReport(s);
        setTierId(s.recommended_model ?? "default");
        setCool(!!s.cool?.on);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const hw: Hardware = useMemo(() => report?.hardware ?? {}, [report]);
  const tiers = useMemo(() => builtInTiers(report?.models ?? []), [report]);
  const recommended = report?.recommended_model ?? "default";
  const tier = tiers.find((t) => t.id === tierId) ?? tiers[0];
  const name = profile.name.trim();
  const display = name || "Shadow";
  const index = STAGES.indexOf(stage);

  const items = useMemo(() => (tier ? makeCallouts(hw, tier, recommended, considering) : []), [hw, tier, recommended, considering]);

  const downloads = useMemo(
    () =>
      missing.map((base) =>
        base === EMBEDDER.base
          ? EMBEDDER
          : { label: tier?.label ?? base, base, bytes: tier?.bytes ?? 0, approx: tier?.approx ?? true }
      ),
    [missing, tier]
  );
  const diskFill =
    stage === "done" ? 1 : stage === "download" && downloads.length ? (pull.index + (pull.fraction ?? 0)) / downloads.length : 0;

  const go = useCallback((next: Stage) => {
    setStage(next);
    setHovered(null);
    setConsidering(null);
    setError(null);
    setVisited((v) => Math.max(v, STAGES.indexOf(next)));
  }, []);

  useEffect(() => {
    if (stage !== "download") return;
    const id = window.setInterval(() => setPromise((p) => (p + 1) % PROMISES.length), 3200);
    return () => window.clearInterval(id);
  }, [stage]);

  /* Save the profile, then find out what still has to be downloaded. A
     machine that already has both models skips the download step instead of
     showing two bars that finish at once. */
  async function saveAndContinue() {
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    try {
      const model = custom ? profile.model : (tier?.id ?? "default");
      await updateSettings({ ...profile, name, model, cool_mode: cool });
      setTierId(model);
      const needed = await getNeededModels(model);
      if (!needed.ollama_up) {
        setError("Ollama isn't answering, so nothing can be downloaded yet. Start Ollama and try again.");
        return;
      }
      setMissing(needed.missing);
      setPull({ index: 0, fraction: null });
      go(needed.missing.length ? "download" : "done");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    setSaving(true);
    try {
      await updateSettings({ onboarded: true });
      onFinished();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const onPullDone = useCallback(() => go("done"), [go]);
  const onPullProgress = useCallback((i: number, fraction: number | null) => setPull({ index: i, fraction }), []);

  function lean(e: PointerEvent<HTMLElement>) {
    const el = leanRef.current;
    if (!el || reduced() || e.pointerType !== "mouse") return;
    const box = e.currentTarget.getBoundingClientRect();
    el.style.setProperty("--px", (((e.clientX - box.left) / box.width - 0.5) * 2).toFixed(3));
    el.style.setProperty("--py", (((e.clientY - box.top) / box.height - 0.5) * 2).toFixed(3));
  }

  function settle() {
    leanRef.current?.style.setProperty("--px", "0");
    leanRef.current?.style.setProperty("--py", "0");
  }

  function considerTier(t: Tier | null) {
    setConsidering(t);
    setHovered(t ? "memory" : null);
  }

  // Back is only offered before anything is saved: once the download starts,
  // going back would mean undoing a choice the brain has already acted on.
  const canGoTo = (i: number) => i < index && index <= 2 && i <= visited;

  const banner = error && (
    <div className="mt-4 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2.5 text-[13px] leading-relaxed text-ink">{error}</div>
  );

  return (
    <div className="onb flex h-full flex-col overflow-y-auto overscroll-contain bg-bg">
      <header className="flex items-center gap-2.5 px-6 py-4 lg:px-10">
        <LogoMark className="size-5 text-ink" />
        <span className="text-sm font-medium text-ink">Shadow</span>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section
          onPointerMove={lean}
          onPointerLeave={settle}
          className="relative isolate z-10 flex min-h-[44vh] items-center justify-center px-4 lg:min-h-0"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="glow-field absolute left-1/2 top-1/2 size-[70%] -translate-x-1/2 -translate-y-1/2" />
            <div className="dot-field absolute inset-0" />
          </div>
          <div ref={leanRef} className="flex h-full w-full items-center justify-center">
            {tier && (
              <MachineFigure
                stage={stage}
                callouts={items}
                name={profile.name}
                progress={stage === "download" ? pull.fraction : null}
                diskFill={Math.min(1, Math.max(0, diskFill))}
                arrivals={stage === "download" ? pull.index : 0}
                hovered={hovered}
                onHover={setHovered}
                keyPress={keyPress}
                cool={cool}
              />
            )}
          </div>
        </section>

        <section className="flex items-center px-6 pb-12 pt-4 lg:px-14 lg:py-10">
          <div className="w-full max-w-lg">
            <Steps index={index} canGoTo={canGoTo} onGo={(i) => go(STAGES[i])} />

            <div key={`${stage}-${custom}`} className="stagger">
              {stage === "welcome" && (
                <>
                  <h1 className="font-serif text-[clamp(2rem,3.6vw,3.25rem)] font-normal leading-[1.06] tracking-[-0.02em] text-ink">
                    <span className="callout block" style={vars({ "--delay": "1500ms" })}>
                      Your computer.
                    </span>
                    <span className="callout block" style={vars({ "--delay": "1900ms" })}>
                      <span className="highlight on-accent" style={vars({ "--delay": "2200ms" })}>
                        Your assistant.
                      </span>
                      <span className="caret" />
                    </span>
                  </h1>
                  <p className="callout mb-7 mt-4 max-w-md text-[15px] leading-relaxed text-ink-muted" style={vars({ "--delay": "2500ms" })}>
                    Shadow runs here, on this computer. No account, nothing to sign in to, and nothing goes online unless you ask for it.
                  </p>
                  <div className="callout" style={vars({ "--delay": "2700ms" })}>
                    <Button onClick={() => go("computer")} disabled={!report} arrow>
                      Set up
                    </Button>
                  </div>
                  {banner}
                </>
              )}

              {stage === "computer" && tier && (
                <>
                  <Title sub="Shadow looked at this machine and suggests a model it runs comfortably. Point at a part to see what it's for, or at a model to see if it fits.">
                    {tier.id === recommended ? "This computer runs" : "You picked"}{" "}
                    <span key={tier.id} className="inline-block animate-pop">
                      {tier.label}
                    </span>
                    .
                  </Title>
                  <div className="mb-5 lg:hidden">
                    <CalloutList items={items} hovered={hovered} onHover={setHovered} />
                  </div>
                  <div className="mb-7">
                    <TierPicker tiers={tiers} value={tier} recommended={recommended} onChange={(t) => setTierId(t.id)} onConsider={considerTier} />
                  </div>
                  <Heat cool={cool} freesCpu={!!report?.cool?.frees_cpu} onCool={setCool} />
                  <div>
                    <Button
                      onClick={() => {
                        setProfile((p) => ({ ...p, model: tier.id }));
                        go("name");
                      }}
                      arrow
                    >
                      Continue with {tier.label}
                    </Button>
                  </div>
                </>
              )}

              {stage === "name" && !custom && tier && (
                <>
                  <Title sub="It uses this name when it talks to you. You can change it later.">What should it be called?</Title>
                  <input
                    autoFocus
                    value={profile.name}
                    maxLength={40}
                    placeholder="Shadow"
                    aria-label="Name"
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveAndContinue();
                      else if (e.key.length === 1) setKeyPress((k) => ({ char: e.key, n: (k?.n ?? 0) + 1 }));
                      else if (e.key === "Backspace") setKeyPress((k) => ({ char: "=", n: (k?.n ?? 0) + 1 }));
                    }}
                    className="w-full border-b border-line bg-transparent pb-2 font-serif text-[2rem] text-ink placeholder:text-ink-faint/50 transition-colors duration-150 focus:border-signal focus:outline-none"
                  />
                  <p className="mt-5 text-[13px] leading-relaxed text-ink-faint">
                    Quick start uses <span className="text-ink">{tier.label}</span>, medium effort, a friendly tone
                    {cool ? ", Cool mode" : ""}, and asks you before anything that can run a command.
                  </p>
                  {banner}
                  <div className="mt-7 flex items-center gap-2">
                    <Button onClick={saveAndContinue} disabled={!name || saving} arrow>
                      {saving ? "Saving…" : "Quick start"}
                    </Button>
                    <Button quiet onClick={() => setCustom(true)} disabled={saving}>
                      Customize
                    </Button>
                  </div>
                </>
              )}

              {stage === "name" && custom && (
                <>
                  <Title sub="The same settings the Settings window has. Everything here can be changed later.">Your assistant</Title>
                  <AssistantWizard
                    value={profile}
                    onChange={setProfile}
                    models={setupModels(report?.models ?? [])}
                    tools={report?.tools ?? []}
                    recommended={recommended}
                  />
                  {banner}
                  <div className="mt-7 flex items-center gap-2">
                    <Button onClick={saveAndContinue} disabled={!name || saving} arrow>
                      {saving ? "Saving…" : "Continue"}
                    </Button>
                    <Button quiet onClick={() => setCustom(false)} disabled={saving}>
                      Back to quick start
                    </Button>
                  </div>
                </>
              )}

              {stage === "download" && (
                <>
                  <Title sub="One is the model that answers you, the other is the small one that lets it remember things. Both come from Ollama and then stay on this computer.">
                    Downloading
                  </Title>
                  <PullProgress models={missing} onDone={onPullDone} onError={setError} onProgress={onPullProgress} />
                  <div className="mt-8 min-h-16 border-l-2 border-signal pl-4">
                    <div key={promise} className="promise">
                      <div className="text-sm text-ink">{PROMISES[promise][0]}</div>
                      <div className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{PROMISES[promise][1]}</div>
                    </div>
                  </div>
                  {downloads.length > 0 && (
                    <p className="mt-6 font-mono text-[11px] text-ink-faint">
                      {formatBytes(
                        downloads.reduce((n, d) => n + d.bytes, 0),
                        downloads.some((d) => d.approx)
                      )}{" "}
                      in all
                    </p>
                  )}
                  {error && (
                    <div className="mt-6">
                      <Button quiet onClick={() => go("done")}>
                        Skip for now
                      </Button>
                    </div>
                  )}
                </>
              )}

              {stage === "done" && (
                <>
                  <Title sub="Its chats and memory live in a folder on this computer. You can make up to three assistants, each with its own.">
                    {display} is{" "}
                    <span className="highlight on-accent" style={vars({ "--delay": "450ms" })}>
                      yours.
                    </span>
                  </Title>
                  <div className="mb-7 flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                    <span
                      className="grid size-9 shrink-0 animate-pop place-items-center rounded-full bg-signal font-medium text-bubble-ink"
                      style={{ animationDelay: "500ms" }}
                    >
                      {display.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm text-ink">{display}</div>
                      <div className="font-mono text-[11px] text-ink-faint">
                        {tier?.label ?? tierId} · {tier?.base ?? ""} · {profile.effort} effort{cool ? " · cool mode" : ""}
                      </div>
                    </div>
                  </div>
                  {banner}
                  <div>
                    <Button onClick={finish} disabled={saving} arrow>
                      Start chatting
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
