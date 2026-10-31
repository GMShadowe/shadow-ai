import { useEffect, useRef } from "react";
import Message from "./Message.jsx";

function EmptyState({ greeting }) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-end px-6 pb-6">
      <div className="animate-rise relative flex w-full max-w-3xl flex-col items-center">
        <h1 className="text-center text-[clamp(1.75rem,3.4vw,2.6rem)] font-medium leading-[1.1] tracking-[-0.035em] text-ink">{greeting}</h1>
      </div>
    </div>
  );
}

/* Vertical rhythm follows the conversation rather than being one gap
   repeated: a reply belongs to the question above it, so it sits closer to
   it than the next question does. */
function gapFor(previous, message) {
  if (!previous) return "";
  return message.role === "user" ? "mt-9" : "mt-5";
}

export default function MessageList({
  messages,
  greeting,
  onPermission,
  reasons,
  busy,
  onRegenerate,
  onEdit,
  onRate,
  onOpenSettings,
}) {
  const scrollRef = useRef(null);
  const stickToBottom = useRef(true);

  useEffect(() => { stickToBottom.current = true; }, [messages?.length]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleScroll() {
    const el = scrollRef.current;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  if (messages === null) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {/* A chat that opens quickly shouldn't flash a loading word. */}
        <span className="shimmer wait-to-show text-sm font-medium">Loading chat</span>
      </div>
    );
  }

  if (messages.length === 0) return <EmptyState greeting={greeting} />;

  // Only the last exchange can be re-run: anything earlier would throw away
  // the conversation that followed it.
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && !m.streaming);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const tail = messages[messages.length - 1];
  const settled = !busy && (tail?.role !== "assistant" || !tail.streaming);

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,#000_28px)]">
      <div className="mx-auto max-w-3xl px-6 pb-6 pt-8">
        {messages.map((m, i) => (
          <div key={m.id ?? i} className={gapFor(messages[i - 1], m)}>
            <Message
              message={m}
              onPermission={onPermission}
              reasons={reasons}
              busy={busy}
              canRegenerate={settled && m.id === lastAssistant?.id && m.id === tail?.id}
              canEdit={settled && m.id === lastUser?.id}
              onRegenerate={onRegenerate}
              onEdit={onEdit}
              onRate={onRate ? (payload) => onRate(m.id, payload) : undefined}
              onOpenSettings={onOpenSettings}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
