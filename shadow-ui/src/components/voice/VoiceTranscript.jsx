/* The exchange happening right now, under the stage. Always visible: not
   knowing whether it misheard you is the worst part of talking to a
   computer, and the text removes the doubt.

   The two voices are told apart the way the history panel does it — a
   small mono label, the user's words muted, Shadow's in full ink. */
function Line({ who, children, dim = false }) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[10px] uppercase tracking-wider text-ink-muted/80">{who}</div>
      <p className={dim ? "text-sm leading-relaxed text-ink-muted" : "text-[0.9375rem] font-medium leading-relaxed text-ink"}>
        {children}
      </p>
    </div>
  );
}

export default function VoiceTranscript({ user, assistant, state, listening }) {
  if (!user && !assistant) {
    return (
      <p className="text-center text-xs text-ink-muted">
        {listening ? "Listening…" : "Nothing said yet"}
      </p>
    );
  }

  return (
    <div className="space-y-3 text-center">
      {user && (
        <Line who="you" dim>
          {user}
          {listening && <span className="text-phosphor"> ▍</span>}
        </Line>
      )}
      {assistant && <Line who="shadow">{assistant}</Line>}
      {state === "thinking" && !assistant && <p className="shimmer text-sm font-medium">Working on it</p>}
    </div>
  );
}
