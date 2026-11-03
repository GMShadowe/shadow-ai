import type { ProgressEvent } from "@/types";
import { enc, request, send, stream } from "./client";

/* The user's own models: one of their Ollama models (BYOM), or their own
   OpenAI-compatible endpoint (BYOK). The key is only ever sent *to* the
   brain, never read back - the brain returns a hint like "…1234". */
export const getInstalledModels = () => request("/models/installed", "Couldn't list your Ollama models");
export const getCustomModels = () => request("/models/custom", "Couldn't load your models");
export const addCustomModel = (body: unknown) => send("POST", "/models/custom", body, "Couldn't add that model");
export const patchCustomModel = (id: string, patch: unknown) =>
  send("PATCH", `/models/custom/${enc(id)}`, patch, "Couldn't update that model");
export const deleteCustomModel = (id: string) =>
  request(`/models/custom/${enc(id)}`, "Couldn't remove that model", { method: "DELETE" });
export const testCustomModel = (id: string) =>
  request(`/models/custom/${enc(id)}/test`, "Couldn't test that model", { method: "POST" });

/* What setup still has to download for a tier: the chat model, and the
   embedder long-term memory runs on. */
export const getNeededModels = (tier: string) =>
  request(`/models/needed?tier=${enc(tier)}`, "Couldn't check which models you have");

/* Downloads one model, reporting progress. Offline mode refuses this in the
   brain as well as hiding it here. */
export const pullModel = (model: string, onEvent: (e: ProgressEvent) => void, signal?: AbortSignal) =>
  stream<ProgressEvent>("/models/pull", { model }, onEvent, signal);
