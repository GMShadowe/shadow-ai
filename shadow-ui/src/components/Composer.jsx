import { useEffect, useRef, useState } from "react";
import { PaperclipIcon, ArrowUpIcon, CloseIcon, StopIcon } from "./Icons.jsx";
import { fileToImage } from "../images.js";
import RunPicker from "./RunPicker.jsx";
import SkillMenu from "./SkillMenu.jsx";

const MAX_IMAGES = 4;

/* A skill is invoked by typing "/name" as the first thing in the message.
   The menu is open while that first word is still being typed. */
const SLASH = /^\/([a-z0-9_-]*)$/i;

function matchSkills(skills, query) {
  const q = query.toLowerCase();
  if (!q) return skills;
  return skills.filter(
    (s) => s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q)
  );
}

export default function Composer({
  onSend,
  onStop,
  streaming,
  disabled,
  models,
  model,
  onModelChange,
  effort,
  onEffortChange,
  canAttach,
  skills = [],
}) {
  const [value, setValue] = useState("");
  const [images, setImages] = useState([]);
  const [attachError, setAttachError] = useState(null);
  const [dragging, setDragging] = useState(false);
  // Pasting and picking from the file dialog add an image with no gesture
  // attached to it, so the bar acknowledges it the way a drop does.
  const [flash, setFlash] = useState(false);
  // The skill picked for the next message. It applies to that one message
  // and is cleared on send, the same way the brain forgets it after the turn.
  const [skill, setSkill] = useState(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuClosed, setMenuClosed] = useState(false);
  const textRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, [value]);

  useEffect(() => {
    if (!attachError) return;
    const timer = setTimeout(() => setAttachError(null), 4000);
    return () => clearTimeout(timer);
  }, [attachError]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(false), 450);
    return () => clearTimeout(timer);
  }, [flash]);

  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    const rejected = [...fileList].length - files.length;
    if (files.length === 0) {
      if (rejected > 0) setAttachError("Only images can be attached.");
      return;
    }
    if (!canAttach) {
      setAttachError("This model can't see images. Pick a different one in the model menu.");
      return;
    }
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      setAttachError(`You can attach up to ${MAX_IMAGES} images.`);
      return;
    }
    try {
      const added = await Promise.all(files.slice(0, room).map(fileToImage));
      setImages((prev) => [...prev, ...added].slice(0, MAX_IMAGES));
      setFlash(true);
      if (rejected > 0) setAttachError(`${rejected} file(s) weren't images, so they were left out.`);
      else if (files.length > room) setAttachError(`Only the first ${room} image(s) fit.`);
    } catch (e) {
      setAttachError(e.message);
    }
  }

  const slash = SLASH.exec(value);
  const query = slash ? slash[1] : "";
  const matches = slash ? matchSkills(skills, query) : [];
  const menuOpen = !!slash && !menuClosed && !disabled;
  const index = Math.min(menuIndex, Math.max(0, matches.length - 1));

  function pickSkill(picked) {
    setSkill(picked);
    setValue("");
    setMenuIndex(0);
    textRef.current?.focus();
  }

  const canSend = !disabled && !streaming && (value.trim().length > 0 || images.length > 0);

  function submit() {
    if (!canSend) return;
    // "/summarize notes.md" typed straight through counts as picking it.
    let text = value.trim();
    let name = skill?.name ?? null;
    const typed = /^\/([a-z0-9_-]+)(\s+|$)/i.exec(text);
    if (typed) {
      const found = skills.find((s) => s.name.toLowerCase() === typed[1].toLowerCase());
      if (found) {
        name = found.name;
        text = text.slice(typed[0].length).trim();
      }
    }
    if (!text && images.length === 0) return;
    onSend(text, images, name);
    setValue("");
    setImages([]);
    setSkill(null);
  }

  // One border, three live states, in order of how much they matter: a drop
  // in progress, an image just added, the box simply focused.
  const edge = dragging
    ? "border-phosphor ring-2 ring-phosphor/25"
    : flash
      ? "border-phosphor/70 ring-2 ring-phosphor/15"
      : "border-line ring-0 ring-transparent focus-within:border-signal/60 focus-within:ring-1 focus-within:ring-signal/20";

  return (
    <div className="px-4 pb-3 pt-2">
      <div className="mx-auto max-w-3xl">
        <div
          onDragOver={(e) => {
            if ([...e.dataTransfer.types].includes("Files")) {
              e.preventDefault();
              setDragging(true);
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`relative rounded-xl border bg-panel-alt shadow-[0_12px_40px_-18px_rgba(0,0,0,0.7)] transition-[border-color,box-shadow,opacity] duration-200 ease-smooth ${edge} ${
            disabled ? "opacity-60" : ""
          }`}
        >
          {menuOpen && (
            <SkillMenu
              skills={matches}
              index={index}
              query={query}
              onPick={pickSkill}
              onHover={setMenuIndex}
            />
          )}

          {dragging && (
            <div className="animate-rise pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-phosphor/60 bg-panel-alt/95 text-sm font-medium text-phosphor">
              Drop images to attach
            </div>
          )}

          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pt-3">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="animate-pop group relative h-16 w-16 overflow-hidden rounded-lg border border-line transition-colors duration-150 hover:border-signal/50"
                >
                  <img
                    src={img.dataUrl}
                    alt="Attached"
                    className="h-full w-full object-cover transition-transform duration-150 ease-smooth group-hover:scale-105"
                  />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                    title="Remove this image"
                    aria-label="Remove image"
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-0.5 text-white opacity-0 transition-[opacity,transform] duration-150 ease-smooth hover:bg-black/85 active:scale-90 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <CloseIcon width={12} height={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {skill && (
            <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
              <span className="animate-pop flex items-center gap-1.5 rounded-md border border-phosphor-dim/50 bg-phosphor/10 px-2 py-1 font-mono text-[11px] text-ink">
                /{skill.name}
                <button
                  type="button"
                  onClick={() => {
                    setSkill(null);
                    textRef.current?.focus();
                  }}
                  aria-label={`Don't use the ${skill.name} skill`}
                  className="rounded text-ink-muted transition-colors duration-150 hover:text-ink active:scale-90"
                >
                  <CloseIcon width={11} height={11} />
                </button>
              </span>
              <span className="text-[11px] text-ink-muted">{skill.description}</span>
            </div>
          )}

          <textarea
            ref={textRef}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(e) => {
              setValue(e.target.value);
              setMenuClosed(false);
              setMenuIndex(0);
            }}
            onKeyDown={(e) => {
              if (menuOpen && matches.length > 0 && ["ArrowDown", "ArrowUp", "Tab"].includes(e.key)) {
                e.preventDefault();
                const step = e.key === "ArrowUp" ? matches.length - 1 : 1;
                setMenuIndex((i) => (Math.min(i, matches.length - 1) + step) % matches.length);
                return;
              }
              if (e.key === "Escape" && menuOpen) {
                e.preventDefault();
                setMenuClosed(true);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (menuOpen && matches.length > 0) pickSkill(matches[index]);
                else submit();
              }
              // Backspacing into an empty box drops the skill, like a chip.
              if (e.key === "Backspace" && !value && skill) setSkill(null);
            }}
            onPaste={(e) => {
              const files = [...e.clipboardData.files];
              if (files.some((f) => f.type.startsWith("image/"))) {
                e.preventDefault();
                addFiles(files);
              }
            }}
            placeholder={
              disabled
                ? "Waiting for Shadow…"
                : skill
                  ? `What should the ${skill.name} skill work on?`
                  : images.length
                    ? "Ask about the image…"
                    : "Message Shadow…  (/ for skills)"
            }
            /* The height is set in script as lines are added; the transition
               is what keeps that from being a jump on every newline. */
            className="block w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[0.9375rem] leading-relaxed text-ink transition-[height] duration-150 ease-smooth placeholder:text-ink-muted focus:outline-none disabled:cursor-not-allowed"
          />

          <div className="flex items-center gap-1 px-2 pb-2 pt-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!canAttach || disabled}
              title={canAttach ? "Attach images (or paste / drop them)" : "This model can't see images"}
              aria-label="Attach images"
              className="rounded-md p-1.5 text-ink-muted transition-[background-color,color,transform] duration-150 ease-smooth hover:bg-panel hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted disabled:active:scale-100"
            >
              <PaperclipIcon />
            </button>

            <RunPicker
              models={models}
              model={model}
              onModelChange={onModelChange}
              effort={effort}
              onEffortChange={onEffortChange}
            />

            {/* Send and stop are one control that changes job, so the swap is
                a pop rather than one disappearing and another arriving. */}
            <div className="ml-auto">
              {streaming ? (
                <button
                  key="stop"
                  type="button"
                  onClick={onStop}
                  title="Stop"
                  aria-label="Stop"
                  className="animate-pop flex h-8 w-8 items-center justify-center rounded-full bg-ink text-bg transition-[background-color,transform] duration-150 ease-smooth hover:scale-105 active:scale-95"
                >
                  <StopIcon width={14} height={14} />
                </button>
              ) : (
                <button
                  key="send"
                  type="button"
                  onClick={submit}
                  disabled={!canSend}
                  title="Send"
                  aria-label="Send"
                  className="animate-pop flex h-8 w-8 items-center justify-center rounded-full bg-phosphor-dim text-bg transition-[background-color,color,transform] duration-150 ease-smooth hover:bg-phosphor hover:scale-105 active:scale-95 disabled:bg-line disabled:text-ink-muted disabled:hover:bg-line disabled:hover:scale-100 disabled:active:scale-100"
                >
                  <ArrowUpIcon width={16} height={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="mt-2 text-center text-[11px] text-ink-muted">
          {attachError ? (
            <span className="animate-fade text-danger">{attachError}</span>
          ) : (
            "Runs on this computer. Shadow can make mistakes, so check anything important."
          )}
        </p>
      </div>
    </div>
  );
}
