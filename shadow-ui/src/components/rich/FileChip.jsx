import { useState } from "react";
import { openWorkspaceFile } from "../../api.js";

/* A file path in a reply, when a tool in that same turn actually touched
   that file. It is a chip rather than text because this is the single most
   common thing a Shadow reply refers to, and clicking it opens the file.

   The path still reads as a path, so an export of the conversation says
   exactly what it said before. */

const KIND = {
  py: "python", js: "js", jsx: "jsx", ts: "ts", tsx: "tsx", json: "json",
  md: "md", txt: "text", csv: "csv", html: "html", css: "css", sh: "shell",
  yml: "yaml", yaml: "yaml", toml: "toml", sql: "sql", png: "image",
  jpg: "image", jpeg: "image", gif: "image", svg: "image", pdf: "pdf",
};

export default function FileChip({ path, name }) {
  const [state, setState] = useState(null); // null | "opening" | error text
  const [note, setNote] = useState(null);
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  const kind = KIND[ext];

  async function open() {
    setState("opening");
    try {
      const result = await openWorkspaceFile(path);
      setNote(result?.revealed
        ? "Shown in your file manager rather than opened, since opening it could run it as a program"
        : null);
      setState(null);
    } catch (e) {
      setState(e.message);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      title={state && state !== "opening" ? state : note ?? `Open ${path}`}
      className={`inline-flex max-w-full items-baseline gap-1.5 rounded-md border px-1.5 py-px align-baseline font-mono text-[0.85em] transition-colors duration-150 active:scale-[0.98] ${
        state && state !== "opening"
          ? "border-danger/40 bg-danger/5 text-danger"
          : "border-line bg-panel-alt/70 text-ink hover:border-signal/50 hover:bg-panel-alt"
      }`}
    >
      <span className="truncate">{name}</span>
      {kind && <span className="shrink-0 text-[0.75em] text-ink-muted">{kind}</span>}
      {state === "opening" && <span className="spinner shrink-0" aria-hidden="true" />}
    </button>
  );
}
