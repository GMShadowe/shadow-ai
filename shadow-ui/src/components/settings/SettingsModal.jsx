import { useEffect, useMemo, useRef, useState } from "react";
import { THEMES, ACCENTS, DEFAULT_APPEARANCE } from "../../theme.js";
import {
  AboutIcon,
  AppearanceIcon,
  BrainIcon,
  CloseIcon,
  DataIcon,
  DownloadIcon,
  GeneralIcon,
  MemoryIcon,
  OutboundIcon,
  PersonalityIcon,
  PrivacyIcon,
  SearchIcon,
  SkillsIcon,
  ToolsIcon,
  TrashIcon,
} from "../Icons.jsx";
import { Row, GroupTitle, Note, Segmented, TriState, SmallButton, Toggle, SavedInput, Pill, Bytes } from "./controls.jsx";
import { useExit } from "../ui/useExit.js";
import { formatBytes } from "./format.js";
import {
  API_BASE,
  getSettings,
  updateSettings,
  clearLog,
  clearChats,
  listMemory,
  deleteMemory,
  clearMemory,
  getPrivacy,
  getSkills,
  getSkill,
  getInstalledModels,
  getCustomModels,
  addCustomModel,
  deleteCustomModel,
  patchCustomModel,
  testCustomModel,
} from "../../api.js";

const SECTIONS = [
  { id: "general", label: "General", icon: GeneralIcon, hint: "Name, model, effort and where Shadow is allowed to work." },
  { id: "personality", label: "Personality", icon: PersonalityIcon, hint: "How Shadow sounds, and what it knows about you." },
  { id: "memory", label: "Memory", icon: MemoryIcon, hint: "What Shadow keeps in mind between chats." },
  { id: "tools", label: "Tools", icon: ToolsIcon, hint: "What Shadow is allowed to do on this computer." },
  { id: "skills", label: "Skills", icon: SkillsIcon, hint: "Instructions you can invoke with a slash command." },
  { id: "privacy", label: "Privacy", icon: PrivacyIcon, hint: "Everything that can leave this computer, in one list." },
  { id: "appearance", label: "Appearance", icon: AppearanceIcon, hint: "Theme, accent, shape and text size." },
  { id: "brain", label: "Models & brain", icon: BrainIcon, hint: "Router, model sizes and what your computer can run." },
  { id: "data", label: "Data", icon: DataIcon, hint: "Everything stored here, and how to delete it." },
  { id: "about", label: "About", icon: AboutIcon, hint: "Version, what's running right now, shortcuts." },
];

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
const ROUTERS = [
  { id: "laya", label: "Laya", hint: "Smarter routing. Uses about 800MB more memory." },
  { id: "keywords", label: "Keywords", hint: "Lighter and instant, but easily confused." },
];
const TEXT_SIZES = [
  { id: 14, label: "Small" },
  { id: 16, label: "Default" },
  { id: 17, label: "Large" },
];

function Spec({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right font-mono text-xs text-ink/90">{value ?? "unknown"}</span>
    </div>
  );
}

/* A one-line path. Always the real path on disk, so it can be checked. */
function Path({ children }) {
  return <div className="truncate font-mono text-[10px] text-ink-muted/80" title={children}>{children}</div>;
}

function GeneralSection({ data, save }) {
  // Workspace is a global setting, the rest live in this assistant's profile.
  const s = { ...data.settings, ...data.profile };

  const models = data.models.map((m) => ({
    id: m.id,
    label: m.label,
    hint: m.reason ?? m.description,
    disabled: !m.available,
  }));

  return (
    <div className="divide-y divide-line">
      <Row label="Assistant name" description="What it calls itself, and what you call it in chat." stacked>
        <SavedInput value={s.name} onSave={(name) => name.trim() && save({ name: name.trim() })} placeholder="Shadow" />
      </Row>
      <Row label="Default model" description="What new chats start with. You can still switch for any message.">
        <Segmented options={models} value={s.model} onChange={(id) => save({ model: id })} />
      </Row>
      <Row label="Default effort" description="Higher effort lets Shadow take more steps. Slower, never costs anything.">
        <Segmented options={EFFORTS} value={s.effort} onChange={(id) => save({ effort: id })} />
      </Row>
      <Row label="Workspace folder" description="Shadow can only read, write and run things inside this folder." stacked>
        <SavedInput value={s.workspace} onSave={(workspace) => save({ workspace })} mono />
      </Row>
    </div>
  );
}

function PersonalitySection({ data, save }) {
  const s = data.profile;
  const [instructions, setInstructions] = useState(s.custom_instructions);
  useEffect(() => setInstructions(s.custom_instructions), [s.custom_instructions]);

  return (
    <div className="divide-y divide-line">
      <Row label="Tone" description="How Shadow sounds when it talks to you.">
        <Segmented options={TONES} value={s.tone} onChange={(id) => save({ tone: id })} />
      </Row>
      <Row label="Answer length" description="How much Shadow says by default.">
        <Segmented options={LENGTHS} value={s.response_length} onChange={(id) => save({ response_length: id })} />
      </Row>
      <Row
        label="Location"
        description="Used for the date, time and weather the assistant knows about. Leave empty to share nothing."
        stacked
      >
        <SavedInput value={s.location ?? ""} onSave={(location) => save({ location })} placeholder="e.g. Ahmedabad" />
      </Row>
      <Row
        label="Custom instructions"
        description="Anything Shadow should know or always do, like your name, your projects, or how you like code formatted."
        stacked
      >
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value.slice(0, 1000))}
          rows={5}
          placeholder="e.g. Call me Shadow. I mostly write Python and React. Keep code comments short."
          className="w-full resize-none rounded-md border border-line bg-panel-alt px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-signal focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-ink-muted">
            {instructions.length}/1000 · Shadow always stays honest, whatever you write here.
          </span>
          <SmallButton
            onClick={() => save({ custom_instructions: instructions })}
            disabled={instructions === s.custom_instructions}
          >
            Save
          </SmallButton>
        </div>
      </Row>
    </div>
  );
}

function ToolsSection({ data, save }) {
  const [query, setQuery] = useState("");
  const offline = !!data.settings.offline;
  const needle = query.trim().toLowerCase();

  const matches = data.tools.filter(
    (t) => !needle || t.name.includes(needle) || t.description.toLowerCase().includes(needle)
  );
  const groups = [...new Set(matches.map((t) => t.group))];

  return (
    <div>
      <Note>
        <strong className="font-medium text-ink">Ask</strong> makes Shadow stop and check with you in the chat before
        using a tool, showing exactly what it wants to do. Choosing "Always allow" there switches the tool to On.
      </Note>

      <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-panel-alt px-3 py-1.5 transition-colors focus-within:border-signal">
        <SearchIcon width={14} height={14} className="shrink-0 text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="shrink-0 rounded p-0.5 text-ink-muted transition-colors hover:text-ink"
          >
            <CloseIcon width={12} height={12} />
          </button>
        )}
      </div>

      {groups.length === 0 && (
        <div className="py-6 text-center text-sm text-ink-muted">No tool matches "{query}".</div>
      )}

      {groups.map((group) => {
        const tools = matches.filter((t) => t.group === group);
        const on = tools.filter((t) => t.state !== "off").length;
        return (
          <div key={group}>
            <div className="flex items-baseline justify-between">
              <GroupTitle>{group}</GroupTitle>
              <span className="font-mono text-[10px] text-ink-muted">
                {on}/{tools.length} on
              </span>
            </div>
            <div className="divide-y divide-line">
              {tools.map((t) => (
                <Row
                  key={t.name}
                  label={
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px]">{t.name}</span>
                      {t.danger === "dangerous" && <Pill tone="danger">dangerous</Pill>}
                      {t.danger === "caution" && <Pill>caution</Pill>}
                      {offline && group === "Web" && <Pill tone="warn">offline mode</Pill>}
                    </span>
                  }
                  description={
                    offline && group === "Web"
                      ? `${t.description} Blocked right now by offline mode in Privacy.`
                      : t.description
                  }
                >
                  <TriState value={t.state} onChange={(state) => save({ tools: { [t.name]: state } })} />
                </Row>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MemorySection({ data, save }) {
  const [memories, setMemories] = useState(null);
  const [error, setError] = useState(null);
  const autoOn = data.profile.auto_memory;

  useEffect(() => {
    listMemory()
      .then((r) => setMemories(r.memories))
      .catch((e) => setError(e.message));
  }, []);

  async function removeOne(id) {
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeAll() {
    if (!window.confirm("Forget everything this assistant has remembered? This can't be undone.")) return;
    try {
      await clearMemory();
      setMemories([]);
    } catch (e) {
      setError(e.message);
    }
  }

  const sourceLabel = { asked: "you asked", auto: "noticed", user: "saved" };

  return (
    <div>
      <div className="divide-y divide-line">
        <Row
          label="Remember things automatically"
          description="Let the assistant notice and save durable facts about you on its own. When off, it only remembers when you say 'remember…'."
        >
          <Toggle checked={!!autoOn} onChange={(v) => save({ auto_memory: v })} />
        </Row>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <GroupTitle>Remembered facts {memories ? `(${memories.length})` : ""}</GroupTitle>
        {memories && memories.length > 0 && (
          <SmallButton danger onClick={removeAll}>
            Forget all
          </SmallButton>
        )}
      </div>

      {error && <div className="mb-2 text-xs text-danger">{error}</div>}

      {memories === null && <div className="shimmer text-sm">Loading</div>}

      {memories && memories.length === 0 && (
        <Note>Nothing remembered yet. Tell the assistant "remember that…" or turn on automatic memory above.</Note>
      )}

      {memories && memories.length > 0 && (
        <ul className="space-y-1">
          {memories.map((m) => (
            <li key={m.id} className="group flex items-start gap-2 rounded-lg border border-line bg-panel px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink">{m.text}</div>
                <div className="mt-0.5 text-[11px] text-ink-muted">{sourceLabel[m.source] ?? m.source}</div>
              </div>
              <button
                type="button"
                onClick={() => removeOne(m.id)}
                aria-label="Forget this"
                className="shrink-0 rounded p-1 text-ink-muted opacity-0 transition-opacity duration-150 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
              >
                <TrashIcon width={13} height={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkillsSection() {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null); // the skill whose text is showing
  const [body, setBody] = useState(null);

  useEffect(() => {
    getSkills()
      .then((r) => setList(r.skills))
      .catch((e) => setError(e.message));
  }, []);

  async function show(name) {
    if (open === name) {
      setOpen(null);
      return;
    }
    setOpen(name);
    setBody(null);
    try {
      const skill = await getSkill(name);
      setBody(skill.content);
    } catch (e) {
      setBody(`Couldn't read it: ${e.message}`);
    }
  }

  return (
    <div>
      <Note>
        A skill is a markdown document of careful instructions for one task. Invoke one by typing{" "}
        <span className="font-mono text-ink">/</span> in the composer and picking it — Shadow is never told which
        skills exist, so it can't suggest one or run one you didn't ask for. The instructions last for that one
        message, and only the skill's name is kept with the turn.
      </Note>

      {error && <div className="mb-2 text-xs text-danger">{error}</div>}
      {list === null && !error && <div className="shimmer text-sm">Loading</div>}

      {list && list.length === 0 && (
        <Note>
          No skills installed. Add one as{" "}
          <span className="font-mono text-ink">shadow-brain/skills/&lt;name&gt;/SKILL.md</span> and it appears here.
        </Note>
      )}

      {list && list.length > 0 && (
        <div className="space-y-1.5">
          {list.map((s) => (
            <div key={s.name} className="rounded-lg border border-line bg-panel">
              <div className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[13px] ${s.broken ? "text-danger" : "text-ink"}`}>
                      /{s.name}
                    </span>
                    {s.broken ? <Pill tone="danger">needs fixing</Pill> : <Pill>{s.chars} chars</Pill>}
                  </div>
                  <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">{s.description}</div>
                  {s.tools?.length > 0 && (
                    <div className="mt-1 font-mono text-[11px] text-ink-muted">
                      needs: {s.tools.join(", ")}
                    </div>
                  )}
                </div>
                {!s.broken && (
                  <SmallButton onClick={() => show(s.name)}>{open === s.name ? "Hide" : "Read"}</SmallButton>
                )}
              </div>

              {open === s.name && (
                <div className="animate-rise border-t border-line px-3 py-2.5">
                  {body === null ? (
                    <div className="shimmer font-mono text-xs text-ink-muted">loading…</div>
                  ) : (
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ink-muted">
                      {body}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PrivacySection({ data, save, report, reportError, onReload }) {
  const offline = !!data.settings.offline;
  const location = (data.profile.location ?? "").trim();
  const outbound = report?.outbound ?? [];
  const live = outbound.filter((o) => o.active).length;

  async function set(patch) {
    await save(patch);
    onReload();
  }

  return (
    <div>
      <div className="divide-y divide-line">
        <Row
          label="Offline mode"
          description="Blocks every outbound call. The web tools refuse with an error, and the weather lookup is skipped."
        >
          <Toggle checked={offline} onChange={(v) => set({ offline: v })} />
        </Row>
      </div>

      <div className="mt-3">
        {offline ? (
          <div className="flex items-start gap-2.5 rounded-md border border-phosphor-dim/40 bg-phosphor/5 px-3 py-2 text-xs leading-relaxed text-ink/85">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-phosphor" />
            <span>
              Nothing can leave this computer while this is on. Shadow still reads files, runs commands and answers
              normally — it just can't reach the internet.
            </span>
          </div>
        ) : (
          <Note>
            Shadow is local by default: the model, your chats and your settings never leave this computer. The list
            below is every exception, and it is complete.
          </Note>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <GroupTitle>What can leave this computer</GroupTitle>
        <span className="font-mono text-[10px] text-ink-muted">
          {live} of {outbound.length} possible now
        </span>
      </div>

      {reportError && <div className="pb-2 text-xs text-danger">{reportError}</div>}
      {!report && !reportError && <div className="shimmer py-2 text-sm">Checking</div>}

      {outbound.length > 0 && (
        <ul className="space-y-1">
          {outbound.map((o) => (
            <li key={o.id} className="flex items-start gap-3 rounded-lg border border-line bg-panel px-3 py-2.5">
              <OutboundIcon
                width={15}
                height={15}
                className={`mt-0.5 shrink-0 ${o.active ? "text-phosphor" : "text-ink-muted/60"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-ink">{o.label}</span>
                  <span className="truncate font-mono text-[11px] text-ink-muted">→ {o.host}</span>
                </div>
                <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">{o.what}</div>
                <div className="mt-1 text-[11px] text-ink-muted/80">{o.reason}</div>
              </div>
              <Pill tone={o.active ? "live" : "quiet"}>{o.active ? "possible" : "blocked"}</Pill>
            </li>
          ))}
        </ul>
      )}

      <GroupTitle>Location</GroupTitle>
      <div className="divide-y divide-line">
        <Row
          label={location || "No location set"}
          description={
            location
              ? "Only this city name is sent, at most once an hour, and only while offline mode is off."
              : "Without a location Shadow never calls out for weather. Set one in Personality if you want it."
          }
        >
          {location ? (
            <SmallButton danger onClick={() => set({ location: "" })}>
              Clear
            </SmallButton>
          ) : (
            <Pill>nothing sent</Pill>
          )}
        </Row>
      </div>

      <GroupTitle>Kept on this computer</GroupTitle>
      <div className="divide-y divide-line">
        <Row
          label="Keep a copy of every turn"
          description={`Writes each message, reply and routing decision to the training log on this computer. ${
            data.log.turns
          } turn(s) saved so far. Turning it off stops new writes; delete the file in Data.`}
        >
          <Toggle checked={data.settings.log_turns !== false} onChange={(v) => set({ log_turns: v })} />
        </Row>
      </div>

      <p className="pt-4 text-[11px] leading-relaxed text-ink-muted">
        No accounts, no telemetry, no model downloads at runtime. Shadow listens on 127.0.0.1 only, so nothing on your
        network can reach it either.
      </p>
    </div>
  );
}

function DataSection({ data, report, reportError, onReload, onNotice, onError }) {
  const turns = data.log.turns;
  const storage = report?.storage ?? [];
  const [busy, setBusy] = useState(null);

  async function run(id, confirmText, action, done) {
    if (!window.confirm(confirmText)) return;
    setBusy(id);
    try {
      await action();
      await onReload();
      onNotice(done);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <GroupTitle>Stored on this computer</GroupTitle>
        {report && (
          <span className="font-mono text-[10px] text-ink-muted">
            {formatBytes(report.data_dir_bytes)} in {report.data_dir_files} file(s)
          </span>
        )}
      </div>

      {reportError && <div className="pb-2 text-xs text-danger">{reportError}</div>}
      {!report && !reportError && <div className="shimmer py-2 text-sm">Measuring</div>}

      {storage.length > 0 && (
        <div className="divide-y divide-line">
          {storage.map((row) => (
            <div key={row.id} className="flex items-start gap-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-ink">{row.label}</div>
                <div className="mt-0.5 text-xs text-ink-muted">{row.detail}</div>
                <Path>{row.path}</Path>
              </div>
              <Bytes value={row.bytes} />
            </div>
          ))}
        </div>
      )}

      <GroupTitle>Export</GroupTitle>
      <div className="divide-y divide-line">
        <Row
          label="Training log"
          description="One line per turn, including Laya's routing probabilities. Useful for tuning the router later."
        >
          {turns > 0 ? (
            <a
              href={`${API_BASE}/data/log/export`}
              className="flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs text-ink/80 transition-colors hover:border-phosphor-dim hover:text-phosphor"
            >
              <DownloadIcon width={13} height={13} />
              Export
            </a>
          ) : (
            <SmallButton disabled>Export</SmallButton>
          )}
        </Row>
      </div>

      <GroupTitle>Delete</GroupTitle>
      <div className="divide-y divide-line">
        <Row label="All chats" description="Every saved conversation and the images you attached to them.">
          <SmallButton
            danger
            disabled={busy === "chats"}
            onClick={() =>
              run("chats", "Delete every saved chat and its images? This can't be undone.", clearChats, "Chats deleted")
            }
          >
            {busy === "chats" ? "Deleting…" : "Delete"}
          </SmallButton>
        </Row>
        <Row label="Long-term memory" description="Every fact this assistant has remembered about you.">
          <SmallButton
            danger
            disabled={busy === "memory"}
            onClick={() =>
              run("memory", "Forget everything this assistant has remembered? This can't be undone.", clearMemory, "Memory cleared")
            }
          >
            {busy === "memory" ? "Deleting…" : "Forget"}
          </SmallButton>
        </Row>
        <Row label="Training log" description={`${turns} turn(s) of message, reply and routing data.`}>
          <SmallButton
            danger
            disabled={turns === 0 || busy === "log"}
            onClick={() => run("log", "Delete all logged turns? This can't be undone.", clearLog, "Log cleared")}
          >
            {busy === "log" ? "Deleting…" : "Clear"}
          </SmallButton>
        </Row>
        <Row
          label="Everything"
          description="Chats, images, long-term memory and the log, in one go. Your settings and workspace files are left alone."
        >
          <SmallButton
            danger
            disabled={busy === "all"}
            onClick={() =>
              run(
                "all",
                "Delete all chats, images, memories and the training log? This can't be undone.",
                async () => {
                  await clearChats();
                  await clearMemory();
                  await clearLog();
                },
                "Everything deleted"
              )
            }
          >
            {busy === "all" ? "Deleting…" : "Delete all"}
          </SmallButton>
        </Row>
      </div>

      <p className="pt-4 text-[11px] leading-relaxed text-ink-muted">
        Deleting here only touches Shadow's own data folder. Files Shadow wrote in your workspace stay where they are.
      </p>
    </div>
  );
}

function AppearanceSection({ appearance, onChange }) {
  const set = (patch) => onChange({ ...appearance, ...patch });

  return (
    <div className="divide-y divide-line">
      <Row label="Theme" stacked>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(THEMES).map(([id, t]) => (
            <button
              key={id}
              type="button"
              onClick={() => set({ theme: id })}
              className={`rounded-lg border p-1.5 text-left transition-colors ${
                appearance.theme === id ? "border-phosphor" : "border-line hover:border-ink-muted"
              }`}
            >
              <div className="flex h-12 overflow-hidden rounded-md border" style={{ background: t.bg, borderColor: t.line }}>
                <div className="h-full w-1/3" style={{ background: t.panel, borderRight: `1px solid ${t.line}` }} />
                <div className="flex-1 space-y-1 p-1.5">
                  <div className="h-1.5 w-3/4 rounded-full" style={{ background: t.inkMuted, opacity: 0.6 }} />
                  <div className="h-1.5 w-1/2 rounded-full" style={{ background: t.inkMuted, opacity: 0.35 }} />
                </div>
              </div>
              <div className="mt-1.5 px-0.5 text-xs text-ink">{t.label}</div>
            </button>
          ))}
        </div>
      </Row>

      <Row label="Accent color" description="Used for buttons, active states and highlights.">
        <div className="flex gap-2.5">
          {Object.entries(ACCENTS).map(([id, a]) => (
            <button
              key={id}
              type="button"
              title={a.label}
              aria-label={a.label}
              onClick={() => set({ accent: id })}
              className={`h-6 w-6 rounded-full transition-transform hover:scale-110 active:scale-95 ${
                appearance.accent === id ? "ring-2 ring-ink ring-offset-2 ring-offset-panel" : ""
              }`}
              style={{ background: a.main }}
            />
          ))}
        </div>
      </Row>

      <Row label="Corner radius" description="How rounded buttons, boxes and menus are.">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={16}
            step={1}
            value={appearance.radius}
            onChange={(e) => set({ radius: Number(e.target.value) })}
            className="w-32 accent-phosphor"
          />
          <span className="w-9 text-right font-mono text-xs text-ink-muted">{appearance.radius}px</span>
        </div>
      </Row>

      <Row label="Text size">
        <Segmented options={TEXT_SIZES} value={appearance.textSize} onChange={(v) => set({ textSize: v })} />
      </Row>

      <Row label="Reset appearance" description="Go back to the original look.">
        <SmallButton onClick={() => onChange({ ...DEFAULT_APPEARANCE })}>Reset</SmallButton>
      </Row>
    </div>
  );
}

/* Bring your own model, or your own key.

   These are two different things and the UI says so: one is still fully
   local, the other sends the conversation to someone else's computer. The
   warning for the second sits where the decision is made, in plain words,
   and the model picker and the chat header carry it from then on. */
/* What one endpoint has cost, and the caps that stop it.

   Tokens only. Rates differ per provider, per model and over time, so Shadow
   does not convert them to money - a wrong price is worse than none, because
   someone would plan around it. */
function Spend({ model, used, onSave }) {
  const [turn, setTurn] = useState(String(model.cap_turn ?? 0));
  const [day, setDay] = useState(String(model.cap_day ?? 0));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState(null);

  const dirty =
    String(model.cap_turn ?? 0) !== turn.trim() || String(model.cap_day ?? 0) !== day.trim();

  async function apply() {
    setSaving(true);
    setProblem(null);
    try {
      await onSave({ cap_turn: Number(turn) || 0, cap_day: Number(day) || 0 });
    } catch (e) {
      setProblem(e.message);
    } finally {
      setSaving(false);
    }
  }

  const n = (v) => (v ?? 0).toLocaleString();

  return (
    <div className="rounded-md border border-line bg-panel-alt px-3 py-2.5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-[11px] text-ink-muted">
        <span className="text-ink">{n(used?.total)} tokens total</span>
        <span>{n(used?.today)} today</span>
        <span>
          {n(used?.calls)} call{used?.calls === 1 ? "" : "s"} over {n(used?.turns)} turn
          {used?.turns === 1 ? "" : "s"}
        </span>
      </div>
      {used?.partial && (
        <div className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
          Some calls came back with no usage figures, so the real total is higher than this.
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        {[
          ["Per turn", turn, setTurn],
          ["Per day", day, setDay],
        ].map(([label, value, set]) => (
          <label key={label} className="block">
            <span className="text-[11px] text-ink-muted">{label}</span>
            <input
              value={value}
              inputMode="numeric"
              onChange={(e) => set(e.target.value.replace(/[^0-9]/g, ""))}
              className="mt-0.5 w-24 rounded-md border border-line bg-panel px-2 py-1 font-mono text-[12px] text-ink focus:border-signal focus:outline-none"
            />
          </label>
        ))}
        <SmallButton onClick={apply} disabled={!dirty || saving}>
          {saving ? "Saving" : "Save caps"}
        </SmallButton>
      </div>
      <div className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
        0 means no cap. A cap stops the turn when it is reached - it doesn't warn and carry
        on. One message can be many calls at high effort, which is what makes a cap worth
        setting.
      </div>
      {problem && <div className="mt-1.5 text-[11px] text-danger">{problem}</div>}
    </div>
  );
}

function OwnModels({ data, save, onChanged }) {
  const [models, setModels] = useState(data.custom_models ?? []);
  const [installed, setInstalled] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(null);
  const [adding, setAdding] = useState(null); // "byom" | "byok" | null
  const [pick, setPick] = useState("");
  const [key, setKey] = useState({ label: "", base_url: "", model: "", key: "", vision: false });

  useEffect(() => {
    if (adding !== "byom" || installed !== null) return;
    getInstalledModels()
      .then((r) => setInstalled(r.models))
      .catch((e) => setError(e.message));
  }, [adding, installed]);

  async function refresh(payload) {
    setModels(payload.models);
    setError(null);
    await onChanged();
  }

  async function run(what, fn) {
    setBusy(what);
    setResult(null);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  const addOllama = () =>
    run("add", async () => {
      const r = await addCustomModel({ kind: "byom", model: pick });
      await refresh(r);
      setAdding(null);
      setPick("");
    });

  const addEndpoint = () =>
    run("add", async () => {
      const r = await addCustomModel({ kind: "byok", ...key });
      await refresh(r);
      setAdding(null);
      setKey({ label: "", base_url: "", model: "", key: "", vision: false });
      const test = await testCustomModel(r.model.id);
      setResult({ id: r.model.id, ...test });
    });

  return (
    <div>
      <GroupTitle>Your own models</GroupTitle>

      {models.length > 0 && (
        <div className="divide-y divide-line">
          {models.map((m) => (
            <Row
              key={m.id}
              label={m.label}
              description={
                m.kind === "byom"
                  ? `From your Ollama · ${m.model}${m.tools ? "" : " · can't call tools"}${m.vision ? " · sees images" : ""}`
                  : `Your endpoint · ${m.host} · ${m.model}${m.key_set ? ` · key ${m.key_hint}` : ""}`
              }
            >
              <div className="flex items-center gap-2">
                <Pill tone={m.kind === "byok" ? "danger" : "quiet"}>
                  {m.kind === "byok" ? "sends out" : "local"}
                </Pill>
                <SmallButton
                  onClick={() =>
                    run(`test-${m.id}`, async () => setResult({ id: m.id, ...(await testCustomModel(m.id)) }))
                  }
                  disabled={busy === `test-${m.id}`}
                >
                  {busy === `test-${m.id}` ? "Testing" : "Test"}
                </SmallButton>
                <SmallButton
                  danger
                  onClick={() =>
                    run(`del-${m.id}`, async () => {
                      if (!window.confirm(`Remove ${m.label}?`)) return;
                      await refresh(await deleteCustomModel(m.id));
                    })
                  }
                >
                  Remove
                </SmallButton>
              </div>
            </Row>
          ))}
        </div>
      )}

      {models.some((m) => m.kind === "byok") && (
        <div className="mt-1 space-y-2">
          {models
            .filter((m) => m.kind === "byok")
            .map((m) => (
              <div key={`spend-${m.id}`}>
                <div className="pb-1 text-[11px] text-ink-muted">{m.label} · spend</div>
                <Spend
                  model={m}
                  used={(data.usage ?? {})[m.id]}
                  onSave={async (caps) => {
                    const r = await patchCustomModel(m.id, caps);
                    await refresh(r);
                  }}
                />
              </div>
            ))}
        </div>
      )}

      {result && (
        <div
          className={`mt-2 rounded-md border px-3 py-2 text-xs leading-relaxed ${
            result.ok ? "border-phosphor-dim/50 bg-phosphor/5 text-ink" : "border-danger/40 bg-danger/5 text-danger"
          }`}
        >
          {result.detail}
        </div>
      )}
      {error && <div className="mt-2 text-xs text-danger">{error}</div>}

      {!adding && (
        <div className="mt-3 flex flex-wrap gap-2">
          <SmallButton onClick={() => setAdding("byom")}>Add an Ollama model</SmallButton>
          <SmallButton onClick={() => setAdding("byok")}>Add your own endpoint</SmallButton>
        </div>
      )}

      {adding === "byom" && (
        <div className="animate-rise mt-3 rounded-lg border border-line bg-panel p-3">
          <Note>
            Anything you have pulled in Ollama. It still runs here and nothing leaves this computer. Shadow's
            prompts are tuned for Qwen 3.5, so another model may use tools worse — Shadow reads what each one
            can do and tells you.
          </Note>
          {installed === null ? (
            <div className="shimmer mt-2 text-sm">Reading your Ollama</div>
          ) : (
            <div className="mt-2 max-h-56 space-y-0.5 overflow-y-auto">
              {installed.map((m) => (
                <button
                  key={m.model}
                  type="button"
                  onClick={() => setPick(m.model)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors duration-150 ${
                    pick === m.model ? "bg-panel-alt" : "hover:bg-panel-alt/60"
                  }`}
                >
                  <span className="truncate font-mono text-[13px] text-ink">{m.model}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-ink-muted">
                    {m.bytes ? <Bytes value={m.bytes} /> : null}
                    {m.tools ? <Pill tone="live">tools</Pill> : <Pill tone="warn">no tools</Pill>}
                    {m.vision && <Pill>vision</Pill>}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex justify-end gap-2">
            <SmallButton onClick={() => setAdding(null)}>Cancel</SmallButton>
            <SmallButton onClick={addOllama} disabled={!pick || busy === "add"}>
              {busy === "add" ? "Adding" : "Add"}
            </SmallButton>
          </div>
        </div>
      )}

      {adding === "byok" && (
        <div className="animate-rise mt-3 rounded-lg border border-danger/40 bg-danger/5 p-3">
          <div className="flex items-start gap-2.5">
            <OutboundIcon width={15} height={15} className="mt-0.5 shrink-0 text-danger" />
            <div className="text-xs leading-relaxed text-ink">
              <strong className="font-medium text-danger">This sends your conversation off this computer, and bills you for it.</strong>{" "}
              Everything in a turn goes to the endpoint you name: your messages, files Shadow read, tool
              results, and any images you attach. The provider decides what it keeps. Shadow's other models all
              run here; this one doesn't. Your key is stored in Shadow's data folder, readable only by you, and
              is sent to that endpoint and nowhere else.
              <div className="mt-2">
                The cost is yours. One message is not one call: Shadow works in steps, and at high
                effort a single turn can be dozens of calls, each one sending the whole conversation
                so far. Shadow counts the tokens the provider reports and can cap them, but it
                cannot know your rates, so it never shows a price.
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {[
              ["base_url", "Base URL", "https://api.openai.com/v1"],
              ["model", "Model name", "gpt-4o-mini"],
              ["label", "Name it (optional)", "Work GPT"],
            ].map(([field, label, placeholder]) => (
              <label key={field} className="block">
                <span className="text-[11px] text-ink-muted">{label}</span>
                <input
                  value={key[field]}
                  onChange={(e) => setKey({ ...key, [field]: e.target.value })}
                  placeholder={placeholder}
                  className="mt-0.5 w-full rounded-md border border-line bg-panel-alt px-2.5 py-1.5 font-mono text-[13px] text-ink placeholder:text-ink-muted focus:border-signal focus:outline-none"
                />
              </label>
            ))}
            <label className="block">
              <span className="text-[11px] text-ink-muted">API key</span>
              <input
                type="password"
                value={key.key}
                onChange={(e) => setKey({ ...key, key: e.target.value })}
                placeholder="sk-…"
                autoComplete="off"
                className="mt-0.5 w-full rounded-md border border-line bg-panel-alt px-2.5 py-1.5 font-mono text-[13px] text-ink placeholder:text-ink-muted focus:border-signal focus:outline-none"
              />
            </label>
            <label className="flex items-center justify-between gap-3 pt-1">
              <span className="text-xs text-ink-muted">
                This model can see images. Leave off if you're not sure — attachments will be refused rather
                than silently dropped.
              </span>
              <Toggle checked={key.vision} onChange={(v) => setKey({ ...key, vision: v })} />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-ink-muted">Shadow tests it as soon as you add it.</span>
            <div className="flex gap-2">
              <SmallButton onClick={() => setAdding(null)}>Cancel</SmallButton>
              <SmallButton
                onClick={addEndpoint}
                disabled={!key.base_url || !key.model || !key.key || busy === "add"}
              >
                {busy === "add" ? "Adding" : "Add and test"}
              </SmallButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BrainSection({ data, save, onChanged }) {
  const s = { ...data.settings, ...data.profile };
  const hw = data.hardware;
  const recommended = data.models.find((m) => m.id === data.recommended_model);

  return (
    <div>
      <div className="divide-y divide-line">
        <Row label="Router" description="Decides which skills and tools Shadow uses for each message.">
          <Segmented options={ROUTERS} value={s.router} onChange={(id) => save({ router: id })} />
        </Row>
      </div>

      <GroupTitle>Models</GroupTitle>
      <div className="divide-y divide-line">
        {data.models.map((m) => (
          <Row key={m.id} label={m.label} description={m.reason ?? m.description}>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[11px] text-ink-muted">{m.model}</span>
              <Pill tone={m.available ? "live" : "quiet"}>{m.available ? "ready" : "missing"}</Pill>
            </div>
          </Row>
        ))}
      </div>

      <OwnModels data={data} save={save} onChanged={onChanged} />

      <GroupTitle>Your computer</GroupTitle>
      <div className="pb-1">
        <Spec label="System" value={hw.os} />
        <Spec label="Chip" value={hw.machine} />
        <Spec label="CPU cores" value={hw.cpu_cores} />
        <Spec label="Memory" value={hw.ram_total_gb && `${hw.ram_total_gb} GB (${hw.ram_free_gb} GB free now)`} />
        <Spec label="Disk" value={`${hw.disk_free_gb} GB free of ${hw.disk_total_gb} GB`} />
      </div>
      {recommended && (
        <div className="border-t border-line">
          <Row
            label={`Recommended: ${recommended.label}`}
            description={
              recommended.available
                ? "Based on your total memory. If your computer feels slow, try one level lower."
                : recommended.reason
            }
          >
            {s.model === recommended.id ? (
              <Pill tone="live">in use</Pill>
            ) : (
              <SmallButton onClick={() => save({ model: recommended.id })} disabled={!recommended.available}>
                Use as default
              </SmallButton>
            )}
          </Row>
        </div>
      )}
    </div>
  );
}

function AboutSection({ data }) {
  const s = { ...data.settings, ...data.profile };
  const enabledTools = data.tools.filter((t) => t.state === "on").length;
  const shortcuts = [
    ["Send message", "Enter"],
    ["New line", "Shift + Enter"],
    ["Open settings", "⌘ ,"],
    ["Move between sections", "↑ ↓"],
    ["Close settings", "Esc"],
  ];

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg text-ink">shadow</span>
        <span className="font-mono text-xs text-ink-muted">v{data.version}</span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">A local AI assistant that runs on your own computer.</p>

      <GroupTitle>Running now</GroupTitle>
      <div>
        <Spec label="Assistant" value={s.name} />
        <Spec
          label="Router"
          value={s.router === "laya" ? (data.laya_loaded ? "Laya (loaded)" : "Laya (not loaded)") : "Keywords"}
        />
        <Spec label="Default model" value={data.models.find((m) => m.id === s.model)?.model} />
        <Spec label="Tools on" value={`${enabledTools} of ${data.tools.length}`} />
        <Spec label="Workspace" value={s.workspace} />
        <Spec label="Offline mode" value={s.offline ? "On — nothing leaves this computer" : "Off"} />
      </div>

      <GroupTitle>Keyboard shortcuts</GroupTitle>
      <div>
        {shortcuts.map(([label, keys]) => (
          <Spec key={label} label={label} value={keys} />
        ))}
      </div>
    </div>
  );
}

export default function SettingsModal({ open, onClose, onSaved, appearance, onAppearanceChange }) {
  // Kept mounted for the length of the closing animation, so the window
  // leaves the way it arrived instead of blinking out.
  const shell = useExit(open, 150);
  const [section, setSection] = useState("general");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [report, setReport] = useState(null);
  const [reportError, setReportError] = useState(null);
  const navRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    getSettings()
      .then(setData)
      .catch((e) => setError(e.message));
  }, [open]);

  // The privacy report reads real files, so it is only fetched for the two
  // sections that show it, and re-read after anything that could change it.
  const needsReport = open && (section === "privacy" || section === "data");
  useEffect(() => {
    if (!needsReport) return;
    setReportError(null);
    getPrivacy()
      .then(setReport)
      .catch((e) => setReportError(e.message));
  }, [needsReport]);

  async function reload() {
    try {
      const fresh = await getSettings();
      setData(fresh);
      // No patch: this is a refresh after adding or removing a model, so
      // nothing in it should be treated as a settings change.
      onSaved?.(fresh.settings, {});
    } catch (e) {
      setError(e.message);
    }
  }

  async function reloadReport() {
    try {
      const [fresh, settings] = await Promise.all([getPrivacy(), getSettings()]);
      setReport(fresh);
      setData(settings);
    } catch (e) {
      setReportError(e.message);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function save(patch) {
    try {
      const d = await updateSettings(patch);
      setData(d);
      setError(null);
      setNotice("Saved");
      onSaved?.(d.settings, patch);
      return d;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }

  // ↑/↓ moves between sections while the nav has focus.
  function onNavKey(e) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const i = SECTIONS.findIndex((s) => s.id === section);
    const next = SECTIONS[(i + (e.key === "ArrowDown" ? 1 : SECTIONS.length - 1)) % SECTIONS.length];
    setSection(next.id);
    navRef.current?.querySelector(`[data-section="${next.id}"]`)?.focus();
  }

  const current = useMemo(() => SECTIONS.find((s) => s.id === section), [section]);

  if (!shell.mounted) return null;

  function renderSection() {
    if (section === "appearance") {
      return <AppearanceSection appearance={appearance} onChange={onAppearanceChange} />;
    }
    if (!data) {
      return error ? null : <div className="shimmer font-mono text-xs text-ink-muted">loading…</div>;
    }
    switch (section) {
      case "general":
        return <GeneralSection data={data} save={save} />;
      case "personality":
        return <PersonalitySection data={data} save={save} />;
      case "memory":
        return <MemorySection data={data} save={save} />;
      case "tools":
        return <ToolsSection data={data} save={save} />;
      case "skills":
        return <SkillsSection />;
      case "privacy":
        return (
          <PrivacySection
            data={data}
            save={save}
            report={report}
            reportError={reportError}
            onReload={reloadReport}
          />
        );
      case "brain":
        return <BrainSection data={data} save={save} onChanged={reload} />;
      case "data":
        return (
          <DataSection
            data={data}
            report={report}
            reportError={reportError}
            onReload={reloadReport}
            onNotice={setNotice}
            onError={setError}
          />
        );
      case "about":
        return <AboutSection data={data} />;
      default:
        return null;
    }
  }

  const offline = !!data?.settings?.offline;

  return (
    <div
      className={`${
        shell.leaving ? "animate-fade-out pointer-events-none" : "animate-fade"
      } fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4`}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className={`${
          shell.leaving ? "animate-pop-out" : "animate-pop"
        } flex h-[min(680px,88vh)] w-full max-w-3xl overflow-hidden rounded-xl border border-line bg-panel shadow-2xl shadow-black/50`}
      >
        <nav
          ref={navRef}
          onKeyDown={onNavKey}
          aria-label="Settings sections"
          className="flex w-52 shrink-0 flex-col border-r border-line bg-bg/40 p-2"
        >
          <div className="px-2 pb-3 pt-1.5 text-sm text-ink">Settings</div>
          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
            {SECTIONS.map((s) => {
              const active = section === s.id;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  type="button"
                  data-section={s.id}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setSection(s.id)}
                  className={`relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-[background-color,color,transform] duration-150 ease-smooth active:scale-[0.99] ${
                    active ? "bg-panel-alt text-ink" : "text-ink/70 hover:bg-panel-alt/60 hover:text-ink"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-phosphor" />
                  )}
                  <Icon
                    width={15}
                    height={15}
                    className={`shrink-0 transition-colors duration-150 ${active ? "text-phosphor" : "text-ink-muted"}`}
                  />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center gap-2 border-t border-line px-2.5 pt-2.5 text-[11px] text-ink-muted">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${offline ? "bg-signal" : "bg-phosphor"}`} />
            <span className="truncate">{offline ? "Offline mode on" : "Local by default"}</span>
          </div>
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-start gap-3 border-b border-line px-5 pt-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm text-ink">{current.label}</h2>
              <p className="truncate text-[11px] text-ink-muted">{current.hint}</p>
            </div>
            <span className="mt-0.5 min-w-0 truncate text-xs">
              {error && <span className="text-danger">{error}</span>}
              {!error && notice && <span className="text-phosphor">{notice}</span>}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close settings"
              className="-mt-0.5 rounded-md p-1 text-ink-muted transition-colors hover:bg-panel-alt hover:text-ink active:scale-95"
            >
              <CloseIcon width={15} height={15} />
            </button>
          </header>
          <div key={section} className="animate-fade min-h-0 flex-1 overflow-y-auto px-5 py-3">
            {renderSection()}
          </div>
        </div>
      </div>
    </div>
  );
}
