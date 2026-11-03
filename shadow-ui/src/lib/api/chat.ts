import type { Rating, StreamEvent } from "@/types";
import { enc, send, stream } from "./client";

export interface RunOptions {
  model: string | null;
  effort: string;
}

export interface SendOptions extends RunOptions {
  images?: string[];
  skill?: string | null;
  voice?: boolean;
}

type OnEvent = (event: StreamEvent) => void;

export function streamMessage(
  conversationId: string,
  message: string,
  options: SendOptions,
  onEvent: OnEvent,
  signal?: AbortSignal,
) {
  return stream<StreamEvent>(
    "/chat/stream",
    {
      conversation_id: conversationId,
      message,
      model: options.model,
      effort: options.effort,
      images: options.images ?? [],
      skill: options.skill ?? null,
      voice: options.voice ?? false,
    },
    onEvent,
    signal,
  );
}

/* Answer the same question again. The brain drops the old reply first, so
   there is never a second answer left behind in chats.db. */
export function regenerateReply(conversationId: string, options: RunOptions, onEvent: OnEvent, signal?: AbortSignal) {
  return stream<StreamEvent>(
    "/chat/regenerate",
    { conversation_id: conversationId, model: options.model, effort: options.effort },
    onEvent,
    signal,
  );
}

/* Change the last question and answer it again. */
export function editMessage(
  conversationId: string,
  message: string,
  options: RunOptions,
  onEvent: OnEvent,
  signal?: AbortSignal,
) {
  return stream<StreamEvent>(
    "/chat/edit",
    { conversation_id: conversationId, message, model: options.model, effort: options.effort },
    onEvent,
    signal,
  );
}

/* Stop asks the brain to end the turn before the connection is dropped, so
   the reply written so far is saved, marked stopped, before the chat is
   re-read. */
export const stopChat = (conversationId: string | null) =>
  send("POST", "/chat/stop", { conversation_id: conversationId }, "Couldn't stop the reply");

/* Laya is slow for its first prediction after under a minute idle. Typing
   is the warning that a message is coming, so it gets warmed then. */
export const warmRouter = () => send("POST", "/router/warm", undefined, "Couldn't warm the router");

export const answerPermission = (id: string, decision: string) =>
  send("POST", `/permission/${enc(id)}`, { decision }, "Couldn't send your answer");

export interface RatePayload {
  conversationId: string;
  messageId: string;
  rating: Rating;
  reasonCode?: string | null;
  reason?: string;
}

/* A thumb up or down on one reply, with an optional reason. Training signal,
   so the brain stores the whole turn alongside it. */
export const rateReply = ({ conversationId, messageId, rating, reasonCode, reason }: RatePayload) =>
  send(
    "POST",
    "/feedback",
    {
      conversation_id: conversationId,
      message_id: messageId,
      rating: rating ?? null,
      reason_code: reasonCode ?? null,
      reason: reason ?? "",
    },
    "Couldn't save that rating",
  );
