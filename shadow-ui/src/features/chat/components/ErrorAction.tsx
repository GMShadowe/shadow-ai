import { useState, type ComponentType, type ReactNode } from "react";
import { DownloadIcon, RefreshIcon, SlidersIcon, type IconProps } from "@/components/icons";
import PullProgress from "@/features/onboarding/PullProgress";
import type { Failure } from "@/types";

/* The way out of a failure, offered rather than described. The missing-model
   case earns its keep: Shadow downloads the model right here instead of
   printing a command to paste into a terminal. */

function Button({ icon: Icon, children, onClick }: { icon: ComponentType<IconProps>; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-xs text-ink transition-[border-color,scale] duration-150 hover:border-ink-muted active:scale-[0.96]"
    >
      <Icon width={13} height={13} />
      {children}
    </button>
  );
}

interface ErrorActionProps {
  failure: Failure;
  onRetry: (() => void) | null;
  onSettings?: (section?: string) => void;
}

export default function ErrorAction({ failure, onRetry, onSettings }: ErrorActionProps) {
  const [pulling, setPulling] = useState(false);
  const [pulled, setPulled] = useState(false);

  if (!failure?.action) return null;

  if (failure.action === "pull" && failure.model) {
    if (pulled) return <div className="mt-3 text-xs text-ink-muted">{failure.model} is downloaded. Send the message again.</div>;
    if (pulling) {
      return (
        <div className="mt-3">
          <PullProgress
            models={[failure.model]}
            onDone={() => {
              setPulling(false);
              setPulled(true);
            }}
            onError={() => setPulling(false)}
          />
        </div>
      );
    }
    return (
      <div className="mt-3">
        <Button icon={DownloadIcon} onClick={() => setPulling(true)}>
          Download {failure.model}
        </Button>
      </div>
    );
  }

  if (failure.action === "retry" && onRetry) {
    return (
      <div className="mt-3">
        <Button icon={RefreshIcon} onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if ((failure.action === "models" || failure.action === "privacy") && onSettings) {
    const section = failure.action;
    return (
      <div className="mt-3">
        <Button icon={SlidersIcon} onClick={() => onSettings(section)}>
          {section === "privacy" ? "Open privacy settings" : "Open model settings"}
        </Button>
      </div>
    );
  }

  return null;
}
