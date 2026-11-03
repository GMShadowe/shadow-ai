import { useState, type ReactNode } from "react";
import { CloseIcon, FileIcon, GlobeIcon, GlobeOffIcon, LinkIcon, OutboundIcon } from "@/components/icons";
import IconButton from "@/components/ui/IconButton";
import { EFFORTS } from "@/features/composer/RunPicker";
import { openWorkspaceFile } from "@/lib/api";
import type { Message, ModelInfo } from "@/types";

/* The inspector: a column on the right of the workspace that says what this
   chat is running on and what it has done - the model and its effort
   budget, how the last reply was routed and how many steps it took, and
   every file and link the chat has touched. Docked on wide windows, a
   drawer over the chat on narrow ones. */

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="text-[12.5px] font-medium text-ink-faint">{title}</h3>
        {aside && <span className="font-mono text-[11px] tabular-nums text-ink-faint">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-line px-2.5 py-2">
      <div className="font-mono text-[15px] tabular-nums text-ink">{value}</div>
      <div className="mt-0.5 text-[11.5px] text-ink-faint">{label}</div>
    </div>
  );
}

function host(url: string) {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

interface InspectorProps {
  messages: Message[] | null;
  model: ModelInfo | undefined;
  effort: string;
  offline: boolean;
  sources: { files: string[]; links: string[] };
  onToggleOffline: () => void;
  onClose: () => void;
}

export default function Inspector({ messages, model, effort, offline, sources, onToggleOffline, onClose }: InspectorProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const list = messages ?? [];
  const replies = list.filter((m) => m.role === "assistant");
  const last = [...replies].reverse().find((m) => !m.streaming) ?? replies[replies.length - 1];
  const tools = replies.flatMap((m) => m.tools ?? []).filter((t) => t.kind !== "permission");
  const lastSteps = (last?.tools ?? []).filter((t) => t.kind !== "permission");
  const effortIndex = Math.max(0, EFFORTS.findIndex((e) => e.id === effort));
  const current = EFFORTS[effortIndex];
  const probs = last?.router?.probabilities;
  const confidence = probs ? Math.max(...Object.values(probs)) : null;

  return (
    <aside aria-label="Inspector" className="flex h-full w-[300px] flex-col bg-bg">
      <div className="flex h-[52px] shrink-0 items-center justify-between pl-4 pr-2">
        <h2 className="text-[14px] font-semibold text-ink">This chat</h2>
        <IconButton label="Close inspector" size="sm" tooltipSide="bottom" onClick={onClose}>
          <CloseIcon width={15} height={15} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <Section title="Running on">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[14px] font-medium text-ink">{model?.label ?? "No model"}</span>
            {model?.sends_data ? (
              <span className="flex items-center gap-1 rounded-md border border-danger/40 px-1.5 py-px font-mono text-[10.5px] text-danger">
                <OutboundIcon width={10} height={10} /> remote
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-md border border-line px-1.5 py-px font-mono text-[10.5px] text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-ok" /> local
              </span>
            )}
          </div>
          {model?.model && <div className="mt-0.5 truncate font-mono text-[11.5px] text-ink-faint">{model.model}</div>}

          <div className="mt-3.5 flex items-baseline justify-between">
            <span className="text-[13px] text-ink">{current.label} effort</span>
            <span className="font-mono text-[11px] tabular-nums text-ink-faint">up to {current.steps} steps</span>
          </div>
          {/* Each bar is as tall as that level's step budget. */}
          <div className="mt-2 flex h-8 items-end gap-1" aria-hidden="true">
            {EFFORTS.map((e, i) => (
              <span
                key={e.id}
                className={`flex-1 rounded-[3px] transition-colors duration-200 ${i === effortIndex ? "bg-signal" : i < effortIndex ? "bg-signal/35" : "bg-ink/10"}`}
                style={{ height: `${25 + (e.steps / 32) * 75}%` }}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onToggleOffline}
            aria-pressed={!offline}
            className={`mt-3.5 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] transition-[background-color,border-color,scale] duration-150 ease-smooth active:scale-[0.98] ${
              offline ? "border-danger/30 bg-danger/[0.06] text-danger" : "border-line text-ink hover:bg-ink/[0.04]"
            }`}
          >
            {offline ? <GlobeOffIcon width={15} height={15} /> : <GlobeIcon width={15} height={15} className="text-signal" />}
            <span className="flex-1">{offline ? "Web tools blocked" : "Web tools allowed"}</span>
            <span className="text-[11.5px] text-ink-faint">{offline ? "Allow" : "Block"}</span>
          </button>
        </Section>

        <Section title="So far">
          <div className="grid grid-cols-3 gap-1.5">
            <Stat label="questions" value={list.filter((m) => m.role === "user").length} />
            <Stat label="replies" value={replies.length} />
            <Stat label="steps" value={tools.length} />
          </div>
        </Section>

        {last?.route && (
          <Section title="Last reply" aside={confidence !== null ? `${Math.round(confidence * 100)}% sure` : undefined}>
            <div className="flex items-center gap-2 text-[13px]">
              <span className="rounded-md bg-signal/10 px-1.5 py-0.5 font-mono text-[11.5px] text-signal">{last.route}</span>
              <span className="text-ink-muted">
                {lastSteps.length} {lastSteps.length === 1 ? "step" : "steps"}
                {last.effort && ` of ${EFFORTS.find((e) => e.id === last.effort)?.steps ?? "?"}`}
              </span>
            </div>
            {confidence !== null && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/10">
                <div className="meter-fill h-full rounded-full bg-signal" style={{ width: `${Math.round(confidence * 100)}%` }} />
              </div>
            )}
            {lastSteps.length > 0 && (
              <ol className="mt-3 space-y-1">
                {lastSteps.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 font-mono text-[11.5px] text-ink-muted">
                    <span className="tabular-nums text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                    <span className="truncate">{t.name}</span>
                    <span className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${t.result === null ? "animate-pulse bg-signal" : "bg-ok"}`} />
                  </li>
                ))}
              </ol>
            )}
          </Section>
        )}

        <Section title="Files" aside={sources.files.length || undefined}>
          {sources.files.length === 0 ? (
            <p className="text-[12.5px] leading-normal text-ink-faint">Files Shadow reads or writes show up here.</p>
          ) : (
            <ul className="-mx-1.5 space-y-px">
              {sources.files.map((path) => (
                <li key={path}>
                  <button
                    type="button"
                    title={failed === path ? "Couldn't open it" : `Open ${path}`}
                    onClick={() => openWorkspaceFile(path).catch(() => setFailed(path))}
                    className={`flex h-8 w-full items-center gap-2 rounded-md px-1.5 text-left transition-colors duration-100 hover:bg-ink/[0.06] ${failed === path ? "text-danger" : "text-ink"}`}
                  >
                    <FileIcon width={14} height={14} className="shrink-0 text-ink-faint" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px]" dir="rtl">
                      <bdi>{path}</bdi>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Links" aside={sources.links.length || undefined}>
          {sources.links.length === 0 ? (
            <p className="text-[12.5px] leading-normal text-ink-faint">Links in replies collect here.</p>
          ) : (
            <ul className="-mx-1.5 space-y-px">
              {sources.links.map((url) => (
                <li key={url}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    title={url}
                    className="flex h-8 items-center gap-2 rounded-md px-1.5 text-[13px] text-ink transition-colors duration-100 hover:bg-ink/[0.06]"
                  >
                    <LinkIcon width={14} height={14} className="shrink-0 text-ink-faint" />
                    <span className="min-w-0 flex-1 truncate">{host(url)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </aside>
  );
}
