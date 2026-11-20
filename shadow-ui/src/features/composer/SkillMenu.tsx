import type { Skill } from "@/types";

interface SkillMenuProps {
  skills: Skill[];
  index: number;
  query: string;
  onPick: (skill: Skill) => void;
  onHover: (index: number) => void;
}

/* The slash menu above the prompt bar.

   A skill only ever runs because the user picked it here. Nothing about
   this list reaches the brain's prompt — Shadow is not told which skills
   exist, so it can't offer one or invent one. Opened by typing, so it
   appears without animation. */
export default function SkillMenu({ skills, index, query, onPick, onHover }: SkillMenuProps) {
  return (
    <div
      id="skill-menu"
      role="listbox"
      aria-label="Skills"
      className="glass-menu absolute bottom-full left-0 z-20 mb-2 w-full max-w-md overflow-hidden rounded-2xl shadow-[0_16px_48px_-20px_var(--shadow-color)]"
    >
      <div className="flex items-center justify-between border-b border-line/70 px-3 py-1.5">
        <span className="text-[13px] text-ink-faint">Skills</span>
        <span className="text-[11px] text-ink-muted">↑↓ move · ↵ pick · esc close</span>
      </div>

      {skills.length === 0 ? (
        <div className="px-3 py-2.5 text-xs text-ink-muted">
          {query ? `No skill matches “${query}”.` : "No skills installed yet. Add one in Settings → Skills."}
        </div>
      ) : (
        <ul className="max-h-64 overflow-y-auto overscroll-contain py-1">
          {skills.map((s, i) => (
            <li key={s.name}>
              <button
                type="button"
                id={`skill-${s.name}`}
                role="option"
                aria-selected={i === index}
                onMouseEnter={() => onHover(i)}
                onMouseDown={(e) => {
                  // mousedown, not click: the textarea must not lose focus first
                  e.preventDefault();
                  onPick(s);
                }}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left ${
                  i === index ? "bg-ink/[0.07]" : ""
                }`}
              >
                <span className="flex w-full items-baseline gap-2">
                  <span className={`font-mono text-[13px] ${s.broken ? "text-danger" : "text-ink"}`}>/{s.name}</span>
                  {s.broken && <span className="text-[11px] text-danger">needs fixing</span>}
                </span>
                <span className="line-clamp-2 text-xs leading-normal text-ink-muted">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
