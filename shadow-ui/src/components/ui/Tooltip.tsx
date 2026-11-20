import { useEffect, useId, useRef, useState, type ReactElement } from "react";

/* A small label that names a control, with its shortcut.

   The first tooltip waits 400ms so passing the pointer over a toolbar doesn't
   flash labels. Once one has shown, its neighbours open instantly and without
   animation for the next 600ms, so moving along the rail reads the labels
   off one after another. Keyboard focus shows it at once. */

let lastClosed = 0;
const DELAY_MS = 400;
const WARM_MS = 600;

type Side = "right" | "top" | "bottom";

const PLACE: Record<Side, string> = {
  right: "left-full top-1/2 ml-2.5 -translate-y-1/2 origin-left",
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2 origin-bottom",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2 origin-top",
};

interface TooltipProps {
  label: string;
  /** A key combination, shown in mono after the label. */
  keys?: string;
  side?: Side;
  children: (props: { "aria-describedby"?: string }) => ReactElement;
}

export default function Tooltip({ label, keys, side = "top", children }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [instant, setInstant] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function show(now: boolean) {
    if (timer.current) clearTimeout(timer.current);
    const warm = Date.now() - lastClosed < WARM_MS;
    if (now || warm) {
      setInstant(warm);
      setOpen(true);
      return;
    }
    setInstant(false);
    timer.current = setTimeout(() => setOpen(true), DELAY_MS);
  }

  function hide() {
    if (timer.current) clearTimeout(timer.current);
    if (open) lastClosed = Date.now();
    setOpen(false);
  }

  return (
    <span
      className="relative inline-flex"
      onPointerEnter={(e) => e.pointerType === "mouse" && show(false)}
      onPointerLeave={hide}
      onFocus={(e) => e.target.matches(":focus-visible") && show(true)}
      onBlur={hide}
      onPointerDown={hide}
    >
      {children({ "aria-describedby": open ? id : undefined })}
      <span
        id={id}
        role="tooltip"
        data-open={open}
        data-instant={instant}
        className={`tooltip pointer-events-none absolute z-50 flex items-center gap-2 whitespace-nowrap rounded-lg border border-line bg-panel-alt px-2 py-1 text-[12px] text-ink shadow-[0_8px_24px_-8px_var(--shadow-color)] ${PLACE[side]}`}
      >
        {label}
        {keys && <span className="font-mono text-[10.5px] text-ink-muted">{keys}</span>}
      </span>
    </span>
  );
}
