import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown.jsx";
import ToolCall from "./ToolCall.jsx";
import PermissionCard from "./PermissionCard.jsx";
import MessageActions from "./MessageActions.jsx";
import Lightbox from "./ui/Lightbox.jsx";
import { CloseIcon, PencilIcon } from "./Icons.jsx";
import ErrorAction from "./ErrorAction.jsx";

/* Which files this turn actually touched, as {name or path -> full path}.
   A path only becomes a chip if a tool in the same turn read or wrote it:
   inferred from the tool calls, never from anything the model wrote. */
const FILE_ARGS = {
  read_file: ["path"],
  write_file: ["path"],
  edit_file: ["path"],
  move_file: ["source", "dest"],
  delete_file: ["path"],
  list_dir: [],
  find_files: [],
};

function touchedFiles(tools) {
  const out = new Map();
  for (const call of tools ?? []) {
    if (call.kind === "permission") continue;
    for (const field of FILE_ARGS[call.name] ?? []) {
      const value = call.args?.[field];
      if (typeof value !== "string" || !value.trim()) continue;
      const path = value.trim();
      const name = path.split("/").pop();
      out.set(path, path);
      if (name && name !== path) out.set(name, path);
    }
  }
  return out;
}

function metaLine(message) {
  const probs = message.router?.probabilities;
  const top = probs ? Math.round(Math.max(...Object.values(probs)) * 100) : null;
  return [
    message.model,
    message.effort && `${message.effort} effort`,
    message.router?.method && `${message.router.method}${top !== null ? ` ${top}%` : ""}`,
    message.router?.ms > 0 && `${message.router.ms}ms`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* The last question, editable in place. Saving replaces the reply below it
   rather than adding a second one. */
function UserEditor({ message, onSave, onCancel }) {
  const [text, setText] = useState(message.content);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 240) + "px";
  }, []);

  const changed = text.trim() && text.trim() !== message.content;

  return (
    <div className="w-full max-w-[80%] space-y-2">
      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = Math.min(e.target.scrollHeight, 240) + "px";
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (changed) onSave(text.trim());
          }
          if (e.key === "Escape") onCancel();
        }}
        className="block w-full resize-none rounded-2xl rounded-br-md border border-signal bg-panel-alt px-4 py-2.5 text-[0.9375rem] leading-relaxed text-ink focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2 text-[11px]">
        <span className="mr-auto text-ink-muted">The reply below will be replaced.</span>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink active:scale-95"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(text.trim())}
          disabled={!changed}
          className="rounded-md border border-line bg-panel-alt px-2 py-1 text-ink transition-colors duration-150 hover:border-signal/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send again
        </button>
      </div>
    </div>
  );
}

export default function Message({
  message,
  onPermission,
  reasons = [],
  canRegenerate = false,
  canEdit = false,
  busy = false,
  onRegenerate,
  onEdit,
  onRate,
  onOpenSettings,
}) {
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState(null);

  if (message.role === "user") {
    if (editing) {
      return (
        <div className="animate-rise flex flex-col items-end gap-2">
          <UserEditor
            message={message}
            onCancel={() => setEditing(false)}
            onSave={(text) => {
              setEditing(false);
              onEdit(text);
            }}
          />
        </div>
      );
    }

    return (
      <div className="group animate-rise flex flex-col items-end gap-2">
        {message.images?.length > 0 && (
          <div className="flex max-w-[80%] flex-wrap justify-end gap-2">
            {message.images.map((src, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setZoomed(src)}
                title="Open larger"
                aria-label="Open this image larger"
                className="group/img block overflow-hidden rounded-lg border border-line transition-colors duration-150 hover:border-signal/50"
              >
                <img
                  src={src}
                  alt="Attached"
                  className="max-h-52 max-w-64 cursor-zoom-in object-cover transition-transform duration-150 ease-smooth group-hover/img:scale-[1.03]"
                />
              </button>
            ))}
          </div>
        )}
        {zoomed && <Lightbox src={zoomed} onClose={() => setZoomed(null)} />}
        {message.content && (
          <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-line bg-panel-alt px-4 py-2.5 text-[0.9375rem] leading-relaxed text-ink">
            {message.content}
          </div>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            title="Edit and send again"
            aria-label="Edit this message and send it again"
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-ink-muted opacity-0 transition-[opacity,background-color,color,transform] duration-150 ease-smooth hover:bg-panel-alt hover:text-ink active:scale-95 group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
          >
            <PencilIcon width={11} height={11} />
            Edit
          </button>
        )}
      </div>
    );
  }

  if (message.role === "error") {
    return (
      <div className="animate-rise rounded-lg border border-danger/40 bg-danger/5 px-4 py-3">
        <div className="flex items-start gap-2.5 text-sm text-danger">
          <CloseIcon width={14} height={14} className="mt-0.5 shrink-0" />
          <span>{message.content}</span>
        </div>
        {/* Where there is an obvious way forward, offer it instead of
            describing it. A reopened chat has no action, but the saved text
            still carries the command, so nothing is lost but the shortcut. */}
        {message.error && (
          <ErrorAction
            failure={message.error}
            onRetry={canRegenerate ? onRegenerate : null}
            onSettings={onOpenSettings}
          />
        )}
      </div>
    );
  }

  const tools = message.tools ?? [];
  const waiting = message.streaming && !message.content && tools.length === 0;
  const text = message.streaming && message.content ? message.content + " ▍" : message.content;

  return (
    <div className="group animate-rise space-y-3">
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span
          className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
            message.streaming ? "animate-pulse bg-phosphor" : "bg-phosphor/50"
          }`}
        />
        <span className="text-ink/75">{message.route ?? "routing"}</span>
        {message.skill && (
          <span className="text-ink/75" title={`The ${message.skill} skill ran on this message`}>
            /{message.skill}
          </span>
        )}
        {/* The model and effort were dimmed twice over and hard to read. */}
        <span className="truncate text-ink-muted">{metaLine(message)}</span>
      </div>

      {tools.length > 0 && (
        <div className="space-y-1.5">
          {tools.map((t, i) =>
            t.kind === "permission" ? (
              <PermissionCard key={t.id} request={t} onAnswer={onPermission} />
            ) : (
              <ToolCall key={i} call={t} />
            )
          )}
        </div>
      )}

      {waiting && <div className="shimmer text-sm font-medium">Thinking</div>}

      {text && <Markdown text={text} files={touchedFiles(tools)} />}

      {message.stopped && <div className="font-mono text-[11px] text-ink-muted">Stopped</div>}

      {!message.streaming && message.content && onRate && (
        <MessageActions
          message={message}
          reasons={reasons}
          canRegenerate={canRegenerate}
          busy={busy}
          onRegenerate={onRegenerate}
          onRate={onRate}
        />
      )}
    </div>
  );
}
