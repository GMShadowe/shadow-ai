import { useMemo, useState } from "react";

import { GroupTitle, Note, Row, Segmented, TriState, Toggle } from "../settings/controls.jsx";

/* Making or editing an assistant. Shared by first-run setup and the
   dashboard, so the two can never drift apart.

   Quick start is the name and nothing else - every other field has a
   sensible default and can be changed in Settings afterwards. Customize is
   the same fields the Settings window has, because an assistant *is* its
   profile; it reuses the Settings controls rather than growing a second set
   that looks almost right. */

const EFFORTS = [
  { id: "low", label: "Low", hint: "Up to 3 steps. Fastest." },
  { id: "medium", label: "Medium", hint: "Up to 6 steps." },
  { id: "high", label: "High", hint: "Up to 12 steps. Most thorough." },
];

const TONES = [
  { id: "friendly", label: "Friendly" },
  { id: "professional", label: "Professional" },
  { id: "casual", label: "Casual" },
];

const LENGTHS = [
  { id: "short", label: "Short" },
  { id: "balanced", label: "Balanced" },
  { id: "detailed", label: "Detailed" },
];

/* What a tool is set to when this assistant has no opinion about it yet.

   Mirrors tools/state.py: anything dangerous asks first. run_command is the
   exception the brain makes for a new assistant - it is not in that module's
   dangerous set, but it can run anything, so a fresh assistant starts it on
   Ask. Deliberately not read from the tool's reported `state`: that belongs
   to whichever assistant is active, not the one being edited here.
*/
function defaultState(tool) {
  if (tool.name === "run_command") return "ask";
  return tool.danger === "dangerous" ? "ask" : "on";
}

export const BLANK = {
  name: "",
  model: "default",
  effort: "medium",
  tone: "friendly",
  response_length: "balanced",
  custom_instructions: "",
  auto_memory: false,
  location: "",
  tools: {},
};

function Field({ label, description, children }) {
  return (
    <label className="block py-3.5">
      <div className="text-sm text-ink">{label}</div>
      {description && <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">{description}</div>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

const input =
  "w-full rounded-md border border-line bg-panel-alt px-3 py-2 text-sm text-ink " +
  "placeholder:text-ink-muted focus:border-signal focus:outline-none " +
  "transition-colors duration-150";

export default function AssistantWizard({
  value,
  onChange,
  models = [],
  tools = [],
  recommended,
  showTools = true,
  nameError,
}) {
  const [section, setSection] = useState("basics");
  const set = (patch) => onChange({ ...value, ...patch });

  const modelOptions = useMemo(
    () =>
      models.map((m) => ({
        id: m.id,
        label: m.label,
        hint: m.available ? m.description : m.reason,
        disabled: !m.available,
      })),
    [models]
  );

  const groups = useMemo(() => {
    const out = new Map();
    for (const t of tools) {
      if (!out.has(t.group)) out.set(t.group, []);
      out.get(t.group).push(t);
    }
    return [...out.entries()];
  }, [tools]);

  const picked = models.find((m) => m.id === value.model);

  const sections = [
    { id: "basics", label: "Basics" },
    { id: "personality", label: "Personality" },
    ...(showTools ? [{ id: "tools", label: "Tools" }] : []),
    { id: "memory", label: "Memory" },
  ];

  return (
    <div className="space-y-4">
      <Segmented options={sections} value={section} onChange={setSection} />

      {section === "basics" && (
        <div className="divide-y divide-line">
          <Field
            label="Name"
            description="What this assistant calls itself. It goes in every reply it writes, so pick something you'll want to read."
          >
            <input
              className={input}
              value={value.name}
              autoFocus
              maxLength={40}
              placeholder="Shadow"
              onChange={(e) => set({ name: e.target.value })}
            />
            {nameError && <div className="mt-1.5 text-xs text-danger">{nameError}</div>}
          </Field>

          <Field
            label="Model"
            description={
              picked && !picked.available
                ? picked.reason
                : "Bigger models answer better and run slower. Anything your computer can't run is greyed out."
            }
          >
            <Segmented options={modelOptions} value={value.model} onChange={(model) => set({ model })} />
            {recommended && (
              <div className="mt-2 text-xs text-ink-muted">
                Recommended for this computer: {models.find((m) => m.id === recommended)?.label ?? recommended}.
              </div>
            )}
          </Field>

          <Field label="Effort" description="How many steps it may take before it has to answer.">
            <Segmented options={EFFORTS} value={value.effort} onChange={(effort) => set({ effort })} />
          </Field>
        </div>
      )}

      {section === "personality" && (
        <div className="divide-y divide-line">
          <Field label="Tone" description="How it sounds.">
            <Segmented options={TONES} value={value.tone} onChange={(tone) => set({ tone })} />
          </Field>

          <Field label="Answer length" description="How much it says when it has a choice.">
            <Segmented
              options={LENGTHS}
              value={value.response_length}
              onChange={(response_length) => set({ response_length })}
            />
          </Field>

          <Field
            label="Instructions"
            description="Anything it should always know or always do. This goes into every prompt, so keep it short."
          >
            <textarea
              className={`${input} min-h-20 resize-y leading-relaxed`}
              value={value.custom_instructions}
              maxLength={1000}
              placeholder="e.g. I write Python. Prefer standard library over new dependencies."
              onChange={(e) => set({ custom_instructions: e.target.value })}
            />
          </Field>
        </div>
      )}

      {section === "tools" && (
        <div className="space-y-1">
          <Note>
            What this assistant may do on this computer. Ask pauses and waits for you, every
            time. The router picks a smaller set than this for each message, so these are the
            limits, not the list it gets.
          </Note>
          {groups.map(([group, items]) => (
            <div key={group}>
              <GroupTitle>{group}</GroupTitle>
              <div className="divide-y divide-line">
                {items.map((t) => (
                  <Row key={t.name} label={t.name} description={t.description}>
                    <TriState
                      value={value.tools?.[t.name] ?? defaultState(t)}
                      onChange={(state) => set({ tools: { ...(value.tools ?? {}), [t.name]: state } })}
                    />
                  </Row>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {section === "memory" && (
        <div className="divide-y divide-line">
          <Row
            label="Remember things on its own"
            description="Saves durable facts from a conversation without being asked. Off by default; you can always say 'remember that…' instead."
          >
            <Toggle checked={value.auto_memory} onChange={(auto_memory) => set({ auto_memory })} />
          </Row>
          <Field
            label="Location"
            description="Only used to look up the weather, and only when you ask for it. Leave it empty and nothing is ever sent."
          >
            <input
              className={input}
              value={value.location}
              maxLength={80}
              placeholder="e.g. Ahmedabad"
              onChange={(e) => set({ location: e.target.value })}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
