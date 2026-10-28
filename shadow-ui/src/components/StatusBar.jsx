import { OutboundIcon } from "./Icons.jsx";

/* Two things here have to be impossible to miss while a conversation is
   running, because the dangerous moment is twenty minutes in, not the moment
   something was chosen:

   - that a model of the user's own is sending the conversation to someone
     else's computer, and
   - what that is costing them. A turn can be up to 32 calls at Ultra effort,
     each carrying the whole conversation, so a runaway turn is something to
     notice while it runs rather than on a bill later.

   Tokens, never money: rates differ per provider and model, and a wrong
   price is worse than none. */

function tokens(n) {
  if (n === null || n === undefined) return null;
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export default function StatusBar({ title, connected, authFailed, model, spend }) {
  const sending = model?.sends_data;
  const turn = tokens(spend?.turn);
  const today = tokens(spend?.today);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line/70 px-6">
      <h1 className="min-w-0 truncate text-sm font-medium text-ink">{title}</h1>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {sending && today !== null && (
          <span
            title={
              `Tokens this endpoint has reported today: ${spend.today.toLocaleString()}.` +
              (spend.turn ? ` This turn: ${spend.turn.toLocaleString()}.` : "") +
              " Counted from what the provider reports. Shadow never guesses at a price," +
              " because rates differ per provider and model. Caps are in Settings - Models & brain."
            }
            className="animate-fade rounded-full border border-line px-2.5 py-0.5 font-mono text-[11px] text-ink-muted"
          >
            {turn ? `${turn} this turn · ` : ""}
            {today} today
          </span>
        )}
        {sending && (
          <span
            title={`This conversation is being sent to ${model.host || "your endpoint"} as ${model.model}. Messages, files Shadow reads, tool results and images all leave this computer, and the provider bills you for them.`}
            className="animate-fade flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/5 px-2.5 py-0.5 text-[11px] text-danger"
          >
            <OutboundIcon width={12} height={12} />
            Leaving this computer · {model.host || model.label}
          </span>
        )}
        {!connected && (
          <span
            title={
              authFailed
                ? "The brain is running but rejected this request. Restart the UI dev server so it reads the current access token."
                : "Nothing is answering on 127.0.0.1:8765. Start the brain with: uvicorn server:app --host 127.0.0.1 --port 8765"
            }
            className="animate-fade rounded-full border border-danger/40 bg-danger/5 px-2.5 py-0.5 text-[11px] text-danger"
          >
            {authFailed ? "Brain refused us" : "Brain offline"}
          </span>
        )}
      </div>
    </header>
  );
}
