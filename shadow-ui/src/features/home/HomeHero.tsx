interface HomeHeroProps {
  /** One greeting, picked per new chat. */
  greeting: string;
  connected: boolean;
  /** The model answering, for the status line over the greeting. */
  modelLabel?: string;
  /** Whether that model sends the conversation off this computer. */
  sending?: boolean;
}

/* The empty chat's headline: a small mono status line saying who is
   answering and where, then the greeting in Geist Serif. When the brain is
   down it says so here instead, because nothing typed would work. */
export default function HomeHero({ greeting, connected, modelLabel, sending = false }: HomeHeroProps) {
  const where = !connected ? "brain offline" : sending ? "sends to a remote endpoint" : "running on this computer";
  const dot = !connected ? "animate-pulse bg-danger" : sending ? "bg-danger" : "bg-ok";
  return (
    <div className="stage flex w-full max-w-3xl flex-col items-center">
      <p className="mb-4 flex items-center gap-2 rounded-full border border-line bg-bg/80 px-3 py-1 font-mono text-[11.5px] text-ink-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
        {[connected ? modelLabel : null, where].filter(Boolean).join(" · ")}
      </p>
      <h1 className="text-center font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.02em] text-balance text-ink">
        {connected ? greeting : "Shadow's brain isn't running"}
      </h1>
      {!connected && (
        <p className="mt-3 text-center text-[14px] text-ink-muted">
          Start it with <code className="rounded-md bg-ink/[0.08] px-1.5 py-0.5 font-mono text-[13px]">uvicorn server:app --port 8765</code>
        </p>
      )}
    </div>
  );
}
