import { useState } from "react";
import { openWorkspaceFile } from "@/lib/api";

/* A file path in a reply, when a tool in that same turn actually touched
   that file. Clicking it opens the file. The path still reads as a path, so
   an export of the conversation says exactly what it said before. */

const KIND: Record<string, string> = {
  py: "python", js: "js", jsx: "jsx", ts: "ts", tsx: "tsx", json: "json",
  md: "md", txt: "text", csv: "csv", html: "html", css: "css", sh: "shell",
  yml: "yaml", yaml: "yaml", toml: "toml", sql: "sql", png: "image",
  jpg: "image", jpeg: "image", gif: "image", svg: "image", pdf: "pdf",
};

export default function FileChip({ path, name }: { path: string; name: string }) {
  const [state, setState] = useState<string | null>(null); // null | "opening" | error text
  const [note, setNote] = useState<string | null>(null);
  const kind = KIND[(name.split(".").pop() ?? "").toLowerCase()];
  const failed = state !== null && state !== "opening";

  async function open() {
    setState("opening");
    try {
      const result = await openWorkspaceFile(path);
      setNote(result?.revealed ? "Shown in your file manager rather than opened, since opening it could run it as a program" : null);
      setState(null);
    } catch (e) {
      setState((e as Error).message);
    }
  }

  return (
    <button
      type="button"
      onClick={open}
      title={failed ? state : (note ?? `Open ${path}`)}
      className={`inline-flex max-w-full items-baseline gap-1.5 rounded-md border px-1.5 py-px align-baseline font-mono text-[0.85em] transition-[background-color,border-color,scale] duration-150 active:scale-[0.96] ${
        failed ? "border-danger/40 bg-danger/5 text-danger" : "border-line bg-ink/[0.04] text-ink hover:border-signal/50"
      }`}
    >
      <span className="truncate">{name}</span>
      {kind && <span className="shrink-0 text-[0.75em] text-ink-muted">{kind}</span>}
      {state === "opening" && <span className="spinner shrink-0" aria-hidden="true" />}
    </button>
  );
}
