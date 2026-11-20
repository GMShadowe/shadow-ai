import { useEffect, useRef } from "react";
import { CloseIcon } from "@/components/icons";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface LightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

/* An attached image, opened large. Escape or a click outside closes it. */
export default function Lightbox({ src, alt = "", onClose }: LightboxProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label="Image"
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <img src={src} alt={alt} className="content-img animate-pop max-h-full max-w-full rounded-lg object-contain" />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image"
        data-autofocus
        className="glass absolute right-4 top-4 rounded-lg p-2 text-ink-muted transition-[color,scale] duration-150 ease-smooth hover:text-ink active:scale-[0.96]"
      >
        <CloseIcon width={16} height={16} />
      </button>
    </div>
  );
}
