import { useEffect, useState } from "react";

import {
  activateAssistant,
  createAssistant,
  deleteAssistant,
  getSettings,
  listAssistants,
  patchAssistant,
} from "../../api.js";
import { AssistantIcon, CheckIcon, CloseIcon, PencilIcon, PlusIcon, TrashIcon } from "../Icons.jsx";
import AssistantWizard, { BLANK } from "./AssistantWizard.jsx";

/* The assistant dashboard. Up to three cards, each one its own set of chats
   and memory.

   Reached from the switcher at the top of the sidebar, not on launch: the
   app opens straight into the last assistant's chat, because putting a
   chooser in front of every session would tax the common case to serve the
   rare one. */

function Card({ assistant, modelLabel, onSwitch, onEdit, onDelete, busy }) {
  const { name, active, chats, memories } = assistant;
  return (
    <div
      className={`group relative rounded-lg border p-4 transition-colors duration-150 ${
        active ? "border-phosphor-dim/60 bg-panel" : "border-line bg-panel hover:border-line/80"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <AssistantIcon className={active ? "text-phosphor" : "text-ink-muted"} />
        {active ? (
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-phosphor">
            <CheckIcon width={11} height={11} />
            Active
          </span>
        ) : (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <button
              type="button"
              title={`Delete ${name}`}
              disabled={busy}
              onClick={onDelete}
              className="rounded p-1 text-ink-muted transition-colors duration-150 hover:text-danger disabled:opacity-40"
            >
              <TrashIcon width={14} height={14} />
            </button>
          </div>
        )}
      </div>

      <div className="mt-3 truncate text-sm text-ink" title={name}>
        {name}
      </div>
      <div className="mt-1 font-mono text-[11px] text-ink-muted">{modelLabel}</div>
      <div className="mt-0.5 font-mono text-[11px] text-ink-muted">
        {chats} {chats === 1 ? "chat" : "chats"} · {memories}{" "}
        {memories === 1 ? "memory" : "memories"}
      </div>

      <div className="mt-4 flex items-center gap-2">
        {active ? (
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs text-ink-muted transition-colors duration-150 hover:text-ink"
          >
            <PencilIcon width={13} height={13} />
            Edit
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onSwitch}
              disabled={busy}
              className="rounded-md bg-phosphor-dim px-2.5 py-1 text-xs font-medium text-bg transition-all duration-150 hover:bg-phosphor active:scale-[0.97] disabled:opacity-40"
            >
              Switch to
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              <PencilIcon width={13} height={13} />
              Edit
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* Deleting takes the chats, the memory and the images with it, so the
   confirmation says the real numbers rather than asking "are you sure?". */
function ConfirmDelete({ assistant, onCancel, onConfirm, busy }) {
  const { name, chats, memories } = assistant;
  const nothing = !chats && !memories;
  return (
    <div className="rounded-lg border border-danger/40 bg-danger/5 p-4">
      <div className="text-sm text-ink">Delete {name}?</div>
      <div className="mt-1.5 text-xs leading-relaxed text-ink-muted">
        {nothing
          ? "It has no chats or memories yet, so nothing is lost but the assistant itself."
          : `This permanently deletes ${chats} ${chats === 1 ? "chat" : "chats"} and ${memories} ${
              memories === 1 ? "memory" : "memories"
            }, and any images in them. It can't be undone.`}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="rounded-md border border-danger/60 px-3 py-1.5 text-xs font-medium text-danger transition-colors duration-150 hover:bg-danger/10 disabled:opacity-40"
        >
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-xs text-ink-muted transition-colors duration-150 hover:text-ink disabled:opacity-40"
        >
          Keep it
        </button>
      </div>
    </div>
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

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && !editing && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [editing, onClose]);

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
      await load();
      onSwitched?.();
    } catch (e) {
      setError(e.message);
    } finally {
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
        onSwitched?.();
      } else {
        // Edits land on the named assistant whether or not it is the active
        // one, so renaming another assistant doesn't switch you into it.
        await patchAssistant(editing, { ...draft, name });
        if (editing === data?.active) onEdited?.();
      }
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

  const banner = error && (
    <div className="mb-4 rounded-md border border-danger/40 bg-danger/5 px-3 py-2.5 text-xs leading-relaxed text-ink">
      {error}
    </div>
  );

  if (editing) {
    const isNew = editing === "new";
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-6 py-10">
          <div className="animate-rise">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-semibold tracking-tight text-ink">
                  {isNew ? "New assistant" : `Edit ${draft.name || "assistant"}`}
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                  {isNew
                    ? "It gets its own chats and its own memory. Nothing is shared with your other assistants except the downloaded models."
                    : "Changes apply from its next message. Editing doesn't switch you to it."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded p-1 text-ink-muted transition-colors duration-150 hover:text-ink"
                title="Cancel"
              >
                <CloseIcon />
              </button>
            </div>
            {banner}
            <AssistantWizard
              value={draft}
              onChange={setDraft}
              models={models}
              tools={status?.tools ?? []}
              recommended={status?.recommended_model}
            />
            <div className="mt-7 flex items-center gap-2">
              <button
                type="button"
                onClick={saveDraft}
                disabled={!draft.name.trim() || busy}
                className="rounded-md bg-phosphor-dim px-4 py-2 text-sm font-medium text-bg transition-all duration-150 hover:bg-phosphor active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Saving…" : isNew ? "Create assistant" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={busy}
                className="rounded-md border border-line px-4 py-2 text-sm text-ink-muted transition-colors duration-150 hover:text-ink disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="animate-rise">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-ink">Assistants</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                Each one keeps its own chats and its own memory. They share the models already
                downloaded, so another one costs nothing to run.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-ink-muted transition-colors duration-150 hover:text-ink"
              title="Back to chat"
            >
              <CloseIcon />
            </button>
          </div>

          {banner}

          {confirming && (
            <div className="mb-4 animate-rise">
              <ConfirmDelete
                assistant={confirming}
                busy={busy}
                onCancel={() => setConfirming(null)}
                onConfirm={() => handleDelete(confirming.id)}
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assistants.map((a) => (
              <Card
                key={a.id}
                assistant={a}
                modelLabel={label(a.model)}
                busy={busy}
                onSwitch={() => handleSwitch(a.id)}
                onEdit={() => startEdit(a)}
                onDelete={() => setConfirming(a)}
              />
            ))}

            {full ? (
              <div className="rounded-lg border border-dashed border-line p-4">
                <div className="text-sm text-ink-muted">
                  {max} is the most Shadow keeps
                </div>
                <div className="mt-1 text-xs leading-relaxed text-ink-muted">
                  Delete one to make room, or edit an existing assistant instead.
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDraft({ ...BLANK, model: status?.recommended_model ?? "default" });
                  setEditing("new");
                }}
                className="flex min-h-[9.5rem] flex-col items-start justify-center gap-2 rounded-lg border border-dashed border-line p-4 text-left transition-colors duration-150 hover:border-phosphor-dim/60"
              >
                <PlusIcon className="text-ink-muted" />
                <div>
                  <div className="text-sm text-ink">New assistant</div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {assistants.length} of {max} used
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
