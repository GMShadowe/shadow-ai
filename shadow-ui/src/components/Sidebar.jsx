import { useEffect, useRef, useState } from "react";
import { useExit } from "./ui/useExit.js";
import {
  SlidersIcon,
  PencilIcon,
  TrashIcon,
  PlusIcon,
  SidebarIcon,
  MicIcon,
  SearchIcon,
  CloseIcon,
  DownloadIcon,
  AssistantIcon,
  SwapIcon,
} from "./Icons.jsx";

function groupLabel(iso) {
  if (!iso) return "Today";
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((today - day) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return "Previous 7 days";
  if (days < 30) return "Previous 30 days";
  return "Older";
}

/* Markdown or JSON, asked for the moment the arrow is clicked. Markdown
   first because it is the one people actually read. */
function ExportMenu({ onExport, onClose, leaving }) {
  const ref = useRef(null);

  useEffect(() => {
    function away(e) {
      if (!ref.current?.contains(e.target)) onClose();
    }
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`${
        leaving ? "animate-pop-out pointer-events-none" : "animate-pop"
      } absolute right-1 top-full z-30 mt-1 w-36 origin-top-right overflow-hidden rounded-lg border border-line bg-panel shadow-[0_16px_48px_-20px_rgba(0,0,0,0.8)]`}
    >
      {[
        ["md", "Markdown", "Reads as text"],
        ["json", "JSON", "Everything stored"],
      ].map(([fmt, label, hint]) => (
        <button
          key={fmt}
          type="button"
          onClick={() => {
            onClose();
            onExport(fmt);
          }}
          className="flex w-full flex-col items-start px-3 py-1.5 text-left transition-colors duration-150 hover:bg-panel-alt"
        >
          <span className="text-sm text-ink">{label}</span>
          <span className="text-[11px] text-ink-muted">{hint}</span>
        </button>
      ))}
    </div>
  );
}

function ConversationItem({ conv, active, onSelect, onRename, onDelete, onExport }) {
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
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setTitle(conv.title);
            setEditing(false);
          }
        }}
        className="animate-fade w-full rounded-md border border-signal bg-panel-alt px-2.5 py-1.5 text-sm text-ink focus:outline-none"
      />
    );
  }

  return (
    <div
      className={`group relative flex items-center rounded-md transition-colors duration-150 ${
        active ? "bg-panel-alt" : "hover:bg-panel-alt/60"
      }`}
    >
      <button
        onClick={() => onSelect(conv.id)}
        onDoubleClick={() => conv.saved && setEditing(true)}
        className={`flex min-w-0 flex-1 items-center gap-1.5 px-2.5 py-1.5 text-left text-sm transition-colors duration-150 ${
          active ? "text-ink" : "text-ink/70 group-hover:text-ink"
        }`}
      >
        {conv.voice && (
          <MicIcon width={12} height={12} role="img" aria-label="Used voice mode"
            className="shrink-0 text-ink-muted" />
        )}
        <span className="min-w-0 truncate">{conv.title}</span>
      </button>
      {conv.saved && (
        <div className="flex items-center gap-0.5 pr-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={() => setEditing(true)}
            title="Rename"
            aria-label="Rename chat"
            className="rounded p-1 text-ink-muted transition-[color,transform] duration-150 ease-smooth hover:bg-panel hover:text-ink active:scale-90"
          >
            <PencilIcon width={12} height={12} />
          </button>
          <button
            onClick={() => setExporting((e) => !e)}
            title="Export"
            aria-label="Export chat"
            aria-expanded={exporting}
            className="rounded p-1 text-ink-muted transition-[color,transform] duration-150 ease-smooth hover:bg-panel hover:text-ink active:scale-90"
          >
            <DownloadIcon width={12} height={12} />
          </button>
          <button
            onClick={() => onDelete(conv.id)}
            title="Delete"
            aria-label="Delete chat"
            className="rounded p-1 text-ink-muted transition-[color,transform] duration-150 ease-smooth hover:bg-panel hover:text-danger active:scale-90"
          >
            <TrashIcon width={12} height={12} />
          </button>
        </div>
      )}
      {exportMenu.mounted && (
        <ExportMenu
          leaving={exportMenu.leaving}
          onClose={() => setExporting(false)}
          onExport={(fmt) => onExport(conv.id, fmt)}
        />
      )}
    </div>
  );
}

/* Find an old chat by anything said in it, not just its title. */
function SearchBox({ value, onChange, busy }) {
  return (
    <div className="px-2 pb-2">
      <div className="flex items-center gap-2 rounded-md border border-line bg-panel-alt px-2.5 py-1.5 transition-colors duration-150 focus-within:border-signal/60">
        <SearchIcon width={13} height={13} className="shrink-0 text-ink-muted" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onChange("")}
          placeholder="Search chats"
          aria-label="Search chats"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-muted focus:outline-none"
        />
        {busy && <span className="spinner shrink-0" aria-hidden="true" />}
        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="shrink-0 rounded p-0.5 text-ink-muted transition-colors hover:text-ink"
          >
            <CloseIcon width={11} height={11} />
          </button>
        )}
      </div>
    </div>
  );
}

function SearchResults({ query, results, error, activeId, onSelect }) {
  if (error) return <div className="px-2.5 py-2 text-xs text-danger">{error}</div>;
  if (query.trim().length < 2) {
    return <div className="px-2.5 py-2 text-[11px] text-ink-muted">Type two letters or more.</div>;
  }
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
            className={`w-full rounded-md px-2.5 py-2 text-left transition-colors duration-150 ${
              r.id === activeId ? "bg-panel-alt" : "hover:bg-panel-alt/60"
            }`}
          >
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{r.title}</span>
              {r.hits > 0 && (
                <span className="shrink-0 font-mono text-[10px] text-ink-muted">{r.hits}</span>
              )}
            </div>
            {r.snippet ? (
              <div className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-muted">
                <span className="font-mono">{r.role === "user" ? "you" : "shadow"}</span> · {r.snippet}
              </div>
            ) : (
              <div className="mt-0.5 text-[11px] text-ink-muted">Matches the title</div>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function Sidebar({
  conversations, activeId, onSelect, onNew, onRename, onDelete, onExport, onSearch,
  onOpenSettings, onOpenVoice, connected, collapsed, onToggleCollapse, model,
  assistant, onOpenAssistants,
}) {
  // "Local" was a lie whenever a BYOK model was selected: the header said
  // the conversation was leaving the computer while this said otherwise.
  const sending = !!model?.sends_data;
  const status = !connected ? "Offline" : sending ? "Sending out" : "Local";
  const dot = !connected ? "animate-pulse bg-danger" : sending ? "bg-danger" : "bg-phosphor";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const searching = query.trim().length >= 2;

  // Debounced, because every keystroke would otherwise hit SQLite.
  useEffect(() => {
    if (!searching || !onSearch) return;
    let alive = true;
    setResults(null);
    setSearchError(null);
    const timer = setTimeout(() => {
      onSearch(query)
        .then((r) => alive && setResults(r.results ?? []))
        .catch((e) => alive && setSearchError(e.message));
    }, 200);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, searching, onSearch]);
  const groups = [];
  for (const conv of conversations) {
    const label = conv.saved ? groupLabel(conv.updatedAt) : "Today";
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(conv);
  }

  return (
    <aside
      className="shrink-0 overflow-hidden border-r border-line bg-panel transition-[width] duration-300 ease-smooth"
      style={{ width: collapsed ? "3rem" : "16rem" }}
    >
      {collapsed ? (
        <div className="animate-fade flex h-full w-12 flex-col items-center py-3">
          <button onClick={onToggleCollapse} title="Expand sidebar" aria-label="Expand sidebar"
            className="rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink">
            <SidebarIcon width={16} height={16} />
          </button>
          <button onClick={onOpenAssistants} title={`Assistants — ${assistant?.name ?? "Shadow"}`}
            aria-label="Assistants"
            className="mt-1 rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink active:scale-95">
            <AssistantIcon width={16} height={16} />
          </button>
          <button onClick={onNew} title="New chat" aria-label="New chat"
            className="mt-1 rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink active:scale-95">
            <PlusIcon width={16} height={16} />
          </button>
          <button onClick={onOpenVoice} title="Voice mode" aria-label="Voice mode"
            className="mt-1 rounded-md p-2 text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink active:scale-95">
            <MicIcon width={16} height={16} />
          </button>
          <button onClick={onOpenSettings} title="Settings" aria-label="Settings"
            className="mt-auto rounded-md p-2 transition-colors duration-150 hover:bg-panel-alt">
            <span className="relative block text-ink-muted">
              <SlidersIcon width={16} height={16} />
              <span className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ${dot}`} />
            </span>
          </button>
        </div>
      ) : (
        <div className="animate-fade flex h-full w-64 flex-col">
          <div className="flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <button onClick={onToggleCollapse} title="Collapse sidebar" aria-label="Collapse sidebar"
                className="rounded-md p-1 text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink">
                <SidebarIcon width={15} height={15} />
              </button>
              <span className="font-mono text-sm font-medium tracking-tight">shadow</span>
            </div>
            <button onClick={onNew} title="New chat" aria-label="New chat"
              className="rounded-md p-1.5 text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink active:scale-95">
              <PlusIcon />
            </button>
          </div>

          {/* Which assistant's chats these are. It opens the dashboard
              rather than a menu: switching changes every chat in the list
              below, which is too big a change to happen under the pointer. */}
          <div className="px-2 pb-1">
            <button
              type="button"
              onClick={onOpenAssistants}
              title="Assistants"
              className="group flex w-full items-center gap-2 rounded-md border border-line px-2.5 py-2 text-left transition-colors duration-150 hover:bg-panel-alt"
            >
              <AssistantIcon width={15} height={15} className="shrink-0 text-ink-muted" />
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                {assistant?.name ?? "Shadow"}
              </span>
              <SwapIcon width={13} height={13} className="shrink-0 text-ink-muted transition-colors duration-150 group-hover:text-ink" />
            </button>
          </div>

          <SearchBox value={query} onChange={setQuery} busy={searching && results === null && !searchError} />

          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {query.trim() ? (
              <SearchResults
                query={query}
                results={results}
                error={searchError}
                activeId={activeId}
                onSelect={(id) => {
                  onSelect(id);
                  setQuery("");
                }}
              />
            ) : (
              groups.map((g) => (
                <div key={g.label} className="mt-4 first:mt-1">
                  <div className="px-2.5 pb-1 text-[11px] font-medium text-ink-muted">{g.label}</div>
                  <ul className="space-y-px">
                    {g.items.map((c) => (
                      <li key={c.id}>
                        <ConversationItem conv={c} active={c.id === activeId}
                          onSelect={onSelect} onRename={onRename} onDelete={onDelete}
                          onExport={onExport} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </nav>

          <div className="border-t border-line p-2">
            <button onClick={onOpenVoice}
              className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink/75 transition-colors duration-150 hover:bg-panel-alt hover:text-ink">
              <MicIcon width={15} height={15} className="text-ink-muted transition-colors duration-150 group-hover:text-ink" />
              Voice mode
            </button>
            <button onClick={onOpenSettings}
              className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-ink/75 transition-colors duration-150 hover:bg-panel-alt hover:text-ink">
              <SlidersIcon width={15} height={15} className="text-ink-muted transition-colors duration-150 group-hover:text-ink" />
              Settings
              <span
                className={`ml-auto flex items-center gap-1.5 text-[11px] ${sending ? "text-danger" : "text-ink-muted"}`}
                title={sending ? `${model.label} sends this conversation to ${model.host || "your endpoint"}.` : undefined}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                {status}
              </span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
