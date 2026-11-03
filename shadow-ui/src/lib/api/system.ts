import type { Status } from "@/types";
import { ApiError, enc, request, send, url } from "./client";

export const getStatus = () => request<Status>("/status", "Brain is not responding");

/* Answers without a token, so "the brain isn't running" can be told apart
   from "the brain is running and rejected us". */
export async function getHealth() {
  const res = await fetch(url("/health"));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail || `Health check failed (${res.status})`, res.status);
  return data;
}

export const getSettings = () => request("/settings", "Couldn't load settings");
export const updateSettings = (patch: Record<string, unknown>) =>
  send("PUT", "/settings", patch, "Couldn't save settings");

export const getPrivacy = () => request("/privacy", "Couldn't load the privacy report");
export const clearChats = () => request("/data/chats", "Couldn't delete the chats", { method: "DELETE" });
export const clearLog = () => request("/data/log", "Couldn't clear the log", { method: "DELETE" });

export const listMemory = () => request("/memory", "Couldn't load memory");
export const deleteMemory = (id: string) =>
  request(`/memory/${enc(id)}`, "Couldn't delete that memory", { method: "DELETE" });
export const clearMemory = () => request("/memory", "Couldn't clear memory", { method: "DELETE" });

export const getGreetings = () => request<{ greetings?: string[] }>("/greetings", "Couldn't load greetings");

/* Link previews. The brain fetches the page and passes the image through,
   so no linked site ever sees the user's address. */
export const getPreviews = (urls: string[]) => send("POST", "/preview", { urls }, "Couldn't load link previews");
export const previewImage = (target: string) => url(`/preview/image?u=${enc(target)}`);

export const openWorkspaceFile = (path: string) => send("POST", "/open-file", { path }, "Couldn't open that file");

/* Voice mode: audio in, text out, all on this computer. */
export async function transcribe(wav: BodyInit) {
  const res = await fetch(url("/stt"), { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail || "Couldn't transcribe that audio", res.status);
  return data;
}

export const getSttStatus = () => request("/stt/status", "Couldn't check the speech model");
