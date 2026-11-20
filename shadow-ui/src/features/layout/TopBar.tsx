import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChatIcon,
  ComposeIcon,
  DotsIcon,
  DownloadIcon,
  OutboundIcon,
  PencilIcon,
  SourcesIcon,
  TrashIcon,
} from "@/components/icons";
import IconButton from "@/components/ui/IconButton";
import { useDismiss } from "@/hooks/useDismiss";
import { useExit } from "@/hooks/useExit";
import { modKey, tokens } from "@/lib/format";
import type { ExportFormat, ModelInfo, Spend } from "@/types";

/* The bar over the conversation: the chat's title on the left, with its
   menu; on the right whatever must be impossible to miss - a model sending
   the conversation off this computer, what that costs in tokens (never
   money: a wrong price is worse than none), the brain being down - then the
   inspector toggle and a new chat. */

/** A popover anchored under its trigger at the right edge: it scales from its top-right corner. */
function Popover({ open, label, children, className = "" }: { open: boolean; label: string; children: ReactNode; className?: string }) {
  const { mounted, leaving } = useExit(open);
  if (!mounted) return null;
  return (
    <div
      role="menu"
      aria-label={label}
      className={`${leaving ? "animate-pop-out pointer-events-none" : "animate-pop"} glass-menu absolute right-0 top-full z-40 mt-1.5 origin-top-right rounded-xl p-1.5 ${className}`}
    >
      {children}
    </div>
  );
}

const ITEM =
  "flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13.5px] transition-colors duration-100 hover:bg-ink/[0.07]";

interface TopBarProps {
  title: string;
  /** Only a saved chat can be renamed, exported or deleted. */
  saved: boolean;
  connected: boolean;
  authFailed: boolean;
  model: ModelInfo | undefined;
  spend: Spend | null;
  /** How many files and links the chat has touched; a dot on the inspector button. */
  sourceCount: number;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  onRename: (title: string) => void;
  onExport: (format: ExportFormat) => void;
  onDelete: () => void;
  onNew: () => void;
  /** Stays on the left when the chat has no title yet (the empty chat). */
  leading?: ReactNode;
}

export default function TopBar({
  title,
  saved,
  connected,
  authFailed,
  model,
  spend,
  sourceCount,
  inspectorOpen,
  onToggleInspector,
  onRename,
  onExport,
  onDelete,
  onNew,
  leading,
}: TopBarProps) {
  const sending = !!model?.sends_data;
  const turn = tokens(spend?.turn);
  const today = tokens(spend?.today);
  const [open, setOpen] = useState<"menu" | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open !== null, () => setOpen(null));
  useEffect(() => setDraft(title), [title]);

  function commit() {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) onRename(next);
    else setDraft(title);
  }

  function pick(fn: () => void) {
    setOpen(null);
    fn();
  }

  return (
    <header className="relative z-20 flex h-[52px] shrink-0 items-center gap-2 pl-4 pr-2">
      {leading ?? (
        <div className="flex min-w-0 items-center gap-2">
          <ChatIcon width={16} height={16} className="shrink-0 text-ink-faint" />
          {editing ? (
            <input
              autoFocus
              value={draft}
              aria-label="Chat title"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(title);
                  setEditing(false);
                }
              }}
              className="h-8 w-[min(28rem,50vw)] rounded-md border border-signal/70 bg-bg px-2 text-base font-semibold text-ink focus:outline-none sm:text-[14px]"
            />
          ) : (
            <h1
              key={title}
              onDoubleClick={() => saved && setEditing(true)}
              className="animate-fade truncate text-[14px] font-semibold text-ink"
            >
              {title}
            </h1>
          )}
        </div>
      )}

      <div ref={ref} className="ml-auto flex shrink-0 items-center gap-1">
        {sending && today !== null && spend && (
          <span
            title={
              `Tokens this endpoint has reported today: ${spend.today.toLocaleString()}.` +
              (spend.turn ? ` This turn: ${spend.turn.toLocaleString()}.` : "") +
              " Counted from what the provider reports. Caps are in Settings → Models & brain."
            }
            className="animate-fade mr-1 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] tabular-nums text-ink-muted"
          >
            {turn ? `${turn} this turn · ` : ""}
            {today} today
          </span>
        )}
        {sending && model && (
          <span
            title={`This conversation is being sent to ${model.host || "your endpoint"} as ${model.model}. Messages, files Shadow reads, tool results and images all leave this computer, and the provider bills you for them.`}
            className="animate-fade mr-1 flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-[12px] text-danger"
          >
            <OutboundIcon width={12} height={12} />
            Leaving this computer · {model.host || model.label}
          </span>
        )}
        {!connected && (
          <span
            role="status"
            title={
              authFailed
                ? "The brain is running but rejected this request. Restart the UI dev server so it reads the current access token."
                : "Nothing is answering on 127.0.0.1:8765. Start the brain with: uvicorn server:app --host 127.0.0.1 --port 8765"
            }
            className="animate-fade mr-1 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-[12px] text-danger"
          >
            {authFailed ? "Brain refused us" : "Brain offline"}
          </span>
        )}

        {saved && (
          <div className="relative">
            <IconButton
              label="Chat options"
              tooltipSide="bottom"
              size="sm"
              active={open === "menu"}
              aria-haspopup="menu"
              aria-expanded={open === "menu"}
              onClick={() => setOpen((o) => (o === "menu" ? null : "menu"))}
            >
              <DotsIcon width={17} height={17} />
            </IconButton>
            <Popover open={open === "menu"} label="Chat options" className="w-56">
              <button type="button" role="menuitem" className={`${ITEM} text-ink`} onClick={() => pick(() => setEditing(true))}>
                <PencilIcon width={15} height={15} className="text-ink-muted" />
                <span className="flex-1">Rename</span>
              </button>
              <button type="button" role="menuitem" className={`${ITEM} text-ink`} onClick={() => pick(onNew)}>
                <ComposeIcon width={15} height={15} className="text-ink-muted" />
                <span className="flex-1">New chat</span>
                <span className="font-mono text-[11px] text-ink-faint">{modKey} ⇧ O</span>
              </button>
              <div className="mx-2 my-1 h-px bg-line" />
              <button type="button" role="menuitem" className={`${ITEM} text-ink`} onClick={() => pick(() => onExport("md"))}>
                <DownloadIcon width={15} height={15} className="text-ink-muted" />
                <span className="flex-1">Export as Markdown</span>
              </button>
              <button type="button" role="menuitem" className={`${ITEM} text-ink`} onClick={() => pick(() => onExport("json"))}>
                <DownloadIcon width={15} height={15} className="text-ink-muted" />
                <span className="flex-1">Export as JSON</span>
              </button>
              <div className="mx-2 my-1 h-px bg-line" />
              <button type="button" role="menuitem" className={`${ITEM} text-danger`} onClick={() => pick(onDelete)}>
                <TrashIcon width={15} height={15} />
                <span className="flex-1">Delete</span>
              </button>
            </Popover>
          </div>
        )}

        <IconButton
          label={inspectorOpen ? "Hide inspector" : "Show inspector"}
          tooltipSide="bottom"
          size="sm"
          className="relative"
          active={inspectorOpen}
          aria-pressed={inspectorOpen}
          onClick={onToggleInspector}
        >
          <SourcesIcon width={17} height={17} />
          {sourceCount > 0 && !inspectorOpen && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />}
        </IconButton>

        <IconButton label="New chat" keys={`${modKey} ⇧ O`} tooltipSide="bottom" size="sm" onClick={onNew}>
          <ComposeIcon width={17} height={17} />
        </IconButton>
      </div>
    </header>
  );
}
