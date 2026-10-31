import { useState } from "react";
import { CheckIcon, CopyIcon } from "../../Icons.jsx";

/* The shell every display card shares: a white block with a hairline
   border, an icon and a title, an optional count, and a copy button that
   copies the card as plain text - so what is on screen can go anywhere. */
export default function Frame({ icon: Icon, title, meta, copyText, children }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (e) {
      console.warn("[card] couldn't copy:", e.message);
    }
  }

  return (
    <section className="animate-rise overflow-hidden rounded-2xl border border-line bg-panel" aria-label={title}>
      <header className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <Icon width={15} height={15} className="shrink-0 text-ink-muted" />
        <h3 className="min-w-0 truncate text-[14px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
        {meta && <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-muted">{meta}</span>}
        {copyText && (
          <button
            type="button"
            onClick={copy}
            title={copied ? "Copied" : "Copy as text"}
            aria-label="Copy as text"
            className={`${meta ? "" : "ml-auto"} shrink-0 rounded-md p-1 text-ink-muted transition-[color,transform] duration-150 ease-smooth hover:text-ink active:scale-90`}
          >
            {copied ? <CheckIcon width={13} height={13} className="text-phosphor" /> : <CopyIcon width={13} height={13} />}
          </button>
        )}
      </header>
      {children}
    </section>
  );
}
