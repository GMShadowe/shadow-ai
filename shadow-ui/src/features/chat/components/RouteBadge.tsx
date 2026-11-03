import { useRef, useState, type ComponentType } from "react";
import { ChatIcon, CodeIcon, FolderIcon, GlobeIcon, TerminalIcon, type IconProps } from "@/components/icons";
import { useDismiss } from "@/hooks/useDismiss";
import { useExit } from "@/hooks/useExit";
import type { Message } from "@/types";

/* The line above every reply: which kind of help it was, how sure the
   router was, and what ran. The badge opens a small readout of every
   route's score, so a surprising route can be understood rather than
   guessed at. */

const ROUTES: Record<string, { icon: ComponentType<IconProps>; label: string }> = {
  chat: { icon: ChatIcon, label: "chat" },
  coding: { icon: CodeIcon, label: "coding" },
  files: { icon: FolderIcon, label: "files" },
  system: { icon: TerminalIcon, label: "system" },
  research: { icon: GlobeIcon, label: "research" },
};

function routeOf(name: string | null | undefined) {
  const first = (name ?? "").split(/[+,\s]/)[0];
  return ROUTES[first] ?? null;
}

export default function RouteBadge({ message }: { message: Message }) {
  const [open, setOpen] = useState(false);
  // Opens upward when the reply sits too low in the list for it to fit below.
  const [up, setUp] = useState(false);
  const { mounted, leaving } = useExit(open);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const probs = message.router?.probabilities;
  const ranked = probs ? Object.entries(probs).sort((a, b) => b[1] - a[1]) : [];
  const top = ranked[0]?.[1] ?? null;
  const route = routeOf(message.route);
  const Icon = route?.icon;
  const pending = !message.route;
  const method = message.router?.method;
  const ms = message.router?.ms ?? 0;

  return (
    <div ref={ref} className="relative flex min-w-0 items-center gap-2 font-mono text-[11px]">
      <button
        type="button"
        onClick={(e) => {
          if (!ranked.length) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const scroller = e.currentTarget.closest('[role="log"]')?.getBoundingClientRect();
          setUp(!!scroller && scroller.bottom - rect.bottom < 280);
          setOpen((o) => !o);
        }}
        disabled={!ranked.length}
        aria-expanded={ranked.length ? open : undefined}
        aria-label={pending ? "Routing" : `Routed to ${message.route}${top !== null ? `, ${Math.round(top * 100)}% sure` : ""}`}
        className={`-ml-2 flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2 transition-[background-color,border-color,scale] duration-150 ease-smooth enabled:active:scale-[0.96] ${
          open ? "border-transparent bg-ink/[0.07]" : "border-transparent enabled:hover:bg-ink/[0.05]"
        } disabled:cursor-default`}
      >
        {pending ? (
          <span className="spinner !h-2.5 !w-2.5" aria-hidden="true" />
        ) : Icon ? (
          <Icon width={12} height={12} className="text-ink-faint" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-phosphor" aria-hidden="true" />
        )}
        <span className="text-ink-faint">{pending ? "routing" : message.route}</span>
        {top !== null && (
          // How sure: a 24px meter, filled once when the route arrives.
          <span className="relative h-1 w-6 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
            <span className="meter-fill absolute inset-y-0 left-0 rounded-full bg-phosphor/80" style={{ width: `${Math.round(top * 100)}%` }} />
          </span>
        )}
      </button>

      {message.skill && (
        <span className="shrink-0 rounded-full border border-phosphor/30 bg-phosphor/10 px-2 py-0.5 text-phosphor" title={`The ${message.skill} skill ran on this message`}>
          /{message.skill}
        </span>
      )}

      <span className="min-w-0 truncate text-ink-faint">
        {[message.model, message.effort && `${message.effort}`].filter(Boolean).join(" · ")}
      </span>

      {mounted && (
        <div
          role="dialog"
          aria-label="How this message was routed"
          className={`${leaving ? "animate-pop-out pointer-events-none" : "animate-pop"} glass-menu absolute left-0 z-30 w-64 rounded-xl ${up ? "bottom-full mb-2 origin-bottom-left" : "top-full mt-2 origin-top-left"} p-3 shadow-[0_20px_50px_-20px_var(--shadow-color)]`}
        >
          <div className="mb-2 flex items-baseline justify-between font-sans text-[13px] text-ink-faint">
            <span>Router · {method ?? "—"}</span>
            {ms > 0 && <span className="font-mono text-[11px] tabular-nums">{ms}ms</span>}
          </div>
          <ul className="space-y-1.5">
            {ranked.map(([name, p], i) => {
              const R = routeOf(name);
              const RI = R?.icon;
              return (
                <li key={name} className="grid grid-cols-[1rem_4.5rem_1fr_2.5rem] items-center gap-2">
                  {RI ? <RI width={12} height={12} className={i === 0 ? "text-phosphor" : "text-ink-muted"} /> : <span />}
                  <span className={i === 0 ? "text-ink" : "text-ink-muted"}>{name}</span>
                  <span className="h-1 overflow-hidden rounded-full bg-ink/10">
                    <span
                      className={`meter-fill block h-full rounded-full ${i === 0 ? "bg-phosphor" : "bg-ink/35"}`}
                      style={{ width: `${Math.max(2, Math.round(p * 100))}%`, animationDelay: `${i * 40}ms` }}
                    />
                  </span>
                  <span className="text-right tabular-nums text-ink-muted">{Math.round(p * 100)}%</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2.5 border-t border-line pt-2 font-sans text-[11.5px] leading-normal text-ink-muted">
            Low confidence leans to plain chat, so a weak guess never starts tools.
          </p>
        </div>
      )}
    </div>
  );
}
