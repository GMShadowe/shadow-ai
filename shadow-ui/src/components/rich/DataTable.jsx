import { useRef, useState } from "react";
import { CopyIcon, CheckIcon } from "../Icons.jsx";

/* A markdown table, made usable when it is bigger than the message column:
   the header stays put while the body scrolls, and the whole thing can be
   taken out as CSV. The table itself is still the markdown table - this only
   wraps it, so an export loses nothing. */

function toCsv(root) {
  const rows = [...root.querySelectorAll("tr")];
  return rows
    .map((tr) =>
      [...tr.children]
        .map((cell) => {
          const text = (cell.textContent ?? "").trim();
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(",")
    )
    .join("\n");
}

export default function DataTable({ children }) {
  const ref = useRef(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    const csv = toCsv(ref.current);
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; nothing else to do but leave the button alone
    }
  }

  return (
    <div className="group/table relative">
      <button
        type="button"
        onClick={copy}
        title="Copy as CSV"
        aria-label="Copy this table as CSV"
        className="absolute -top-1 right-0 z-20 flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-ink-muted opacity-0 transition-[opacity,background-color,color,transform] duration-150 ease-smooth hover:bg-panel-alt hover:text-ink active:scale-95 focus-visible:opacity-100 group-hover/table:opacity-100"
      >
        {copied ? (
          <CheckIcon key="done" width={11} height={11} className="animate-pop text-phosphor" />
        ) : (
          <CopyIcon key="copy" width={11} height={11} />
        )}
        {copied ? "Copied" : "CSV"}
      </button>
      {/* Scrolls on its own rather than stretching the message column. */}
      <div ref={ref} className="md-table md-table-rich">
        <table>{children}</table>
      </div>
    </div>
  );
}
