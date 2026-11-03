import { useRef, useState, type ReactNode } from "react";
import { CheckIcon, CopyIcon } from "@/components/icons";

/* A markdown table made usable when it is bigger than the message column:
   the header stays put while the body scrolls, and the whole thing can be
   taken out as CSV. */

function toCsv(root: HTMLElement): string {
  return [...root.querySelectorAll("tr")]
    .map((tr) =>
      [...tr.children]
        .map((cell) => {
          const text = (cell.textContent ?? "").trim();
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(","),
    )
    .join("\n");
}

export default function DataTable({ children }: { children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!ref.current) return;
    try {
      await navigator.clipboard.writeText(toCsv(ref.current));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  }

  return (
    <div className="group/table relative">
      <button
        type="button"
        onClick={copy}
        title="Copy as CSV"
        aria-label="Copy this table as CSV"
        className="absolute -top-1 right-0 z-20 flex items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1 text-[11px] text-ink-muted opacity-0 transition-[opacity,background-color,color,scale] duration-150 ease-smooth hover:bg-panel-alt hover:text-ink active:scale-[0.96] focus-visible:opacity-100 group-hover/table:opacity-100"
      >
        {copied ? <CheckIcon width={11} height={11} className="text-phosphor" /> : <CopyIcon width={11} height={11} />}
        {copied ? "Copied" : "CSV"}
      </button>
      <div ref={ref} className="md-table md-table-rich">
        <table>{children}</table>
      </div>
    </div>
  );
}
