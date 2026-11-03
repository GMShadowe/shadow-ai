import type { ComponentType } from "react";
import { ChatIcon, CodeIcon, FolderIcon, GlobeIcon, SparkleIcon, type IconProps } from "@/components/icons";
import type { Skill } from "@/types";

/* Starters map to the brain's routes, so each one is something Shadow is
   actually set up to do. Each route keeps one quiet colour on its icon, the
   only colour on the empty screen. */
const STARTERS: { label: string; hint: string; text: string; icon: ComponentType<IconProps>; tone: string }[] = [
  { label: "Explain", hint: "A clear answer on any topic", text: "Explain ", icon: ChatIcon, tone: "text-tone-cyan" },
  { label: "Write code", hint: "Written and run on this PC", text: "Write a script that ", icon: CodeIcon, tone: "text-tone-violet" },
  { label: "Organize files", hint: "Sort, rename and tidy a folder", text: "Organize the files in ", icon: FolderIcon, tone: "text-tone-yellow" },
  { label: "Look something up", hint: "Search the web, then summarize", text: "Look up ", icon: GlobeIcon, tone: "text-tone-green" },
];

export type Suggestion =
  | { kind: "skill"; skill: Skill }
  | { kind: "starter"; text: string; label: string; hint: string; icon: ComponentType<IconProps>; tone: string };

export function suggestionsFor(skills: Skill[], max = 5): Suggestion[] {
  const starters: Suggestion[] = STARTERS.map((s) => ({ kind: "starter", ...s }));
  const fromSkills: Suggestion[] = skills
    .filter((s) => !s.broken)
    .slice(0, 1)
    .map((skill) => ({ kind: "skill", skill }));
  return [...starters, ...fromSkills].slice(0, max);
}

interface SuggestionsProps {
  items: Suggestion[];
  onPick: (s: Suggestion) => void;
}

/* The four card looks, taken from the brand book's palette cards: Blue
   Regatta, Charcoal, Cream (the ink colour, so it inverts in the light
   theme) and the pale wave blue. Each sets its own text colour. */
const LOOKS = [
  { card: "bg-bubble text-bubble-ink", hint: "text-bubble-ink/90", tile: "bg-bubble-ink/10" },
  { card: "bg-panel text-ink ring-1 ring-inset ring-line", hint: "text-ink-faint", tile: "bg-ink/[0.07] text-signal" },
  { card: "bg-ink text-bg", hint: "text-bg/75", tile: "bg-bg/10" },
  { card: "bg-glow-b text-bubble-ink", hint: "text-bubble-ink/70", tile: "bg-bubble-ink/10" },
];

/* Starters under the prompt bar, as four brand cards. Hovering one lifts it
   a little and spins a sparkle into its corner; pressing sinks it. A skill
   sits on its own line below as /name. They fill the box rather than send,
   so nothing runs that you didn't finish asking. */
export default function Suggestions({ items, onPick }: SuggestionsProps) {
  const starters = items.filter((s): s is Extract<Suggestion, { kind: "starter" }> => s.kind === "starter");
  const skills = items.filter((s): s is Extract<Suggestion, { kind: "skill" }> => s.kind === "skill");
  return (
    <div className="mx-auto mt-5 max-w-[48rem]">
      <ul aria-label="Starters" className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {starters.map((s, i) => {
          const Icon = s.icon;
          const look = LOOKS[i % LOOKS.length];
          return (
            <li key={s.label} className="animate-rise" style={{ animationDelay: `${120 + i * 60}ms` }}>
              <button
                type="button"
                onClick={() => onPick(s)}
                title={`Start with “${s.text.trim()}…”`}
                className={`starter group relative flex h-full min-h-[118px] w-full flex-col items-start overflow-hidden rounded-2xl p-3.5 text-left ${look.card}`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-full ${look.tile}`}>
                  <Icon width={16} height={16} />
                </span>
                <SparkleIcon width={18} height={18} aria-hidden="true" className="starter-spark absolute right-3 top-3.5" />
                <span className="mt-auto pt-3 text-[14px] font-semibold leading-tight">{s.label}</span>
                <span className={`mt-1 text-[12px] leading-snug ${look.hint}`}>{s.hint}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {skills.length > 0 && (
        <p className="animate-rise mt-3.5 flex items-center justify-center gap-2 text-[12.5px] text-ink-faint" style={{ animationDelay: "380ms" }}>
          Or use a skill:
          {skills.map((s) => (
            <button
              key={s.skill.name}
              type="button"
              onClick={() => onPick(s)}
              title={s.skill.description}
              className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 font-mono text-signal transition-[background-color,border-color] duration-150 hover:border-signal/40 hover:bg-signal/10"
            >
              <SparkleIcon width={11} height={11} />/{s.skill.name}
            </button>
          ))}
        </p>
      )}
    </div>
  );
}
