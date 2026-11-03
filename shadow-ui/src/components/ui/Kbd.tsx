import type { ReactNode } from "react";

/* A key on the keyboard, shown inline: Ctrl K, ↵. */
export default function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line bg-panel-alt/70 px-1.5 font-mono text-[10px] leading-none text-ink-muted">
      {children}
    </kbd>
  );
}
