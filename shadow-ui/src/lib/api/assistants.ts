import { enc, request, send } from "./client";

/* Assistants. Each one owns its own chats, memory and images, so switching
   is a real change of context, not a change of name. Three at most. */
export const listAssistants = () => request("/assistants", "Couldn't load your assistants");

export const createAssistant = (name: string, profile?: unknown) =>
  send("POST", "/assistants", { name, profile: profile ?? null }, "Couldn't create that assistant");

export const activateAssistant = (id: string) =>
  request(`/assistants/${enc(id)}/activate`, "Couldn't switch to that assistant", { method: "POST" });

/* Destroys that assistant's chats, memory and images. The dashboard confirms
   with the real counts before this is called. */
export const deleteAssistant = (id: string) =>
  request(`/assistants/${enc(id)}`, "Couldn't delete that assistant", { method: "DELETE" });

/* Edit any assistant, active or not. PUT /settings only writes to the
   active one, so renaming another assistant would otherwise mean switching
   to it first. */
export const patchAssistant = (id: string, patch: unknown) =>
  send("PATCH", `/assistants/${enc(id)}`, patch, "Couldn't save that assistant");
