import type { ExportFormat, Message, SearchHit } from "@/types";
import { enc, request, send } from "./client";

export type ServerMessage = Omit<Message, "images"> & { images?: string[] };

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

export const listConversations = () => request<ConversationSummary[]>("/conversations", "Couldn't load chats");

export const getConversation = (id: string) =>
  request<{ messages: ServerMessage[] }>(`/conversations/${enc(id)}`, "Couldn't load this chat");

export const renameConversation = (id: string, title: string) =>
  send("PATCH", `/conversations/${enc(id)}`, { title }, "Couldn't rename this chat");

export const deleteConversation = (id: string) =>
  request(`/conversations/${enc(id)}`, "Couldn't delete this chat", { method: "DELETE" });

export const exportChat = (id: string, format: ExportFormat = "md") =>
  request<{ filename: string; content: string }>(
    `/conversations/${enc(id)}/export?format=${format}`,
    "Couldn't export this chat",
  );

export const searchChats = (query: string) =>
  request<{ results: SearchHit[] }>(`/search?q=${enc(query)}`, "Couldn't search your chats");
