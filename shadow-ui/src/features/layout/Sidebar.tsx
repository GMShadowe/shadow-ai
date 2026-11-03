import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  AppearanceIcon,
  AssistantIcon,
  ChevronIcon,
  ComposeIcon,
  DotsIcon,
  DownloadIcon,
  GearIcon,
  LogoMark,
  MicIcon,
  PencilIcon,
  SearchIcon,
  SidebarIcon,
  TrashIcon,
  type IconProps,
} from "@/components/icons";
import IconButton from "@/components/ui/IconButton";
import { useDismiss } from "@/hooks/useDismiss";
import { useExit } from "@/hooks/useExit";
import { dayGroup, modKey } from "@/lib/format";
import type { Conversation, ExportFormat } from "@/types";

/* One sidebar, two widths. Collapsed it is a 56px column of icons; open it
   is 260px with labels, every chat by day, and who is answering. The button
   in its header (or ⌘/Ctrl B) keeps it open or closed. While it is closed,
   hovering it - or tabbing into it - opens it over the chat without pushing
   the conversation aside, and it folds away again when the pointer or focus
   leaves. Icons never move between the two states: every row keeps a 40px
   icon box at the same x, and only the words fade. */

/** A row of the sidebar: an icon box that stays put, and a label that fades with the width. */
function NavRow({
  icon: Icon,
  label,
  keys,
  onClick,
  active,
  expanded,
}: {
  icon: ComponentType<IconProps>;
  label: string;
  keys?: string;
  onClick: () => void;
  active?: boolean;
  expanded: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`group flex h-9 w-full items-center overflow-hidden rounded-[10px] text-left text-[14px] text-ink transition-[background-color] duration-100 focus-visible:outline-offset-[-2px] ${
        active ? "bg-ink/[0.1]" : "hover:bg-ink/[0.06]"
      }`}
    >
      <span className="grid h-9 w-10 shrink-0 place-items-center">
        <Icon width={18} height={18} />
      </span>
      <span className={`sidebar-label flex min-w-0 flex-1 items-center pr-2.5 ${expanded ? "" : "is-hidden"}`} aria-hidden="true">
        <span className="flex-1 truncate">{label}</span>
        {keys && (
          <span className="font-mono text-[11px] text-ink-faint opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100">
            {keys}
          </span>
        )}
      </span>
    </button>
  );
}

function ChatMenu({
  onRename,
  onExport,
  onDelete,
  onClose,
  leaving,
}: {
  onRename: () => void;
  onExport: (f: ExportFormat) => void;
  onDelete: () => void;
  onClose: () => void;
  leaving: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, true, onClose);
  const item =
    "flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[14px] transition-colors duration-100 hover:bg-ink/[0.07]";
  return (
    <div
      ref={ref}
      role="menu"
      className={`${leaving ? "animate-pop-out pointer-events-none" : "animate-pop"} glass-menu absolute right-0 top-full z-40 mt-1 w-48 origin-top-right rounded-2xl p-1.5`}
    >
      <button type="button" role="menuitem" className={`${item} text-ink`} onClick={onRename}>
        <PencilIcon width={16} height={16} /> Rename
      </button>
      <button type="button" role="menuitem" className={`${item} text-ink`} onClick={() => onExport("md")}>
        <DownloadIcon width={16} height={16} /> Export as Markdown
      </button>
      <button type="button" role="menuitem" className={`${item} text-ink`} onClick={() => onExport("json")}>
        <DownloadIcon width={16} height={16} /> Export as JSON
      </button>
      <div className="mx-2.5 my-1 h-px bg-line" />
      <button type="button" role="menuitem" className={`${item} text-danger`} onClick={onDelete}>
        <TrashIcon width={16} height={16} /> Delete
      </button>
    </div>
  );
}

function ChatRow({
  conv,
  active,
  onSelect,
  onRename,
  onDelete,
  onExport,
}: {
  conv: Conversation;
  active: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string, f: ExportFormat) => void;
}) {
  const [menu, setMenu] = useState(false);
  const menuExit = useExit(menu);
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
        className="h-[34px] w-full rounded-lg border border-signal/70 bg-bg px-2.5 text-base text-ink focus:outline-none sm:text-[14px]"
      />
    );
  }

  return (
    <div className={`group relative flex h-[34px] items-center rounded-lg transition-colors duration-100 ${active ? "bg-ink/[0.09]" : menu ? "bg-ink/[0.06]" : "hover:bg-ink/[0.06]"}`}>
      <button
        type="button"
        onClick={() => onSelect(conv.id)}
        onDoubleClick={() => conv.saved && setEditing(true)}
        aria-current={active ? "true" : undefined}
        title={conv.title}
        className={`flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg pl-2.5 pr-8 text-left text-[14px] focus-visible:outline-offset-[-2px] ${active ? "text-ink" : "text-ink/85"}`}
      >
        {conv.voice && <MicIcon width={13} height={13} aria-label="Used voice mode" className="shrink-0 text-ink-faint" />}
        {/* Long titles fade out instead of cutting at an ellipsis. */}
        <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap [mask-image:linear-gradient(to_right,#000_80%,transparent)]">
          {conv.title}
        </span>
      </button>
      {conv.saved && (
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-label={`Options for ${conv.title}`}
          aria-haspopup="menu"
          aria-expanded={menu}
          className={`absolute right-1 grid h-7 w-7 place-items-center rounded-md text-ink-muted transition-[opacity,color] duration-100 hover:text-ink focus-visible:opacity-100 ${
            active || menu ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <DotsIcon width={16} height={16} />
        </button>
      )}
      {menuExit.mounted && (
        <ChatMenu
          leaving={menuExit.leaving}
          onClose={() => setMenu(false)}
          onRename={() => {
            setMenu(false);
            setEditing(true);
          }}
          onExport={(f) => {
            setMenu(false);
            onExport(conv.id, f);
          }}
          onDelete={() => {
            setMenu(false);
            onDelete(conv.id);
          }}
        />
      )}
    </div>
  );
}

/* The menu over the profile row: who is answering and on what, then
   settings. It grows up out of the row, from its bottom-left corner. */
function ProfileMenu({
  assistantName,
  modelLabel,
  status,
  dot,
  leaving,
  onClose,
  onSettings,
  onAppearance,
  onAssistants,
}: {
  assistantName: string;
  modelLabel?: string;
  status: string;
  dot: string;
  leaving: boolean;
  onClose: () => void;
  onSettings: () => void;
  onAppearance: () => void;
  onAssistants: () => void;
}) {
  const item =
    "flex h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[13.5px] text-ink transition-colors duration-100 hover:bg-ink/[0.07]";
  const pick = (fn: () => void) => () => {
    onClose();
    fn();
  };
  return (
    <div
      role="menu"
      aria-label="Profile"
      className={`${leaving ? "animate-pop-out pointer-events-none" : "animate-pop"} glass-menu absolute bottom-full left-2 z-40 mb-1 w-60 origin-bottom-left rounded-xl p-1.5`}
    >
      <div className="flex items-center gap-2.5 px-2 pb-2 pt-1.5">
        <Avatar name={assistantName} dot={dot} small />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium text-ink">{assistantName}</div>
          <div className="truncate text-[12px] text-ink-faint">{[modelLabel, status].filter(Boolean).join(" · ")}</div>
        </div>
      </div>
      <div className="mx-1 mb-1 h-px bg-line" />
      <button type="button" role="menuitem" className={item} onClick={pick(onAssistants)}>
        <AssistantIcon width={16} height={16} className="text-ink-muted" />
        <span className="flex-1">Switch assistant</span>
      </button>
      <button type="button" role="menuitem" className={item} onClick={pick(onAppearance)}>
        <AppearanceIcon width={16} height={16} className="text-ink-muted" />
        <span className="flex-1">Appearance</span>
      </button>
      <button type="button" role="menuitem" className={item} onClick={pick(onSettings)}>
        <GearIcon width={16} height={16} className="text-ink-muted" />
        <span className="flex-1">Settings</span>
        <span className="font-mono text-[11px] text-ink-faint">{modKey} ,</span>
      </button>
    </div>
  );
}

function Avatar({ name, dot, small = false }: { name: string; dot: string; small?: boolean }) {
  return (
    <span
      className={`relative grid shrink-0 place-items-center rounded-full bg-signal font-semibold text-bubble-ink ${
        small ? "h-7 w-7 text-[12px]" : "h-8 w-8 text-[13px]"
      }`}
    >
      {(name || "S").slice(0, 1).toUpperCase()}
      <span className={`absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full ring-2 ring-sidebar ${dot}`} />
    </span>
  );
}

interface SidebarProps {
  conversations: Conversation[];
  activeId: string;
  voiceOpen: boolean;
  assistantName: string;
  modelLabel?: string;
  connected: boolean;
  sending: boolean;
  /** Kept open by the button (it then takes room from the chat) or not. */
  pinned: boolean;
  /** Ctrl+B: change state without the slide. */
  instant: boolean;
  onTogglePin: () => void;
  onNew: () => void;
  /** The logo: back to "/" with a fresh chat. */
  onHome: () => void;
  onSearch: () => void;
  onVoice: () => void;
  onAssistants: () => void;
  onSettings: (section?: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string, f: ExportFormat) => void;
}

const OPEN_DELAY = 140;
const CLOSE_DELAY = 260;

export default function Sidebar({
  conversations,
  activeId,
  voiceOpen,
  assistantName,
  modelLabel,
  connected,
  sending,
  pinned,
  instant,
  onTogglePin,
  onNew,
  onHome,
  onSearch,
  onVoice,
  onAssistants,
  onSettings,
  onSelect,
  onRename,
  onDelete,
  onExport,
}: SidebarProps) {
  const [peek, setPeek] = useState(false);
  const [profile, setProfile] = useState(false);
  const profileExit = useExit(profile);
  const asideRef = useRef<HTMLElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useDismiss(profileRef, profile, () => setProfile(false));
  const expanded = pinned || peek;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function togglePin() {
    if (timer.current) clearTimeout(timer.current);
    setPeek(false); // the button's state is what you see afterwards
    onTogglePin();
  }

  function schedule(open: boolean) {
    if (timer.current) clearTimeout(timer.current);
    if (pinned) return;
    timer.current = setTimeout(
      () => {
        if (!open) {
          const el = asideRef.current;
          const active = document.activeElement;
          const typing = !!el && el.contains(active) && active?.tagName === "INPUT";
          if (typing || profile) return; // renaming a chat, or the profile menu is open
        }
        setPeek(open);
      },
      open ? OPEN_DELAY : CLOSE_DELAY,
    );
  }

  // Picking something while peeking folds the sidebar away again.
  function done<T extends unknown[]>(fn: (...args: T) => void) {
    return (...args: T) => {
      fn(...args);
      if (!pinned) {
        if (timer.current) clearTimeout(timer.current);
        setPeek(false);
      }
    };
  }

  const groups: { label: string; items: Conversation[] }[] = [];
  for (const conv of conversations) {
    if (!conv.saved && conv.messages?.length === 0) continue; // an empty new chat isn't history yet
    const label = conv.saved ? dayGroup(conv.updatedAt) : "Today";
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, items: [] };
      groups.push(group);
    }
    group.items.push(conv);
  }

  const status = !connected ? "Brain offline" : sending ? "Sends out" : "Running locally";
  const dot = !connected ? "animate-pulse bg-danger" : sending ? "bg-danger" : "bg-ok";

  return (
    // The slot holds the sidebar's place in the layout: 260px when kept
    // open, 56px otherwise. A peek widens the sidebar over the chat, not the slot.
    <div className="sidebar-slot relative z-40 h-full shrink-0" data-pinned={pinned} data-instant={instant}>
      <aside
        ref={asideRef}
        aria-label="Sidebar"
        data-expanded={expanded}
        data-peek={peek && !pinned}
        data-instant={instant}
        onPointerEnter={(e) => e.pointerType === "mouse" && schedule(true)}
        onPointerLeave={(e) => e.pointerType === "mouse" && schedule(false)}
        onFocus={() => {
          if (pinned) return;
          if (timer.current) clearTimeout(timer.current);
          setPeek(true);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) schedule(false);
        }}
        className="sidebar absolute inset-y-0 left-0 flex flex-col bg-sidebar"
      >
        <div className="flex h-[52px] shrink-0 items-center px-2">
          {/* The logo goes home: "/", a fresh chat. */}
          <a
            href="/"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // let a new tab open
              e.preventDefault();
              done(onHome)();
            }}
            aria-label={`${assistantName}, home`}
            className="group flex h-9 min-w-10 items-center overflow-hidden rounded-[10px] pr-1.5 text-[17px] font-semibold text-ink transition-colors duration-100 hover:bg-ink/[0.06]"
          >
            <span className="grid h-9 w-10 shrink-0 place-items-center">
              <LogoMark width={21} height={21} className="transition-transform duration-300 ease-smooth group-hover:rotate-[20deg]" />
            </span>
            <span className={`sidebar-label truncate ${expanded ? "" : "is-hidden"}`}>{assistantName}</span>
          </a>
          <span className={`sidebar-label ml-auto flex shrink-0 items-center gap-0.5 ${expanded ? "" : "is-hidden w-0 overflow-hidden"}`}>
            <IconButton label="Switch assistant" tooltipSide="bottom" size="sm" onClick={done(onAssistants)} className="!w-7">
              <ChevronIcon width={14} height={14} />
            </IconButton>
            <IconButton
              label={pinned ? "Close sidebar" : "Keep sidebar open"}
              keys={`${modKey} B`}
              tooltipSide="bottom"
              size="sm"
              active={pinned}
              aria-pressed={pinned}
              onClick={togglePin}
            >
              <SidebarIcon width={17} height={17} />
            </IconButton>
          </span>
        </div>

        <nav aria-label="Main" className="shrink-0 space-y-0.5 px-2 pb-1">
          <NavRow icon={ComposeIcon} label="New chat" keys={`${modKey} ⇧ O`} onClick={done(onNew)} expanded={expanded} />
          <NavRow icon={SearchIcon} label="Search chats" keys={`${modKey} K`} onClick={done(onSearch)} expanded={expanded} />
          <NavRow icon={MicIcon} label="Voice mode" onClick={done(onVoice)} expanded={expanded} active={voiceOpen} />
          <NavRow icon={AssistantIcon} label="Assistants" onClick={done(onAssistants)} expanded={expanded} />
        </nav>

        {/* Collapsed, the chat list gives way to empty space; the icons above
            and the profile below stay exactly where they are. */}
        <div
          className={`sidebar-label min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 [mask-image:linear-gradient(to_bottom,transparent,#000_12px,#000_calc(100%-16px),transparent)] ${
            expanded ? "" : "is-hidden"
          }`}
          inert={!expanded}
        >
          {groups.length === 0 ? (
            <p className="whitespace-nowrap px-2.5 pt-4 text-[13px] text-ink-faint">Your chats will show up here.</p>
          ) : (
            groups.map((g) => (
              <section key={g.label} className="pt-4 first:pt-3">
                <h2 className="whitespace-nowrap px-2.5 pb-1 text-[12.5px] font-medium text-ink-faint">{g.label}</h2>
                <ul className="space-y-px">
                  {g.items.map((c) => (
                    <li key={c.id}>
                      <ChatRow
                        conv={c}
                        active={!voiceOpen && c.id === activeId}
                        onSelect={done(onSelect)}
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

        {/* Who is answering, and on what: the profile row opens the profile menu. */}
        <div ref={profileRef} className="relative shrink-0 p-2">
          <button
            type="button"
            onClick={() => setProfile((o) => !o)}
            aria-label={`${assistantName}, ${status}`}
            aria-haspopup="menu"
            aria-expanded={profile}
            className={`flex h-12 w-full items-center overflow-hidden rounded-xl text-left transition-[background-color] duration-100 ${
              profile ? "bg-ink/[0.08]" : "hover:bg-ink/[0.06]"
            }`}
          >
            <span className="grid h-12 w-10 shrink-0 place-items-center">
              <Avatar name={assistantName} dot={dot} />
            </span>
            <span className={`sidebar-label min-w-0 flex-1 pl-1 pr-2 ${expanded ? "" : "is-hidden"}`}>
              <span className="block truncate text-[13.5px] font-medium text-ink">{assistantName}</span>
              <span className="block truncate text-[11.5px] text-ink-faint">{[modelLabel, status].filter(Boolean).join(" · ")}</span>
            </span>
            <DotsIcon width={16} height={16} className={`sidebar-label mr-2.5 shrink-0 text-ink-faint ${expanded ? "" : "is-hidden"}`} />
          </button>
          {profileExit.mounted && (
            <ProfileMenu
              assistantName={assistantName}
              modelLabel={modelLabel}
              status={status}
              dot={dot}
              leaving={profileExit.leaving}
              onClose={() => setProfile(false)}
              onSettings={done(() => onSettings())}
              onAppearance={done(() => onSettings("appearance"))}
              onAssistants={done(onAssistants)}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
