import { useEffect, useState } from "react";

import { getNeededModels, getSettings, updateSettings } from "../../api.js";
import { AssistantIcon, CheckIcon } from "../Icons.jsx";
import AssistantWizard, { BLANK } from "./AssistantWizard.jsx";
import PullProgress from "./PullProgress.jsx";

/* First run. Four steps: what this is, who your assistant is, the download,
   and done.

   It sets up the assistant that already exists rather than creating one:
   the brain makes a 'default' assistant the first time anything asks for
   one, so creating here would leave an unused "Shadow" sitting beside the
   assistant the user actually named. PUT /settings writes to whichever
   assistant is active, which on first run is that one. */

function Shell({ children, step, steps }) {
  return (
    <div className="flex h-screen flex-col items-center overflow-y-auto bg-bg">
      <div className="w-full max-w-xl px-6 py-14">
        <div className="mb-8 flex items-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-0.5 flex-1 rounded-full transition-colors duration-200 ${
                i <= step ? "bg-phosphor" : "bg-line"
              }`}
            />
          ))}
        </div>
        <div className="animate-rise">{children}</div>
      </div>
    </div>
  );
}

function Title({ children, sub }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight text-ink">{children}</h1>
      {sub && <p className="mt-2 text-sm leading-relaxed text-ink-muted">{sub}</p>}
    </div>
  );
}

function Button({ children, onClick, disabled, variant = "primary" }) {
  const look =
    variant === "primary"
      ? "bg-phosphor-dim text-bg hover:bg-phosphor disabled:hover:bg-phosphor-dim"
      : "border border-line text-ink-muted hover:text-ink disabled:hover:text-ink-muted";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${look}`}
    >
      {children}
    </button>
  );
}

const STEPS = ["welcome", "assistant", "download", "done"];

export default function Onboarding({ onFinished }) {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState(null);
  const [profile, setProfile] = useState(BLANK);
  const [custom, setCustom] = useState(false);
  const [missing, setMissing] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setStatus(s);
        setProfile((p) => ({ ...p, model: s.recommended_model ?? "default" }));
      })
      .catch((e) => setError(e.message));
  }, []);

  const hw = status?.hardware;
  const models = status?.models ?? [];
  const name = profile.name.trim();

  /* Save the profile, then find out what still has to be downloaded. The
     check happens here rather than on the download step so a machine that
     already has both models skips that step instead of showing two bars
     that finish instantly. */
  async function saveAndContinue() {
    setSaving(true);
    setError(null);
    try {
      await updateSettings({ ...profile, name });
      const needed = await getNeededModels(profile.model);
      if (!needed.ollama_up) {
        setError(
          "Ollama isn't answering, so nothing can be downloaded yet. Start Ollama and try again."
        );
        return;
      }
      setMissing(needed.missing);
      setStep(needed.missing.length ? 2 : 3);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    setSaving(true);
    try {
      await updateSettings({ onboarded: true });
      onFinished();
    } catch (e) {
      setError(e.message);
      setSaving(false);
    }
  }

  const banner = error && (
    <div className="mt-4 rounded-md border border-danger/40 bg-danger/5 px-3 py-2.5 text-xs leading-relaxed text-ink">
      {error}
    </div>
  );

  if (STEPS[step] === "welcome") {
    return (
      <Shell step={0} steps={STEPS}>
        <Title sub="Everything runs on this computer. The models, your chats, what it remembers — all of it stays here. There's no account, and nothing to sign in to.">
          Shadow
        </Title>
        <div className="divide-y divide-line rounded-md border border-line">
          {[
            ["Local", "The model runs in Ollama on this machine. Shadow hosts nothing."],
            ["Yours", "Chats and memory are files in a folder you can read, move or delete."],
            ["Honest", "Anything that can leave this computer is listed in Settings, with a switch to block all of it."],
          ].map(([label, text]) => (
            <div key={label} className="px-4 py-3">
              <div className="text-sm text-ink">{label}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-ink-muted">{text}</div>
            </div>
          ))}
        </div>
        {hw && (
          <div className="mt-4 font-mono text-[11px] leading-relaxed text-ink-muted">
            {hw.os} · {hw.machine} · {hw.cpu_cores} cores
            {hw.ram_total_gb ? ` · ${hw.ram_total_gb}GB RAM` : ""}
            {hw.disk_free_gb ? ` · ${hw.disk_free_gb}GB free` : ""}
          </div>
        )}
        {banner}
        <div className="mt-7">
          <Button onClick={() => setStep(1)} disabled={!status}>
            Set up
          </Button>
        </div>
      </Shell>
    );
  }

  if (STEPS[step] === "assistant") {
    return (
      <Shell step={1} steps={STEPS}>
        <Title sub="Give it a name and it uses that instead of Shadow. Everything here can be changed later in Settings.">
          Your assistant
        </Title>

        {custom ? (
          <>
            <AssistantWizard
              value={profile}
              onChange={setProfile}
              models={models}
              tools={status?.tools ?? []}
              recommended={status?.recommended_model}
            />
            {banner}
            <div className="mt-7 flex items-center gap-2">
              <Button onClick={saveAndContinue} disabled={!name || saving}>
                {saving ? "Saving…" : "Continue"}
              </Button>
              <Button variant="quiet" onClick={() => setCustom(false)}>
                Back to quick start
              </Button>
            </div>
          </>
        ) : (
          <>
            <label className="block">
              <div className="text-sm text-ink">Name</div>
              <input
                className="mt-2 w-full rounded-md border border-line bg-panel-alt px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors duration-150 focus:border-signal focus:outline-none"
                value={profile.name}
                autoFocus
                maxLength={40}
                placeholder="Shadow"
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name && !saving) saveAndContinue();
                }}
              />
            </label>
            <div className="mt-4 rounded-md border border-line bg-panel-alt px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
              Quick start uses{" "}
              <span className="text-ink">
                {models.find((m) => m.id === profile.model)?.label ?? profile.model}
              </span>
              , medium effort, a friendly tone, and leaves anything that can run a command set to
              ask you first.
            </div>
            {banner}
            <div className="mt-7 flex items-center gap-2">
              <Button onClick={saveAndContinue} disabled={!name || saving}>
                {saving ? "Saving…" : "Quick start"}
              </Button>
              <Button variant="quiet" onClick={() => setCustom(true)} disabled={saving}>
                Customize
              </Button>
            </div>
          </>
        )}
      </Shell>
    );
  }

  if (STEPS[step] === "download") {
    return (
      <Shell step={2} steps={STEPS}>
        <Title sub="One is the model that answers you, the other is the small one that lets it remember things. Both come from Ollama and then stay on this computer.">
          Downloading
        </Title>
        <PullProgress models={missing ?? []} onDone={() => setStep(3)} onError={setError} />
        {error && (
          <div className="mt-6">
            <Button variant="quiet" onClick={() => setStep(3)}>
              Skip for now
            </Button>
          </div>
        )}
      </Shell>
    );
  }

  return (
    <Shell step={3} steps={STEPS}>
      <div className="flex items-center gap-2 text-phosphor">
        <CheckIcon />
        <span className="font-mono text-[11px] uppercase tracking-wider">Ready</span>
      </div>
      <div className="mt-4">
        <Title sub="You can make up to three assistants, each with its own chats and memory. The switcher is at the top of the sidebar.">
          {name || "Shadow"} is set up
        </Title>
      </div>
      <div className="flex items-center gap-3 rounded-md border border-line px-4 py-3">
        <AssistantIcon className="shrink-0 text-ink-muted" />
        <div className="min-w-0">
          <div className="text-sm text-ink">{name || "Shadow"}</div>
          <div className="font-mono text-[11px] text-ink-muted">
            {models.find((m) => m.id === profile.model)?.label ?? profile.model} · {profile.effort} effort
          </div>
        </div>
      </div>
      {banner}
      <div className="mt-7">
        <Button onClick={finish} disabled={saving}>
          Start chatting
        </Button>
      </div>
    </Shell>
  );
}
