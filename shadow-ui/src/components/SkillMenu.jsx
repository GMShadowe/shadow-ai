/* The slash menu above the composer.

   A skill only ever runs because the user picked it here. Nothing about
   this list reaches the brain's prompt — Shadow is not told which skills
   exist, so it can't offer one or invent one. */

export default function SkillMenu({ skills, index, query, onPick, onHover }) {
  return (
    <div
      role="listbox"
      aria-label="Skills"
      className="animate-pop absolute bottom-full left-0 z-20 mb-2 w-full max-w-md overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_16px_48px_-20px_var(--shadow-color)]"
    >
      <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">skills</span>
        <span className="text-[11px] text-ink-muted">↑↓ to move · enter to pick · esc to close</span>
      </div>

      {skills.length === 0 ? (
        <div className="px-3 py-2.5 text-xs text-ink-muted">
          {query ? `No skill matches "${query}".` : "No skills installed yet. They live in shadow-brain/skills."}
        </div>
      ) : (
        <ul className="max-h-64 overflow-y-auto py-1">
          {skills.map((s, i) => (
            <li key={s.name}>
              <button
                type="button"
                role="option"
                aria-selected={i === index}
                onMouseEnter={() => onHover(i)}
                onMouseDown={(e) => {
                  // mousedown, not click: the textarea must not lose focus first
                  e.preventDefault();
                  onPick(s);
                }}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors duration-150 active:bg-panel ${
                  i === index ? "bg-panel-alt" : "hover:bg-panel-alt/60"
                }`}
              >
                <span className="flex w-full items-baseline gap-2">
                  <span className={`font-mono text-[13px] ${s.broken ? "text-danger" : "text-ink"}`}>/{s.name}</span>
                  {s.broken && <span className="text-[11px] text-danger">needs fixing</span>}
                </span>
                <span className="line-clamp-2 text-xs leading-relaxed text-ink-muted">{s.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
