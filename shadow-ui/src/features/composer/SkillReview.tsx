import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { approveSkill, getSkill, SKILLS_CHANGED } from "@/lib/api";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { SkillDetail } from "@/types";

interface SkillReviewProps {
  name: string;
  onApproved: () => void;
  onCancel: () => void;
}

/* Shown the first time an added skill is used, and again whenever its file
   changes. A skill someone else wrote goes into Shadow's instructions, so the
   user sees where it came from, what it asks for and every word of it before
   it does. The approval names the exact version read here (its sha256). */
export default function SkillReview({ name, onApproved, onCancel }: SkillReviewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useFocusTrap(ref, true);

  useEffect(() => {
    let live = true;
    getSkill(name)
      .then((s) => live && setSkill(s as SkillDetail))
      .catch((e) => live && setError((e as Error).message));
    return () => {
      live = false;
    };
  }, [name]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  async function approve() {
    if (!skill) return;
    setBusy(true);
    setError(null);
    try {
      await approveSkill(skill.name, skill.sha256);
      window.dispatchEvent(new Event(SKILLS_CHANGED));
      onApproved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-review-title"
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="glass-menu animate-pop flex max-h-[min(640px,90vh)] w-full max-w-lg flex-col gap-4 rounded-2xl border border-line p-5">
        <div className="space-y-1">
          <h2 id="skill-review-title" className="text-[15px] font-medium text-ink">
            Review <span className="font-mono text-[14px]">/{name}</span> before Shadow uses it
          </h2>
          <p className="text-xs leading-relaxed text-ink-muted">
            Someone else wrote this skill, and it becomes part of Shadow's instructions for this message. Read it
            once; you'll be asked again only if the file changes.
          </p>
        </div>

        {skill ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              <dt className="text-ink-muted">From</dt>
              <dd className="truncate font-mono text-[11px] text-ink" title={skill.source ?? undefined}>
                {skill.source ?? "unknown"}
              </dd>
              <dt className="text-ink-muted">Asks for</dt>
              <dd className="font-mono text-[11px] text-ink">
                {skill.tools.length ? skill.tools.join(", ") : "no tools"}
              </dd>
            </dl>
            {skill.tools.length > 0 && (
              <p className="-mt-2 text-[11px] leading-relaxed text-ink-muted">
                Your settings still decide: a tool you turned off stays off, and one set to Ask still asks.
              </p>
            )}
            <pre className="min-h-0 flex-1 overflow-y-auto overscroll-contain whitespace-pre-wrap break-words rounded-xl border border-line bg-panel-alt px-3 py-2.5 font-mono text-xs leading-relaxed text-ink-muted">
              {skill.content}
            </pre>
          </>
        ) : (
          !error && <p className="text-xs text-ink-muted">Loading the skill…</p>
        )}

        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-line px-4 py-1.5 text-xs text-ink/85 transition-[border-color,color,scale] duration-150 ease-smooth hover:text-ink active:scale-[0.96]"
          >
            Cancel
          </button>
          <button
            type="button"
            data-autofocus
            disabled={!skill || busy}
            onClick={approve}
            className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-bg transition-[opacity,scale] duration-150 ease-smooth enabled:active:scale-[0.96] disabled:opacity-40"
          >
            Use this skill
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
