import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  editMessage,
  rateReply,
  regenerateReply,
  stopChat,
  streamMessage,
  warmRouter,
  type RunOptions,
} from "@/lib/api";
import { applyEvent, placeholder, titleFrom, TurnError } from "@/features/chat/lib/conversation";
import type { Conversation, ImageAttachment, Message, Rating, Spend, StreamEvent } from "@/types";

type Request = (onEvent: (e: StreamEvent) => void, signal: AbortSignal) => Promise<void>;

interface Deps {
  active: Conversation;
  options: RunOptions;
  setActiveId: (id: string) => void;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  update: (id: string, change: (c: Conversation) => Conversation) => void;
  reload: (id: string) => Promise<void>;
  setSpend: (spend: Spend) => void;
}

const WARM_EVERY_MS = 10_000;

function lastUserOf(messages: Message[]) {
  return [...messages].reverse().find((m) => m.role === "user");
}

/* Sending, re-running, editing and stopping turns. Every kind of turn
   streams the same events, so they share one runner. */
export function useChatRunner({ active, options, setActiveId, setConversations, update, reload, setSpend }: Deps) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastWarm = useRef(0);

  async function run(convId: string, msgId: string, request: Request) {
    setActiveId(convId);
    setPendingId(convId);

    const patch = (change: (m: Message) => Message) =>
      update(convId, (c) => ({ ...c, messages: (c.messages ?? []).map((m) => (m.id === msgId ? change(m) : m)) }));

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await request((event) => {
        if (event.type === "usage") {
          // A BYOK turn is billed per call: surface it live, so a runaway
          // turn is noticeable while it runs rather than afterwards.
          setSpend({ turn: event.turn, today: event.today, host: event.host });
          return;
        }
        if (event.type === "error") throw new TurnError(event);
        patch((m) => applyEvent(m, event));
      }, controller.signal);
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        patch((m) => ({ ...m, streaming: false, stopped: true }));
      } else {
        patch((m) => ({
          ...m,
          role: "error",
          content: err.message,
          error: err instanceof TurnError ? err.shadow : null,
          streaming: false,
        }));
      }
    } finally {
      patch((m) => (m.streaming ? { ...m, streaming: false } : m));
      abortRef.current = null;
      setPendingId(null);
      // The brain assigns the real message ids, so re-read the chat once the
      // turn has landed: ratings and re-runs need the stored ids.
      reload(convId).catch(() => {
        // the on-screen version is still correct; ids catch up on reload
      });
    }
  }

  async function send(text: string, images: ImageAttachment[] = [], skill: string | null = null, voice = false) {
    if (active.messages === null) return;
    const convId = active.id;
    const reply = placeholder(skill);
    const user: Message = { id: crypto.randomUUID(), role: "user", content: text, images: images.map((i) => i.dataUrl) };

    // Add the messages and move this chat to the top of the list.
    setConversations((prev) => {
      const conv = prev.find((c) => c.id === convId);
      if (!conv || !conv.messages) return prev;
      const updated: Conversation = {
        ...conv,
        saved: true,
        updatedAt: new Date().toISOString(),
        title: conv.messages.length === 0 ? titleFrom(text) : conv.title,
        messages: [...conv.messages, user, reply],
      };
      return [updated, ...prev.filter((c) => c.id !== convId)];
    });

    await run(convId, reply.id, (onEvent, signal) =>
      streamMessage(convId, text, { ...options, images: images.map((i) => i.base64), skill, voice }, onEvent, signal),
    );
  }

  /* Ask the same question again. The old reply goes, on screen and in
     chats.db, and the current model/effort pickers are what runs. */
  async function regenerate() {
    if (pendingId !== null || !active.messages) return;
    const convId = active.id;
    const previous = active.messages;
    const lastUser = lastUserOf(previous);
    if (!lastUser) return;

    const cut = previous.slice(0, previous.indexOf(lastUser) + 1);
    const reply = placeholder(previous[previous.length - 1]?.skill ?? null);
    update(convId, (c) => ({ ...c, messages: [...cut, reply] }));
    await run(convId, reply.id, (onEvent, signal) => regenerateReply(convId, options, onEvent, signal));
  }

  /* Fix the last question and answer it again. */
  async function editLast(text: string) {
    if (pendingId !== null || !active.messages || !text.trim()) return;
    const convId = active.id;
    const previous = active.messages;
    const lastUser = lastUserOf(previous);
    if (!lastUser) return;

    const cut = previous.slice(0, previous.indexOf(lastUser));
    const reply = placeholder(previous[previous.length - 1]?.skill ?? null);
    update(convId, (c) => ({ ...c, messages: [...cut, { ...lastUser, content: text }, reply] }));
    await run(convId, reply.id, (onEvent, signal) => editMessage(convId, text, options, onEvent, signal));
  }

  async function stop() {
    const controller = abortRef.current;
    if (!controller) return;
    // The brain ends the turn and saves what it wrote; cutting the connection
    // first would race the re-read of the chat and lose it from the screen.
    try {
      await stopChat(pendingId);
    } catch (e) {
      console.warn("[stop] the brain didn't confirm, dropping the connection:", (e as Error).message);
    }
    controller.abort();
  }

  /* A rating is training signal, so it goes to the brain, which files it
     with the whole turn. Throws on failure: the actions row shows why. */
  async function rate(messageId: string, payload: { rating: Rating; reasonCode: string | null; reason: string }) {
    const convId = active.id;
    await rateReply({ conversationId: convId, messageId, ...payload });
    update(convId, (c) => ({
      ...c,
      messages: (c.messages ?? []).map((m) =>
        m.id === messageId
          ? { ...m, rating: payload.rating, rating_reason: payload.reason || null, rating_reason_code: payload.reasonCode || null }
          : m,
      ),
    }));
  }

  // Warm the router while someone types. The brain holds off on its own if
  // it predicted recently; this only saves sending a request per keystroke.
  function typing() {
    const now = Date.now();
    if (now - lastWarm.current < WARM_EVERY_MS) return;
    lastWarm.current = now;
    warmRouter().catch((e) => console.warn("[router] couldn't warm:", (e as Error).message));
  }

  function abortAll() {
    abortRef.current?.abort();
    setPendingId(null);
  }

  return { pendingId, send, regenerate, editLast, stop, rate, typing, abortAll };
}
