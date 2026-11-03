import { seconds, useNow } from "@/hooks/useNow";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/* What Shadow is doing before the first word arrives, and for how long.

   A braille spinner in mono (the terminal heritage, at 11px), a word for the
   phase, and a running clock in tabular figures so it doesn't jitter. The
   clock is the detail that matters: on a small local model a reply can take
   a while, and a number that moves says it hasn't hung. */

const FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

interface ThinkingIndicatorProps {
  startedAt?: number;
  phase: string;
}

export default function ThinkingIndicator({ startedAt, phase }: ThinkingIndicatorProps) {
  const reduce = useReducedMotion();
  const now = useNow(true, 80);
  const frame = reduce ? FRAMES[0] : FRAMES[Math.floor(now / 80) % FRAMES.length];

  return (
    <div role="status" className="flex items-center gap-2.5 font-mono text-[12px]">
      <span className="w-3 text-phosphor" aria-hidden="true">
        {frame}
      </span>
      <span className="shimmer font-sans text-[13.5px] font-medium">{phase}</span>
      {startedAt && <span className="tabular-nums text-ink-muted">{seconds(now - startedAt)}</span>}
    </div>
  );
}
