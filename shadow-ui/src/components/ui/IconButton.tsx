import type { ButtonHTMLAttributes, ReactNode } from "react";
import Tooltip from "./Tooltip";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only button has no other accessible name. Also its tooltip. */
  label: string;
  /** A shortcut shown in the tooltip. */
  keys?: string;
  tooltipSide?: "top" | "bottom" | "right";
  active?: boolean;
  size?: "sm" | "md";
  children: ReactNode;
}

/* The square, quiet button used across the rail and the prompt bar. Its
   label names it for screen readers and shows as a tooltip. Press scales to
   0.96; disabled never does. */
export default function IconButton({
  label,
  keys,
  tooltipSide = "top",
  active = false,
  size = "md",
  className = "",
  children,
  ...rest
}: IconButtonProps) {
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : "h-9 w-9 rounded-[10px]";
  return (
    <Tooltip label={label} keys={keys} side={tooltipSide}>
      {(describe) => (
        <button
          type="button"
          aria-label={label}
          {...describe}
          className={`grid shrink-0 place-items-center transition-[background-color,color,scale] duration-150 ease-smooth enabled:active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 ${box} ${
            active ? "bg-ink/[0.08] text-ink" : "text-ink-muted enabled:hover:bg-ink/[0.06] enabled:hover:text-ink"
          } ${className}`}
          {...rest}
        >
          {children}
        </button>
      )}
    </Tooltip>
  );
}
