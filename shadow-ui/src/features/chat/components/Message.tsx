import { useEffect, useRef, useState } from "react";
import { CheckIcon, CloseIcon, CopyIcon, PencilIcon } from "@/components/icons";
import Lightbox from "@/components/ui/Lightbox";
import DisplayCard from "@/features/display/cards/DisplayCard";
import { panelFor } from "@/features/display/panels";
import Markdown from "@/features/markdown/Markdown";
import type { FeedbackReason, Message as MessageT, Rating } from "@/types";
import { touchedFiles } from "../lib/conversation";
import ErrorAction from "./ErrorAction";
import MessageActions from "./MessageActions";
import PermissionCard from "./PermissionCard";
import RouteBadge from "./RouteBadge";
import ThinkingIndicator from "./ThinkingIndicator";
import ToolCall from "./ToolCall";

const EDITOR_MAX = 240;

// The step budget each effort level gives a turn (config.py EFFORT_STEPS).
const STEP_BUDGET: Record<string, number> = { low: 3, medium: 6, high: 12, extra: 20, ultra: 32 };

function grow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, EDITOR_MAX) + "px";
}

/* The last question, editable in place. Saving replaces the reply below it
   rather than adding a second one. */
/* Copy for your own message: an icon that cross-fades to a check. */
function CopyMine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; nothing sensible to do
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copied" : "Copy"}
      aria-label={copied ? "Copied" : "Copy your message"}
      className="grid h-7 w-7 place-items-center rounded-md text-ink-muted opacity-0 transition-[opacity,background-color,color,scale] duration-150 ease-smooth hover:bg-ink/[0.06] hover:text-ink active:scale-[0.96] group-hover:opacity-100 focus-visible:opacity-100"
    >
      <span className="relative grid h-3.5 w-3.5 place-items-center">
        <CopyIcon width={14} height={14} className="swap-icon absolute" data-on={!copied} />
        <CheckIcon width={14} height={14} className="swap-icon absolute" data-on={copied} />
      </span>
    </button>
  );
}

function UserEditor({ message, onSave, onCancel }: { message: MessageT; onSave: (t: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(message.content);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    grow(el);
  }, []);

  const changed = !!text.trim() && text.trim() !== message.content;

  return (
    <div className="w-full max-w-[80%] space-y-2">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        aria-label="Edit your message"
        onChange={(e) => {
          setText(e.target.value);
          grow(e.target);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (changed) onSave(text.trim());
          }
          if (e.key === "Escape") onCancel();
        }}
        className="block w-full resize-none rounded-[18px] rounded-br-md border border-signal bg-panel-alt px-4 py-2.5 text-base leading-relaxed text-ink focus:outline-none sm:text-[0.9375rem]"
      />
      <div className="flex items-center justify-end gap-2 text-[12px]">
        <span className="mr-auto text-ink-muted">The reply below will be replaced.</span>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-ink-muted transition-[background-color,color,scale] duration-150 hover:bg-ink/[0.06] hover:text-ink active:scale-[0.96]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(text.trim())}
          disabled={!changed}
          className="rounded-md bg-ink px-2.5 py-1 text-bg transition-[opacity,scale] duration-150 enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send again
        </button>
      </div>
    </div>
  );
}

interface MessageProps {
  message: MessageT;
  onPermission: (id: string, decision: string) => Promise<unknown>;
  reasons?: FeedbackReason[];
  canRegenerate?: boolean;
  canEdit?: boolean;
  busy?: boolean;
  onRegenerate: () => void;
  onEdit: (text: string) => void;
  onRate?: (payload: { rating: Rating; reasonCode: string | null; reason: string }) => Promise<void>;
  onOpenSettings: (section?: string) => void;
}

export default function Message({
  message,
  onPermission,
  reasons = [],
  canRegenerate = false,
  canEdit = false,
  busy = false,
  onRegenerate,
  onEdit,
  onRate,
  onOpenSettings,
}: MessageProps) {
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);

  if (message.role === "user") {
    if (editing) {
      return (
        <div className="animate-rise flex flex-col items-end gap-2">
          <UserEditor
            message={message}
            onCancel={() => setEditing(false)}
            onSave={(text) => {
              setEditing(false);
              onEdit(text);
            }}
          />
        </div>
      );
    }

    return (
      <div className="group animate-rise flex flex-col items-end gap-2">
        {!!message.images?.length && (
          <div className="flex max-w-[80%] flex-wrap justify-end gap-2">
            {message.images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setZoomed(src)}
                title="Open larger"
                aria-label="Open this image larger"
                className="block overflow-hidden rounded-xl"
              >
                <img src={src} alt="Attached" className="content-img max-h-52 max-w-64 cursor-zoom-in rounded-xl object-cover" />
              </button>
            ))}
          </div>
        )}
        {zoomed && <Lightbox src={zoomed} onClose={() => setZoomed(null)} />}
        {message.content && (
          <div className="max-w-[75%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-bubble px-4 py-2.5 text-[15px] leading-6 text-bubble-ink">
            {message.content}
          </div>
        )}
        <div className="flex items-center gap-0.5">
        {message.content && <CopyMine text={message.content} />}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            title="Edit and send again"
            aria-label="Edit this message and send it again"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-ink-muted opacity-0 transition-[opacity,background-color,color,scale] duration-150 ease-smooth hover:bg-ink/[0.06] hover:text-ink enabled:active:scale-[0.96] group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
          >
            <PencilIcon width={11} height={11} />
            Edit
          </button>
        )}
        </div>
      </div>
    );
  }

  if (message.role === "error") {
    return (
      <div role="alert" className="animate-rise rounded-2xl border border-danger/30 bg-danger/[0.07] px-4 py-3">
        <div className="flex items-start gap-2.5 text-sm text-danger">
          <CloseIcon width={14} height={14} className="mt-0.5 shrink-0" />
          <span>{message.content}</span>
        </div>
        {/* Where there is an obvious way forward, offer it instead of describing it. */}
        {message.error && (
          <ErrorAction failure={message.error} onRetry={canRegenerate ? onRegenerate : null} onSettings={onOpenSettings} />
        )}
      </div>
    );
  }

  const tools = message.tools ?? [];
  // A list, chart or pictures Shadow put on screen is drawn as the thing
  // itself, not as a tool row; a call the brain refused stays a row.
  const panels = tools.map(panelFor);
  const rows = tools.filter((_, i) => !panels[i]);
  const waiting = message.streaming && !message.content && rows.every((t) => t.kind === "permission" || t.result !== null);
  const steps = rows.filter((t) => t.kind !== "permission").length;
  const budget = message.effort ? STEP_BUDGET[message.effort] : undefined;
  const phase = !message.route ? "Routing" : steps ? "Reading the results" : "Thinking";

  return (
    <div className="group animate-rise space-y-3">
      <RouteBadge message={message} />

      {rows.length > 0 && (
        <section aria-label="Steps" className="space-y-1.5">
          {steps > 0 && (
            <div className="flex items-center gap-2 pl-[1.875rem] text-[13px] text-ink-faint">
              <span>
                {steps} {steps === 1 ? "step" : "steps"}
              </span>
              {budget && (
                // The effort budget, as pips: how much of it this turn used.
                <span className="flex items-center gap-[3px]" aria-label={`${steps} of ${budget} steps used`}>
                  {Array.from({ length: Math.min(budget, 12) }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1 w-2.5 rounded-full ${i < Math.round((steps / budget) * Math.min(budget, 12)) ? "bg-phosphor/80" : "bg-ink/10"}`}
                    />
                  ))}
                  <span className="ml-1 font-mono text-[11px] tabular-nums">
                    {steps}/{budget}
                  </span>
                </span>
              )}
            </div>
          )}
          {/* The rail: a hairline through every node, from the first step to the last. */}
          <ol className="relative space-y-1.5 before:absolute before:bottom-4 before:left-[8.5px] before:top-4 before:w-px before:bg-line">
            {rows.map((t, i) =>
              t.kind === "permission" ? (
                <li key={t.id} className="relative pl-[1.875rem]">
                  <PermissionCard request={t} onAnswer={onPermission} />
                </li>
              ) : (
                <ToolCall key={i} call={t} step={rows.slice(0, i + 1).filter((r) => r.kind !== "permission").length} />
              ),
            )}
          </ol>
        </section>
      )}

      {panels.some(Boolean) && (
        <div className="space-y-3">{panels.map((panel, i) => panel && <DisplayCard key={i} panel={panel} />)}</div>
      )}

      {waiting && <ThinkingIndicator startedAt={message.startedAt} phase={phase} />}

      {message.content && (
        <div className={message.streaming ? "is-streaming" : undefined}>
          <Markdown text={message.content} files={touchedFiles(tools)} />
        </div>
      )}

      {message.stopped && <div className="font-mono text-[11px] text-ink-muted">Stopped</div>}

      {!message.streaming && message.content && onRate && (
        <MessageActions
          message={message}
          reasons={reasons}
          canRegenerate={canRegenerate}
          pinned={canRegenerate}
          busy={busy}
          onRegenerate={onRegenerate}
          onRate={onRate}
        />
      )}
    </div>
  );
}
