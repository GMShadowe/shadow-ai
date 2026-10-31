import { useEffect, useState } from "react";

import {
  activateAssistant,
  createAssistant,
  deleteAssistant,
  getSettings,
  listAssistants,
  patchAssistant,
} from "../../api.js";
import { ArrowLeftIcon, PencilIcon, PlusIcon, TerminalIcon, TrashIcon } from "../Icons.jsx";
import AssistantWizard, { BLANK } from "./AssistantWizard.jsx";

/* The assistant dashboard: a full screen of its own, up to three cards, each
   one its own set of chats and memory.

   Reached from the switcher at the top of the sidebar, not on launch: the
   app opens straight into the last assistant's chat, because putting a
   chooser in front of every session would tax the common case to serve the
   rare one. */

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");

const PRIMARY =
  "rounded-lg bg-phosphor px-3.5 py-2 text-[13px] font-medium text-bg transition-[opacity,transform] duration-150 ease-smooth hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40 disabled:active:scale-100";
const SECONDARY =
  "flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-2 text-[13px] text-ink-muted transition-[color,border-color,transform] duration-150 ease-smooth hover:border-ink-muted/40 hover:text-ink active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";

function Shell({ onBack, backLabel, escapes = true, children }) {
  return (
    <div className="animate-fade flex h-screen flex-col overflow-y-auto bg-bg">
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between bg-bg/80 px-6 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className="relative grid h-7 w-7 place-items-center rounded-[9px] bg-ink text-bg">
            <TerminalIcon width={16} height={16} />
            <span className="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full bg-phosphor ring-2 ring-bg" />
          </span>
          <span className="text-[16px] font-semibold tracking-[-0.03em] text-ink">shadow</span>
        </div>
        <button type="button" onClick={onBack} className={SECONDARY}>
          <ArrowLeftIcon width={14} height={14} />
          {backLabel}
          {escapes && <kbd className="ml-1 rounded border border-line px-1 font-mono text-[10px] text-ink-muted">esc</kbd>}
        </button>
      </header>
      {children}
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div className="px-4 py-3 first:pl-0">
      <div className="text-[22px] font-medium leading-none tracking-[-0.02em] text-ink tabular-nums">{value}</div>
      <div className="mt-1.5 text-[11px] text-ink-muted">{label}</div>
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-[13px] text-ink">{children}</dd>
    </div>
  );
}

/* Deleting takes the chats, the memory and the images with it, so the
   confirmation says the real numbers rather than asking "are you sure?". */
function ConfirmDelete({ assistant, onCancel, onConfirm, busy }) {
  const { name, chats, memories } = assistant;
  const nothing = !chats && !memories;
  return (
    <div className="animate-fade absolute inset-0 z-10 flex flex-col rounded-2xl bg-panel p-5">
      <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Delete {name}?</div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        {nothing
          ? "It has no chats or memories yet, so nothing is lost but the assistant itself."
          : `This permanently deletes ${plural(chats, "chat", "chats")} and ${plural(
              memories,
              "memory",
              "memories",
            )}, and any images in them. It can't be undone.`}
      </p>
      <div className="mt-auto flex items-center gap-2 pt-4">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-lg bg-danger px-3.5 py-2 text-[13px] font-medium text-bg transition-[opacity,transform] duration-150 ease-smooth hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} className={SECONDARY}>
          Keep it
        </button>
      </div>
    </div>
  );
}

function Card({ assistant, modelLabel, onSwitch, onOpen, onEdit, onDelete, confirming, onConfirm, onCancel, canDelete, busy }) {
  const { name, active, chats, memories, effort, tone, auto_memory, location } = assistant;
  return (
    <article
      className={`group relative flex min-h-[22rem] flex-col rounded-2xl border bg-panel p-5 transition-[border-color,box-shadow] duration-200 ease-smooth ${
        active
          ? "border-phosphor/40 shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-phosphor)_8%,transparent)]"
          : "border-line hover:border-ink-muted/30"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[17px] font-semibold ${
            active ? "bg-phosphor text-bg" : "bg-panel-alt text-ink"
          }`}
        >
          {name.trim()[0]?.toUpperCase() ?? "?"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-ink" title={name}>
            {name}
          </h2>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px]">
            {active ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-phosphor" />
                <span className="text-phosphor">Active now</span>
              </>
            ) : (
              <span className="text-ink-muted">Not active</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 divide-x divide-line border-y border-line">
        <Stat value={chats} label={chats === 1 ? "chat" : "chats"} />
        <Stat value={memories} label={memories === 1 ? "memory" : "memories"} />
      </div>

      <dl className="mt-3">
        <Detail label="Model">{modelLabel}</Detail>
        <Detail label="Effort">{capital(effort)}</Detail>
        <Detail label="Tone">{capital(tone)}</Detail>
        <Detail label="Memory">{auto_memory ? "Saves on its own" : "When asked"}</Detail>
        <Detail label="Location">{location ? capital(location) : <span className="text-ink-muted">Not set</span>}</Detail>
      </dl>

      <div className="mt-auto flex items-center gap-2 pt-5">
        {active ? (
          <button type="button" onClick={onOpen} className={PRIMARY}>
            Open chat
          </button>
        ) : (
          <button type="button" onClick={onSwitch} disabled={busy} className={PRIMARY}>
            Switch to
          </button>
        )}
        <button type="button" onClick={onEdit} disabled={busy} className={SECONDARY}>
          <PencilIcon width={13} height={13} />
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy || !canDelete}
          title={canDelete ? `Delete ${name}` : "The last assistant can't be deleted"}
          aria-label={`Delete ${name}`}
          className="ml-auto rounded-lg p-2 text-ink-muted transition-[color,background-color,transform] duration-150 ease-smooth hover:bg-danger/5 hover:text-danger active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted disabled:active:scale-100"
        >
          <TrashIcon width={15} height={15} />
        </button>
      </div>

      {confirming && <ConfirmDelete assistant={assistant} busy={busy} onCancel={onCancel} onConfirm={onConfirm} />}
    </article>
  );
}

function EmptySlot({ used, max, full, onCreate }) {
  if (full) {
    return (
      <div className="flex min-h-[22rem] flex-col items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center">
        <div className="text-[14px] font-medium text-ink">{max} is the most Shadow keeps</div>
        <p className="mt-1.5 max-w-[16rem] text-[13px] leading-relaxed text-ink-muted">
          Delete one to make room, or edit an existing assistant instead.
        </p>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onCreate}
      className="group flex min-h-[22rem] flex-col items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center transition-[border-color,background-color] duration-200 ease-smooth hover:border-phosphor/50 hover:bg-panel/60"
    >
      <span className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-panel text-ink-muted transition-[color,transform] duration-200 ease-smooth group-hover:scale-105 group-hover:text-phosphor">
        <PlusIcon width={16} height={16} />
      </span>
      <div className="mt-3 text-[14px] font-medium text-ink">New assistant</div>
      <div className="mt-1 font-mono text-[11px] text-ink-muted">
        {used} of {max} used
      </div>
    </button>
  );
}

export default function Dashboard({ onClose, onSwitched, onEdited }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);
  // Either "new", or the id of the assistant being edited.
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(BLANK);

  async function load() {
    try {
      const [list, s] = await Promise.all([listAssistants(), getSettings()]);
      setData(list);
      setStatus(s);
      return list;
    } catch (e) {
      setError(e.message);
      return null;
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Escape backs out one level: a delete prompt, then the dashboard. It does
  // nothing inside the edit form, where it would throw away what was typed.
  useEffect(() => {
    const esc = (e) => {
      if (e.key !== "Escape" || editing) return;
      if (confirming) setConfirming(null);
      else onClose();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [editing, confirming, onClose]);

  const models = status?.models ?? [];
  const assistants = data?.assistants ?? [];
  const max = data?.max ?? 3;
  const full = assistants.length >= max;
  const label = (id) => models.find((m) => m.id === id)?.label ?? id;

  async function handleSwitch(id) {
    setBusy(true);
    setError(null);
    try {
      await activateAssistant(id);
      await onSwitched?.();
      onClose();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function handleDelete(id) {
    setBusy(true);
    setError(null);
    try {
      await deleteAssistant(id);
      setConfirming(null);
      const list = await load();
      // Deleting the active assistant moves the pointer, so the chat behind
      // this screen is now showing someone else's conversations.
      if (list) onSwitched?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    const name = draft.name.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      if (editing === "new") {
        const { assistant } = await createAssistant(name, draft);
        // A new assistant is only useful once you are in it.
        await activateAssistant(assistant.id);
        await onSwitched?.();
        onClose();
        return;
      }
      // Edits land on the named assistant whether or not it is the active
      // one, so renaming another assistant doesn't switch you into it.
      await patchAssistant(editing, { ...draft, name });
      if (editing === data?.active) onEdited?.();
      setEditing(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(assistant) {
    // GET /assistants carries each full profile, so an edit form starts
    // from what that assistant actually is - not from the defaults, which
    // would silently wipe its tone and instructions on save.
    setDraft({ ...BLANK, ...assistant });
    setEditing(assistant.id);
  }

  function startNew() {
    setDraft({ ...BLANK, model: status?.recommended_model ?? "default" });
    setEditing("new");
  }

  const banner = error && (
    <div className="animate-rise mb-6 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-[13px] leading-relaxed text-ink">
      {error}
    </div>
  );

  if (editing) {
    const isNew = editing === "new";
    return (
      <Shell onBack={() => setEditing(null)} backLabel="Back to assistants" escapes={false}>
        <main className="mx-auto w-full max-w-xl px-6 pb-16 pt-10">
          <div className="animate-rise">
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              {isNew ? "New assistant" : "Edit assistant"}
            </div>
            <h1 className="mt-2 text-[clamp(1.75rem,3vw,2.25rem)] font-medium leading-[1.1] tracking-[-0.035em] text-ink">
              {isNew ? "Make a new assistant" : draft.name || "Unnamed assistant"}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
              {isNew
                ? "It gets its own chats and its own memory. Nothing is shared with your other assistants except the downloaded models."
                : "Changes apply from its next message. Editing doesn't switch you to it."}
            </p>
            <div className="mt-8">
              {banner}
              <AssistantWizard
                value={draft}
                onChange={setDraft}
                models={models}
                tools={status?.tools ?? []}
                recommended={status?.recommended_model}
              />
            </div>
            <div className="mt-8 flex items-center gap-2 border-t border-line pt-6">
              <button type="button" onClick={saveDraft} disabled={!draft.name.trim() || busy} className={PRIMARY}>
                {busy ? "Saving…" : isNew ? "Create and open" : "Save changes"}
              </button>
              <button type="button" onClick={() => setEditing(null)} disabled={busy} className={SECONDARY}>
                Cancel
              </button>
            </div>
          </div>
        </main>
      </Shell>
    );
  }

  return (
    <Shell onBack={onClose} backLabel="Back to chat">
      <main className="mx-auto w-full max-w-5xl px-6 pb-16 pt-12 sm:px-10">
        <div className="animate-rise">
          <div className="max-w-xl">
            <div className="font-mono text-[11px] uppercase tracking-wider text-ink-muted">
              {data ? `${assistants.length} of ${max}` : "Assistants"}
            </div>
            <h1 className="mt-2 text-[clamp(2rem,4vw,2.75rem)] font-medium leading-[1.05] tracking-[-0.035em] text-ink">
              Your assistants
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
              Each one keeps its own chats and its own memory. They share the models already downloaded, so
              another one costs nothing to run.
            </p>
          </div>
        </div>

        <div className="mt-10">
          {banner}
          {!data && !error ? (
            <div className="shimmer wait-to-show text-sm font-medium">Loading assistants</div>
          ) : (
            <div className="animate-rise grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assistants.map((a) => (
                <Card
                  key={a.id}
                  assistant={a}
                  modelLabel={label(a.model)}
                  busy={busy}
                  canDelete={assistants.length > 1}
                  confirming={confirming === a.id}
                  onOpen={onClose}
                  onSwitch={() => handleSwitch(a.id)}
                  onEdit={() => startEdit(a)}
                  onDelete={() => setConfirming(a.id)}
                  onConfirm={() => handleDelete(a.id)}
                  onCancel={() => setConfirming(null)}
                />
              ))}
              <EmptySlot used={assistants.length} max={max} full={full} onCreate={startNew} />
            </div>
          )}
        </div>
      </main>
    </Shell>
  );
}
