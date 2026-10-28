import { useState } from "react";

import PullProgress from "./onboarding/PullProgress.jsx";
import { DownloadIcon, RefreshIcon, SlidersIcon } from "./Icons.jsx";

/* The way out of a failure, offered rather than described.

   The brain says what kind of failure it was and what would help; this turns
   that into one button. The missing-model case is the one that earns its
   keep - Shadow can download the model right here instead of printing a
   command for someone to go and paste into a terminal. */

function Button({ icon: Icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-2.5 py-1 text-xs text-ink transition-all duration-150 hover:border-ink-muted active:scale-[0.97]"
    >
      <Icon width={13} height={13} />
      {children}
    </button>
  );
}

export default function ErrorAction({ failure, onRetry, onSettings }) {
  const [pulling, setPulling] = useState(false);
  const [pulled, setPulled] = useState(false);

  if (!failure?.action) return null;

  if (failure.action === "pull" && failure.model) {
    if (pulled) {
      return (
        <div className="mt-3 text-xs text-ink-muted">
          {failure.model} is downloaded. Send the message again.
        </div>
      );
    }
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
    return (
      <div className="mt-3">
        <Button icon={SlidersIcon} onClick={() => onSettings(failure.action)}>
          {failure.action === "privacy" ? "Open privacy settings" : "Open model settings"}
        </Button>
      </div>
    );
  }

  return null;
}
