/* The exchange happening right now. Always visible: not knowing whether it
   misheard you is the worst part of talking to a computer, and the text
   removes the doubt.

   Large when it has the middle of the screen to itself, small when a card
   is there. The user's words are muted, Shadow's in full ink. */
const SIZES = {
  large: {
    gap: "space-y-5",
    user: "text-[15px] leading-relaxed text-ink-muted",
    shadow: "text-[clamp(1.25rem,2.2vw,1.6rem)] font-medium leading-snug tracking-[-0.02em] text-ink",
  },
  small: {
    gap: "space-y-1.5",
    user: "line-clamp-1 text-[13px] text-ink-muted",
    shadow: "line-clamp-3 text-[15px] font-medium leading-relaxed text-ink",
  },
};

export default function VoiceTranscript({ size = "large", user, assistant, state }) {
  const s = SIZES[size];

  if (!user && !assistant) {
    return (
      <p className="text-center text-[13px] text-ink-muted">
        {state === "listening" ? "Go ahead, I'm listening." : state === "transcribing" ? "Writing down what you said…" : ""}
      </p>
    );
  }

  return (
    <div className={`w-full text-center ${s.gap}`}>
      {user && <p className={`animate-fade ${s.user}`}>“{user}”</p>}
      {assistant ? (
        <p className={`animate-fade ${s.shadow}`}>
          {assistant}
          {state === "speaking" && <span className="ml-0.5 text-phosphor">▍</span>}
        </p>
      ) : (
        state === "thinking" && <p className="shimmer text-[14px] font-medium">Working on it</p>
      )}
    </div>
  );
}
