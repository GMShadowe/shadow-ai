import { useEffect, useRef, useState } from "react";
import { CloseIcon, DownloadIcon, MicIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { useDismiss } from "@/hooks/useDismiss";
import { useExit } from "@/hooks/useExit";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { dayGroup } from "@/lib/format";
import type { Conversation, ExportFormat, SearchHit } from "@/types";

/* The matched words, marked, so a result shows why it matched. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (q.length < 2) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded-[3px] bg-phosphor/20 px-px text-ink">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/* Markdown or JSON, asked for the moment the arrow is clicked. */
function ExportMenu({ onExport, onClose, leaving }: { onExport: (f: ExportFormat) => void; onClose: () => void; leaving: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, true, onClose);
  const formats: [ExportFormat, string, string][] = [
    ["md", "Markdown", "Reads as text"],
    ["json", "JSON", "Everything stored"],
  ];

  return (
    <div
      ref={ref}
      className={`${
        leaving ? "animate-pop-out pointer-events-none" : "animate-pop"
      } absolute right-1 top-full z-30 mt-1 w-40 origin-top-right overflow-hidden rounded-xl border border-line bg-panel shadow-[0_16px_48px_-20px_var(--shadow-color)]`}
    >
      {formats.map(([fmt, label, hint]) => (
        <button
          key={fmt}
          type="button"
          onClick={() => {
            onClose();
            onExport(fmt);
          }}
          className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors duration-150 hover:bg-ink/[0.05]"
        >
          <span className="text-sm text-ink">{label}</span>
          <span className="text-[11px] text-ink-muted">{hint}</span>
        </button>
      ))}
    </div>
  );
}

interface ItemProps {
  conv: Conversation;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string, format: ExportFormat) => void;
}

function ConversationItem({ conv, active, onSelect, onRename, onDelete, onExport }: ItemProps) {
  const [exporting, setExporting] = useState(false);
  const exportMenu = useExit(exporting);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(conv.title);

  useEffect(() => setTitle(conv.title), [conv.title]);

  function commit() {
    setEditing(false);
    const next = title.trim();
    if (next && next !== conv.title) onRename(conv.id, next);
    else setTitle(conv.title);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={title}
        aria-label="Chat title"
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setTitle(conv.title);
            setEditing(false);
          }
        }}
        className="w-full rounded-lg border border-signal bg-panel-alt px-2.5 py-1.5 text-base text-ink focus:outline-none sm:text-sm"
      />
    );
  }

  // Row hovers are high-frequency, so they change colour only, instantly.
  const actionBtn =
    "rounded-md p-1 text-ink-muted transition-[color,scale] duration-150 ease-smooth hover:text-ink active:scale-[0.96]";

  return (
    <div
      className={`group relative flex items-center rounded-lg ${
        active ? "bg-ink/[0.08]" : "hover:bg-ink/[0.05]"
      }`}
    >
      {active && <span aria-hidden="true" className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-phosphor" />}
      <button
        type="button"
        onClick={() => onSelect(conv.id)}
        onDoubleClick={() => conv.saved && setEditing(true)}
        aria-current={active ? "true" : undefined}
        className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] focus-visible:outline-offset-[-2px] ${
          active ? "text-ink" : "text-ink/75 group-hover:text-ink"
        } ${conv.saved ? (exporting ? "pr-[5.25rem]" : "group-hover:pr-[5.25rem] group-has-[:focus-visible]:pr-[5.25rem]") : ""}`}
      >
        {conv.voice && <MicIcon width={12} height={12} role="img" aria-label="Used voice mode" className="shrink-0 text-ink-muted" />}
        <span className="min-w-0 truncate" title={conv.title}>
          {conv.title}
        </span>
      </button>
      {conv.saved && (
        <div
          className={`absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 ${
            exporting ? "opacity-100" : "opacity-0"
          }`}
        >
          <button type="button" onClick={() => setEditing(true)} title="Rename" aria-label="Rename chat" className={actionBtn}>
            <PencilIcon width={12} height={12} />
          </button>
          <button
            type="button"
            onClick={() => setExporting((e) => !e)}
            title="Export"
            aria-label="Export chat"
            aria-expanded={exporting}
            className={actionBtn}
          >
            <DownloadIcon width={12} height={12} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(conv.id)}
            title="Delete"
            aria-label="Delete chat"
            className={`${actionBtn} hover:!text-danger`}
          >
            <TrashIcon width={12} height={12} />
          </button>
        </div>
      )}
      {exportMenu.mounted && (
        <ExportMenu leaving={exportMenu.leaving} onClose={() => setExporting(false)} onExport={(fmt) => onExport(conv.id, fmt)} />
      )}
    </div>
  );
}

function SearchResults({
  query,
  results,
  error,
  activeId,
  onSelect,
}: {
  query: string;
  results: SearchHit[] | null;
  error: string | null;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  if (error) return <div className="px-2.5 py-2 text-xs text-danger">{error}</div>;
  if (query.trim().length < 2) return <div className="px-2.5 py-2 text-[12px] text-ink-muted">Type two letters or more.</div>;
  if (results === null) return <div className="shimmer wait-to-show px-2.5 py-2 text-xs">Searching</div>;
  if (results.length === 0) {
    return <div className="px-2.5 py-2 text-xs text-ink-muted">Nothing matches “{query.trim()}”.</div>;
  }

  return (
    <ul className="animate-fade space-y-px">
      {results.map((r) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => onSelect(r.id)}
            className={`w-full rounded-lg px-2.5 py-2 text-left ${r.id === activeId ? "bg-ink/[0.08]" : "hover:bg-ink/[0.05]"}`}
          >
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                <Highlight text={r.title} query={query} />
              </span>
              {r.hits > 0 && <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-muted">{r.hits}</span>}
            </div>
            {r.snippet ? (
              <div className="mt-0.5 line-clamp-2 text-[12px] leading-normal text-ink-muted">
                <span className="font-mono">{r.role === "user" ? "you" : "shadow"}</span> · <Highlight text={r.snippet} query={query} />
              </div>
            ) : (
              <div className="mt-0.5 text-[12px] text-ink-muted">Matches the title</div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

interface HistoryPanelProps {
  open: boolean;
  /** Opened from the keyboard: appear instantly, without the slide. */
  instant: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string, format: ExportFormat) => void;
  onSearch: (query: string) => Promise<{ results: SearchHit[] }>;
}

/* Every chat, grouped by day, searchable by anything said in it. A drawer
   from the right edge, under the History button that opens it. */
export default function HistoryPanel({
  open,
  instant,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  onExport,
  onSearch,
}: HistoryPanelProps) {
  const { mounted, leaving } = useExit(open, instant ? 0 : 260);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searching = query.trim().length >= 2;

  useFocusTrap(panelRef, open && mounted);

  // One frame after mounting, so the slide-in has a start position.
  useEffect(() => {
    if (!mounted) return;
    const id = requestAnimationFrame(() => setShown(open));
    return () => cancelAnimationFrame(id);
  }, [mounted, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Debounced, because every keystroke would otherwise hit SQLite.
  useEffect(() => {
    if (!searching) return;
    let alive = true;
    setResults(null);
    setSearchError(null);
    const timer = setTimeout(() => {
      onSearch(query)
        .then((r) => alive && setResults(r.results ?? []))
        .catch((e) => alive && setSearchError((e as Error).message));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, searching, onSearch]);

  if (!mounted) return null;

  const groups: { label: string; items: Conversation[] }[] = [];
  for (const conv of conversations) {
    const label = conv.saved ? dayGroup(conv.updatedAt) : "Today";
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(conv);
  }

  const visible = shown && !leaving;

  function pick(id: string) {
    onSelect(id);
    setQuery("");
    onClose();
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
      data-instant={instant}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        id="history-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Search chats"
        tabIndex={-1}
        data-instant={instant}
        className={`drawer glass-menu flex max-h-[min(70vh,600px)] w-[min(680px,100%)] flex-col overflow-hidden rounded-2xl focus:outline-none ${
          visible ? "scale-100 opacity-100" : "scale-[0.97] opacity-0"
        }`}
      >
        <div className="flex h-14 items-center justify-between pl-4 pr-2">
          <h2 className="text-[15px] font-medium text-ink">Search chats</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                onNew();
                onClose();
              }}
              title="New chat"
              aria-label="New chat"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-[background-color,color,scale] duration-150 ease-smooth hover:bg-ink/[0.06] hover:text-ink active:scale-[0.96]"
            >
              <PlusIcon width={16} height={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              aria-label="Close history"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition-[background-color,color,scale] duration-150 ease-smooth hover:bg-ink/[0.06] hover:text-ink active:scale-[0.96]"
            >
              <CloseIcon width={15} height={15} />
            </button>
          </div>
        </div>

        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-xl border border-line bg-ink/[0.03] px-3 py-2 transition-colors duration-150 focus-within:border-ink/20">
            <SearchIcon width={14} height={14} className="shrink-0 text-ink-muted" />
            <input
              data-autofocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  setQuery("");
                }
              }}
              placeholder="Search chats"
              aria-label="Search chats"
              className="min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-muted focus:outline-none sm:text-[13px]"
            />
            {searching && results === null && !searchError && <span className="spinner shrink-0" aria-hidden="true" />}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 [mask-image:linear-gradient(to_bottom,transparent,#000_12px)]">
          {query.trim() ? (
            <SearchResults query={query} results={results} error={searchError} activeId={activeId} onSelect={pick} />
          ) : (
            groups.map((g) => (
              <section key={g.label} className="mt-4 first:mt-2">
                <h3 className="flex items-baseline justify-between px-2.5 pb-1.5 text-[12.5px] font-medium text-ink-faint">
                  {g.label}
                  <span className="tabular-nums font-normal">{g.items.length}</span>
                </h3>
                <ul className="space-y-px">
                  {g.items.map((c) => (
                    <li key={c.id}>
                      <ConversationItem
                        conv={c}
                        active={c.id === activeId}
                        onSelect={pick}
                        onRename={onRename}
                        onDelete={onDelete}
                        onExport={onExport}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
