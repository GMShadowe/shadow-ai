import { useState, type ComponentType, type ReactNode } from "react";
import { CheckIcon, CopyIcon, type IconProps } from "@/components/icons";

interface FrameProps {
  icon: ComponentType<IconProps>;
  title: string;
  meta?: string | null;
  copyText?: string;
  children: ReactNode;
}

/* The shell every display card shares: an icon and a title, an optional
   count, and a copy button that copies the card as plain text. */
export default function Frame({ icon: Icon, title, meta, copyText, children }: FrameProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch (e) {
      console.warn("[card] couldn't copy:", (e as Error).message);
    }
  }

  return (
    <section className="animate-rise overflow-hidden rounded-2xl border border-line bg-panel" aria-label={title}>
      <header className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
        <Icon width={15} height={15} className="shrink-0 text-ink-muted" />
        <h3 className="min-w-0 truncate text-[14px] font-semibold text-ink">{title}</h3>
        {meta && <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-ink-muted">{meta}</span>}
        {copyText && (
          <button
            type="button"
            onClick={copy}
            title={copied ? "Copied" : "Copy as text"}
            aria-label="Copy as text"
            className={`${meta ? "" : "ml-auto"} shrink-0 rounded-md p-1 text-ink-muted transition-[color,scale] duration-150 ease-smooth hover:text-ink active:scale-[0.96]`}
          >
            {copied ? <CheckIcon width={13} height={13} className="text-phosphor" /> : <CopyIcon width={13} height={13} />}
          </button>
        )}
      </header>
      {children}
    </section>
  );
}
