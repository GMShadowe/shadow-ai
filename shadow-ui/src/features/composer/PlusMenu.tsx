import { useLayoutEffect, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import { PlusIcon, type IconProps } from "@/components/icons";
import Tooltip from "@/components/ui/Tooltip";
import { useDismiss } from "@/hooks/useDismiss";
import { useExit } from "@/hooks/useExit";

export interface PlusItem {
  id: string;
  label: string;
  /** One line under the label: what it does, or why it can't right now. */
  hint: string;
  icon: ComponentType<IconProps>;
  /** Tile colour classes: one of the brand tones. */
  tone: string;
  onPick?: () => void;
  disabled?: boolean;
  /** A small tag after the label, e.g. "soon". */
  tag?: string;
}

/* The + in the prompt bar: everything you can add to a message or start
   from it, in one menu. Each row has a brand-coloured tile; rows stagger in
   30ms apart. Things Shadow can't do yet are listed, greyed, with "soon",
   so the menu says honestly what is and isn't here. Arrow keys move, Enter
   picks, Escape closes. It opens upward unless there's no room above. */
export default function PlusMenu({ items, disabled }: { items: PlusItem[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const { mounted, leaving } = useExit(open);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [up, setUp] = useState(true);
  useDismiss(ref, open, () => setOpen(false));

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setUp(rect.top >= 360 || rect.top >= window.innerHeight - rect.bottom);
    // Focus the first item that can be picked, so the keyboard lands inside.
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus());
  }, [open]);

  function onKey(e: KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? [])];
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (at + 1) % list.length : (at - 1 + list.length) % list.length;
    list[next]?.focus();
  }

  return (
    <div ref={ref} className="relative">
      <Tooltip label="Add photos, search deeply, and more">
        {(describe) => (
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={disabled}
            aria-label="Add and more"
            aria-haspopup="menu"
            aria-expanded={open}
            {...describe}
            className={`grid h-8 w-8 place-items-center rounded-lg transition-[background-color,color,scale] duration-150 ease-smooth enabled:active:scale-[0.96] disabled:opacity-40 ${
              open ? "bg-signal text-bubble-ink" : "text-ink-muted enabled:hover:bg-ink/[0.07] enabled:hover:text-ink"
            }`}
          >
            {/* The plus turns into an × while the menu is open. */}
            <PlusIcon width={19} height={19} className={`transition-transform duration-200 ease-smooth ${open ? "rotate-45" : ""}`} />
          </button>
        )}
      </Tooltip>

      {mounted && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Add and more"
          onKeyDown={onKey}
          className={`${leaving ? "animate-pop-out pointer-events-none" : "animate-pop"} glass-menu absolute left-0 z-30 w-[17.5rem] rounded-2xl p-1.5 ${
            up ? "bottom-full mb-2 origin-bottom-left" : "top-full mt-2 origin-top-left"
          }`}
        >
          {items.map((item, i) => {
            const Icon = item.icon;
            const divider = i > 0 && !!item.tag && !items[i - 1].tag;
            return (
              <div key={item.id}>
                {divider && <div className="mx-2 my-1.5 h-px bg-line" />}
                <button
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onPick?.();
                  }}
                  style={{ animationDelay: `${i * 30}ms` }}
                  className="animate-rise group flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors duration-100 enabled:hover:bg-ink/[0.06] focus-visible:bg-ink/[0.06] focus-visible:outline-none disabled:cursor-not-allowed"
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-[10px] transition-[scale,rotate] duration-200 ease-smooth group-enabled:group-hover:-rotate-6 group-enabled:group-hover:scale-110 ${
                      item.disabled ? "bg-ink/[0.06] text-ink-faint" : item.tone
                    }`}
                  >
                    <Icon width={17} height={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`flex items-center gap-1.5 text-[13.5px] font-medium ${item.disabled ? "text-ink-faint" : "text-ink"}`}>
                      {item.label}
                      {item.tag && (
                        <span className="rounded-full border border-line px-1.5 font-mono text-[10px] font-normal text-ink-faint">{item.tag}</span>
                      )}
                    </span>
                    <span className="block truncate text-[12px] text-ink-faint">{item.hint}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

