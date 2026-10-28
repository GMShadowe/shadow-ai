import { useEffect } from "react";
import { CloseIcon } from "../Icons.jsx";

/* An attached image, opened large. Clicking one used to do nothing at all,
   which made it look broken rather than restrained. */
export default function Lightbox({ src, alt = "", onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image"
      className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <img
        src={src}
        alt={alt}
        className="animate-pop max-h-full max-w-full rounded-lg object-contain"
      />
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image"
        className="absolute right-4 top-4 rounded-md border border-line bg-panel/80 p-1.5 text-ink-muted transition-colors duration-150 hover:bg-panel-alt hover:text-ink active:scale-95"
      >
        <CloseIcon width={16} height={16} />
      </button>
    </div>
  );
}
