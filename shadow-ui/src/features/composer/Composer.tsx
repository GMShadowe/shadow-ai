import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import { ArrowUpIcon, CloseIcon, DeepSearchIcon, GlobeIcon, GlobeOffIcon, ImageIcon, MicIcon, SkillsIcon, StopIcon, VideoIcon } from "@/components/icons";
import IconButton from "@/components/ui/IconButton";
import Tooltip from "@/components/ui/Tooltip";
import { fileToImage } from "@/lib/images";
import type { ImageAttachment, Skill } from "@/types";
import PlusMenu from "./PlusMenu";
import SkillMenu from "./SkillMenu";

const MAX_IMAGES = 4;
const MAX_HEIGHT = 216; // nine lines, then it scrolls

/* A skill is invoked by typing "/name" as the first thing in the message.
   The menu is open while that first word is still being typed. */
const SLASH = /^\/([a-z0-9_-]*)$/i;
const TYPED_SKILL = /^\/([a-z0-9_-]+)(\s+|$)/i;

function matchSkills(skills: Skill[], query: string) {
  const q = query.toLowerCase();
  if (!q) return skills;
  return skills.filter((s) => s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q));
}

export interface ComposerHandle {
  focus: () => void;
  /** Put text in the box (a starter), cursor at the end. */
  insert: (text: string) => void;
  /** Attach a skill to the next message, as picking it from the menu does. */
  pickSkill: (skill: Skill) => void;
}

interface ComposerProps {
  ref?: Ref<ComposerHandle>;
  onSend: (text: string, images: ImageAttachment[], skill: string | null) => void;
  onStop: () => void;
  onTyping?: () => void;
  onValueChange?: (hasText: boolean) => void;
  streaming: boolean;
  disabled: boolean;
  canAttach: boolean;
  skills?: Skill[];
  offline: boolean;
  onToggleOffline: () => void;
  onOpenVoice: () => void;
  /** The model and effort picker, on the right of the controls row. */
  picker?: ReactNode;
  /** Who answers; named in the empty box. */
  assistantName?: string;
  /** Deep search was switched on: the app raises effort so there are steps to read several pages. */
  onDeepSearch?: () => void;
  /** Your recent messages, newest first: ↑ and ↓ in the box step through them. */
  history?: string[];
}

/* The prompt bar: one rounded field (20px radius) with the text on top and
   a row of controls under it - attach, web tools and skills on the left;
   the model, the microphone and the round send button on the right. The
   send button turns into stop while a reply streams, and its icon
   cross-fades between the two jobs. */
export default function Composer({
  ref,
  onSend,
  onStop,
  onTyping,
  onValueChange,
  streaming,
  disabled,
  canAttach,
  skills = [],
  offline,
  onToggleOffline,
  onOpenVoice,
  picker,
  assistantName = "Shadow",
  onDeepSearch,
  history = [],
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // The skill picked for the next message; cleared on send.
  const [skill, setSkill] = useState<Skill | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuClosed, setMenuClosed] = useState(false);
  // Deep search: the next message goes out as a thorough, cited web search.
  const [deep, setDeep] = useState(false);
  // Which earlier message ↑ has brought back (0 = the last one), or -1.
  const [recall, setRecall] = useState(-1);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function change(next: string) {
    setValue(next);
    onValueChange?.(next.trim().length > 0);
  }

  useImperativeHandle(ref, () => ({
    focus: () => textRef.current?.focus(),
    insert: (text: string) => {
      change(text);
      requestAnimationFrame(() => {
        const el = textRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(text.length, text.length);
      });
    },
    pickSkill: (picked: Skill) => {
      setSkill(picked);
      textRef.current?.focus();
    },
  }));

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + "px";
  }, [value]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function addFiles(list: FileList | File[]) {
    const all = [...list];
    const files = all.filter((f) => f.type.startsWith("image/"));
    const rejected = all.length - files.length;
    if (files.length === 0) {
      if (rejected > 0) setNotice("Only images can be attached.");
      return;
    }
    if (!canAttach) {
      setNotice("This model can't see images. Pick a different one in the model menu.");
      return;
    }
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setNotice(`You can attach up to ${MAX_IMAGES} images.`);
      return;
    }
    try {
      const added = await Promise.all(files.slice(0, room).map(fileToImage));
      setImages((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
      if (rejected > 0) setNotice(`${rejected} file(s) weren't images, so they were left out.`);
      else if (files.length > room) setNotice(`Only the first ${room} image(s) fit.`);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  const slash = SLASH.exec(value);
  const query = slash ? slash[1] : "";
  const matches = slash ? matchSkills(skills, query) : [];
  const menuOpen = !!slash && !menuClosed && !disabled;
  const index = Math.min(menuIndex, Math.max(0, matches.length - 1));

  function pickSkill(picked: Skill) {
    setSkill(picked);
    change("");
    setMenuIndex(0);
    textRef.current?.focus();
  }

  const hasContent = value.trim().length > 0 || images.length > 0;
  const canSend = !disabled && !streaming && hasContent;

  function submit() {
    if (!canSend) return;
    // "/summarize notes.md" typed straight through counts as picking it.
    let text = value.trim();
    let name = skill?.name ?? null;
    const typed = TYPED_SKILL.exec(text);
    if (typed) {
      const found = skills.find((s) => s.name.toLowerCase() === typed[1].toLowerCase());
      if (found) {
        name = found.name;
        text = text.slice(typed[0].length).trim();
      }
    }
    if (!text && images.length === 0) return;
    // Worded so the router sends it to research, and the model reads widely.
    if (deep) text = `Search the web thoroughly for this, read several sources and cite each one: ${text}`;
    onSend(text, images, name);
    change("");
    setImages([]);
    setSkill(null);
    setDeep(false);
    setRecall(-1);
  }

  // The main button's job right now.
  const job: "stop" | "send" = streaming ? "stop" : "send";
  const jobLabel = job === "stop" ? "Stop the reply" : "Send";

  return (
    <div className="px-4 pb-2">
      <div className="mx-auto max-w-[48rem]">
        <div
          onDragOver={(e) => {
            if ([...e.dataTransfer.types].includes("Files")) {
              e.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`composer-shell relative rounded-2xl bg-composer p-2 ${disabled ? "opacity-60" : ""}`}
        >
          {menuOpen && <SkillMenu skills={matches} index={index} query={query} onPick={pickSkill} onHover={setMenuIndex} />}

          {dragging && (
            <div className="animate-fade pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-ink/30 bg-composer/95 text-[14px] text-ink">
              Drop images here
            </div>
          )}

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1.5 pb-1 pt-1">
              {images.map((img, i) => (
                <div
                  key={img.id}
                  className="animate-pop group relative h-14 w-14 overflow-hidden rounded-2xl"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <img src={img.dataUrl} alt="Attached" className="content-img h-full w-full rounded-2xl object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((x) => x.id !== img.id))}
                    aria-label="Remove image"
                    className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/75 text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <CloseIcon width={11} height={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {deep && (
            <div className="flex items-center gap-2 px-1.5 pt-1">
              <span className="animate-pop flex items-center gap-1.5 rounded-full bg-glow-b py-1 pl-2.5 pr-1.5 text-[13px] font-medium text-bubble-ink">
                <DeepSearchIcon width={13} height={13} />
                Deep search
                <button
                  type="button"
                  onClick={() => {
                    setDeep(false);
                    textRef.current?.focus();
                  }}
                  aria-label="Turn deep search off"
                  className="grid h-4 w-4 place-items-center rounded-full hover:bg-bubble-ink/15"
                >
                  <CloseIcon width={10} height={10} />
                </button>
              </span>
              <span className="truncate text-[12px] text-ink-faint">Searches the web, reads several sources, cites them</span>
            </div>
          )}

          {skill && (
            <div className="flex flex-wrap items-center gap-2 px-1.5 pt-1">
              <span className="animate-pop flex items-center gap-1.5 rounded-full bg-signal/15 py-1 pl-2.5 pr-1.5 text-[13px] text-signal">
                /{skill.name}
                <button
                  type="button"
                  onClick={() => {
                    setSkill(null);
                    textRef.current?.focus();
                  }}
                  aria-label={`Don't use the ${skill.name} skill`}
                  className="grid h-4 w-4 place-items-center rounded-full hover:bg-signal/20"
                >
                  <CloseIcon width={10} height={10} />
                </button>
              </span>
              <span className="truncate text-[12px] text-ink-faint">{skill.description}</span>
            </div>
          )}

          <textarea
            ref={textRef}
            rows={1}
            value={value}
            disabled={disabled}
            aria-label="Message"
            aria-controls={menuOpen ? "skill-menu" : undefined}
            aria-activedescendant={menuOpen && matches[index] ? `skill-${matches[index].name}` : undefined}
            onChange={(e) => {
              change(e.target.value);
              if (e.target.value.trim()) onTyping?.();
              setMenuClosed(false);
              setMenuIndex(0);
              setRecall(-1); // typing makes it your own text again
            }}
            onKeyDown={(e) => {
              if (menuOpen && matches.length > 0 && ["ArrowDown", "ArrowUp", "Tab"].includes(e.key)) {
                e.preventDefault();
                const step = e.key === "ArrowUp" ? matches.length - 1 : 1;
                setMenuIndex((i) => (Math.min(i, matches.length - 1) + step) % matches.length);
                return;
              }
              // ↑ in an empty box (or while stepping back) brings back your
              // earlier messages, newest first; ↓ goes forward, then empty.
              const el = e.currentTarget;
              // A one-line message steps on every arrow; a longer one only from its first / last line.
              const oneLine = !el.value.includes("\n");
              const atStart = oneLine || (el.selectionStart === 0 && el.selectionEnd === 0);
              const atEnd = oneLine || el.selectionStart === el.value.length;
              if (e.key === "ArrowUp" && history.length && (value === "" || (recall >= 0 && atStart))) {
                const next = Math.min(recall + 1, history.length - 1);
                if (next !== recall) {
                  e.preventDefault();
                  setRecall(next);
                  change(history[next]);
                }
                return;
              }
              if (e.key === "ArrowDown" && recall >= 0 && atEnd) {
                e.preventDefault();
                const next = recall - 1;
                setRecall(next);
                change(next < 0 ? "" : history[next]);
                return;
              }
              if (e.key === "Escape" && recall >= 0) {
                e.preventDefault();
                setRecall(-1);
                change("");
                return;
              }
              if (e.key === "Escape" && menuOpen) {
                e.preventDefault();
                setMenuClosed(true);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (menuOpen && matches.length > 0) pickSkill(matches[index]);
                else submit();
              }
              if (e.key === "Backspace" && !value && skill) setSkill(null);
            }}
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.some((f) => f.type.startsWith("image/"))) {
                e.preventDefault();
                addFiles(files);
              }
            }}
            placeholder={disabled ? "Waiting for Shadow…" : deep ? "What should Shadow dig into?" : skill ? `What should ${skill.name} work on?` : `Message ${assistantName}`}
            className="block max-h-[216px] w-full resize-none bg-transparent px-2.5 pb-2 pt-2 text-base leading-6 text-ink placeholder:text-ink-faint focus:outline-none disabled:cursor-not-allowed"
          />

          <div className="flex items-center gap-1 pt-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <PlusMenu
              disabled={disabled}
              items={[
                {
                  id: "photos",
                  label: "Photos",
                  hint: canAttach ? "Attach, or paste and drop them in" : "This model can't see images",
                  icon: ImageIcon,
                  tone: "bg-signal/15 text-signal",
                  disabled: !canAttach,
                  onPick: () => fileRef.current?.click(),
                },
                {
                  id: "deep",
                  label: deep ? "Deep search is on" : "Deep search",
                  hint: offline ? "Web tools are blocked (offline)" : "Reads several sources, cites them",
                  icon: DeepSearchIcon,
                  tone: "bg-glow-b text-bubble-ink",
                  disabled: offline,
                  onPick: () => {
                    setDeep((d) => !d);
                    if (!deep) onDeepSearch?.();
                    textRef.current?.focus();
                  },
                },
                ...(skills.length
                  ? [
                      {
                        id: "skill",
                        label: "Use a skill",
                        hint: `${skills.length} installed · or type /`,
                        icon: SkillsIcon,
                        tone: "bg-ink text-bg",
                        onPick: () => {
                          if (!value) change("/");
                          setMenuClosed(false);
                          textRef.current?.focus();
                        },
                      },
                    ]
                  : []),
                { id: "voice", label: "Voice mode", hint: "Talk instead of typing", icon: MicIcon, tone: "bg-ok/15 text-ok", onPick: onOpenVoice },
                { id: "image", label: "Create image", hint: "Needs an image model", icon: ImageIcon, tone: "", disabled: true, tag: "soon" },
                { id: "video", label: "Create video", hint: "Needs a video model", icon: VideoIcon, tone: "", disabled: true, tag: "soon" },
              ]}
            />

            <Tooltip label={offline ? "Offline: web tools are blocked" : "Web tools are allowed"} keys={offline ? "click to allow" : "click to block"}>
              {(describe) => (
                <button
                  type="button"
                  onClick={onToggleOffline}
                  aria-pressed={!offline}
                  aria-label={offline ? "Allow web tools" : "Block web tools (offline mode)"}
                  {...describe}
                  className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13.5px] transition-[background-color,color,scale] duration-150 ease-smooth active:scale-[0.96] ${
                    offline ? "bg-danger/10 text-danger hover:bg-danger/15" : "text-ink-muted hover:bg-ink/[0.07] hover:text-ink"
                  }`}
                >
                  {offline ? <GlobeOffIcon width={16} height={16} /> : <GlobeIcon width={16} height={16} />}
                  {offline ? "Offline" : "Web"}
                </button>
              )}
            </Tooltip>

            {skills.length > 0 && (
              <IconButton
                label="Skills"
                keys="/"
                size="sm"
                active={menuOpen}
                disabled={disabled}
                onClick={() => {
                  // Same as typing "/": opens the skill menu in the box.
                  if (!value) change("/");
                  setMenuClosed(false);
                  textRef.current?.focus();
                }}
                className="relative"
              >
                <SkillsIcon width={17} height={17} />
                {skill && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-tone-yellow" aria-hidden="true" />}
              </IconButton>
            )}

            <div className="ml-auto flex items-center gap-1">
              {picker}
              {value.length > 280 && (
                <span className="animate-fade mr-1 font-mono text-[11px] tabular-nums text-ink-faint">{value.length.toLocaleString()}</span>
              )}
              <IconButton label="Voice mode" size="sm" onClick={onOpenVoice}>
                <MicIcon width={17} height={17} />
              </IconButton>
              <Tooltip label={jobLabel} keys={job === "send" ? "↵" : undefined}>
                {(describe) => (
                  <button
                    type="button"
                    onClick={job === "stop" ? onStop : submit}
                    disabled={job === "send" && !canSend}
                    aria-label={jobLabel}
                    {...describe}
                    className={`relative ml-0.5 grid h-8 w-8 place-items-center rounded-[10px] transition-[background-color,color,opacity,scale] duration-150 ease-smooth enabled:active:scale-[0.96] ${
                      job === "stop" ? "bg-ink text-bg enabled:hover:opacity-85" : "bg-signal text-bg enabled:hover:opacity-90 disabled:bg-ink/15 disabled:text-ink-faint"
                    }`}
                  >
                    <ArrowUpIcon width={18} height={18} strokeWidth={2.25} className="swap-icon absolute" data-on={job === "send"} />
                    <StopIcon width={12} height={12} className="swap-icon absolute" data-on={job === "stop"} />
                  </button>
                )}
              </Tooltip>
            </div>
          </div>
        </div>

        {notice && (
          <p role="status" className="animate-fade mt-2 text-center text-[12px] text-danger">
            {notice}
          </p>
        )}
        {/* Key hints, quiet, on a wide window only. */}
        <p className="mt-1.5 hidden justify-end gap-3 px-2 font-mono text-[10.5px] text-ink-faint/80 md:flex" aria-hidden="true">
          {recall >= 0 ? (
            <span className="text-signal">
              earlier message {recall + 1} of {history.length} · ↑↓ step · esc clear
            </span>
          ) : (
            history.length > 0 && <span>↑ earlier messages</span>
          )}
          <span>↵ send</span>
          <span>⇧ ↵ new line</span>
          <span>/ skills</span>
        </p>
      </div>
    </div>
  );
}
