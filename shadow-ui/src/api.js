/* The brain is reached through this dev server's own /api path, not directly
   on port 8765. Two reasons, both security: every request is then same-origin
   so the brain needs no CORS at all, and the access token is attached by the
   proxy (see vite.config.js) so the browser never holds it. Image and preview
   URLs are built from this too, and are proxied the same way. */
export const API_BASE = "/api";
const BASE = API_BASE;

async function readJson(res, fallback) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || fallback);
  return data;
}

function jsonRequest(method, body) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export async function getStatus() {
  return readJson(await fetch(`${BASE}/status`), "Brain is not responding");
}

/* One SSE reader for every kind of turn: a new message, a regenerate and an
   edit all stream the same events back. */
async function readEvents(res, onEvent) {
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let split;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      const chunk = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (line) onEvent(JSON.parse(line.slice(6)));
    }
  }
}

export async function streamMessage(conversationId, message, options, onEvent, signal) {
  const res = await fetch(`${BASE}/chat/stream`, {
    ...jsonRequest("POST", {
      conversation_id: conversationId,
      message,
      model: options.model,
      effort: options.effort,
      images: options.images ?? [],
      skill: options.skill ?? null,
    }),
    signal,
  });
  return readEvents(res, onEvent);
}

/* Answer the same question again. The brain drops the old reply first, so
   there is never a second answer left behind in chats.db. */
export async function regenerateReply(conversationId, options, onEvent, signal) {
  const res = await fetch(`${BASE}/chat/regenerate`, {
    ...jsonRequest("POST", {
      conversation_id: conversationId,
      model: options.model,
      effort: options.effort,
    }),
    signal,
  });
  return readEvents(res, onEvent);
}

/* Change the last question and answer it again. */
export async function editMessage(conversationId, message, options, onEvent, signal) {
  const res = await fetch(`${BASE}/chat/edit`, {
    ...jsonRequest("POST", {
      conversation_id: conversationId,
      message,
      model: options.model,
      effort: options.effort,
    }),
    signal,
  });
  return readEvents(res, onEvent);
}

/* A thumb up or down on one reply, with an optional reason. Training signal,
   so the brain stores the whole turn alongside it. */
export async function rateReply({ conversationId, messageId, rating, reasonCode, reason }) {
  return readJson(
    await fetch(
      `${BASE}/feedback`,
      jsonRequest("POST", {
        conversation_id: conversationId,
        message_id: messageId,
        rating: rating ?? null,
        reason_code: reasonCode ?? null,
        reason: reason ?? "",
      })
    ),
    "Couldn't save that rating"
  );
}

export async function exportChat(id, format = "md") {
  return readJson(
    await fetch(`${BASE}/conversations/${id}/export?format=${format}`),
    "Couldn't export this chat"
  );
}

export async function searchChats(query) {
  return readJson(
    await fetch(`${BASE}/search?q=${encodeURIComponent(query)}`),
    "Couldn't search your chats"
  );
}

/* Link previews. The brain fetches the page and passes the image through,
   so no linked site ever sees the user's address. */
export async function getPreviews(urls) {
  return readJson(await fetch(`${BASE}/preview`, jsonRequest("POST", { urls })), "Couldn't load link previews");
}

export function previewImage(url) {
  return `${BASE}/preview/image?u=${encodeURIComponent(url)}`;
}

export async function openWorkspaceFile(path) {
  return readJson(await fetch(`${BASE}/open-file`, jsonRequest("POST", { path })), "Couldn't open that file");
}

/* The user's own models: one of their Ollama models (BYOM), or their own
   OpenAI-compatible endpoint (BYOK). The key is only ever sent *to* the
   brain, never read back - the brain returns a hint like "…1234". */
export async function getInstalledModels() {
  return readJson(await fetch(`${BASE}/models/installed`), "Couldn't list your Ollama models");
}

export async function getCustomModels() {
  return readJson(await fetch(`${BASE}/models/custom`), "Couldn't load your models");
}

export async function addCustomModel(body) {
  return readJson(await fetch(`${BASE}/models/custom`, jsonRequest("POST", body)), "Couldn't add that model");
}

export async function patchCustomModel(id, patch) {
  return readJson(
    await fetch(`${BASE}/models/custom/${encodeURIComponent(id)}`, jsonRequest("PATCH", patch)),
    "Couldn't update that model"
  );
}

export async function deleteCustomModel(id) {
  return readJson(
    await fetch(`${BASE}/models/custom/${encodeURIComponent(id)}`, { method: "DELETE" }),
    "Couldn't remove that model"
  );
}

export async function testCustomModel(id) {
  return readJson(
    await fetch(`${BASE}/models/custom/${encodeURIComponent(id)}/test`, { method: "POST" }),
    "Couldn't test that model"
  );
}

/* Skills. Only the UI reads these: the brain never puts the list in a
   prompt, so Shadow can't offer or invent a skill the user didn't invoke. */
export async function getSkills() {
  return readJson(await fetch(`${BASE}/skills`), "Couldn't load skills");
}

export async function getSkill(name) {
  return readJson(await fetch(`${BASE}/skills/${encodeURIComponent(name)}`), "Couldn't load that skill");
}

export async function addSkill(body) {
  const res = await fetch(`${BASE}/skills`, jsonRequest("POST", body));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 405: the running brain predates this endpoint.
    const detail =
      res.status === 405
        ? "The brain that's running is older than this screen and can't add skills yet. Restart it (stop uvicorn and start it again), then try again."
        : data.detail;
    const err = new Error(detail || "Couldn't add that skill");
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function deleteSkill(name) {
  return readJson(
    await fetch(`${BASE}/skills/${encodeURIComponent(name)}`, { method: "DELETE" }),
    "Couldn't remove that skill"
  );
}

export const SKILLS_CHANGED = "shadow:skills-changed";

export async function getSettings() {
  return readJson(await fetch(`${BASE}/settings`), "Couldn't load settings");
}

export async function updateSettings(patch) {
  return readJson(await fetch(`${BASE}/settings`, jsonRequest("PUT", patch)), "Couldn't save settings");
}

/* Voice mode: audio in, text out, all on this computer. */
export async function transcribe(wav) {
  const res = await fetch(`${BASE}/stt`, {
    method: "POST",
    headers: { "Content-Type": "audio/wav" },
    body: wav,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "Couldn't transcribe that audio");
  return data;
}

export async function getSttStatus() {
  return readJson(await fetch(`${BASE}/stt/status`), "Couldn't check the speech model");
}

export async function getPrivacy() {
  return readJson(await fetch(`${BASE}/privacy`), "Couldn't load the privacy report");
}

export async function clearChats() {
  return readJson(await fetch(`${BASE}/data/chats`, { method: "DELETE" }), "Couldn't delete the chats");
}

export async function clearLog() {
  return readJson(await fetch(`${BASE}/data/log`, { method: "DELETE" }), "Couldn't clear the log");
}

export async function listConversations() {
  return readJson(await fetch(`${BASE}/conversations`), "Couldn't load chats");
}

export async function getConversation(id) {
  return readJson(await fetch(`${BASE}/conversations/${encodeURIComponent(id)}`), "Couldn't load this chat");
}

export async function renameConversation(id, title) {
  return readJson(
    await fetch(`${BASE}/conversations/${encodeURIComponent(id)}`, jsonRequest("PATCH", { title })),
    "Couldn't rename this chat"
  );
}

export async function deleteConversation(id) {
  return readJson(
    await fetch(`${BASE}/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }),
    "Couldn't delete this chat"
  );
}

/* Stop asks the brain to end the turn before the connection is dropped, so
   the reply written so far is saved, marked stopped, before the chat is
   re-read. */
export async function stopChat(conversationId) {
  return readJson(
    await fetch(`${BASE}/chat/stop`, jsonRequest("POST", { conversation_id: conversationId })),
    "Couldn't stop the reply"
  );
}

/* Laya is slow for its first prediction after under a minute idle. Typing
   is the warning that a message is coming, so it gets warmed then. */
export async function warmRouter() {
  return readJson(await fetch(`${BASE}/router/warm`, { method: "POST" }), "Couldn't warm the router");
}

export async function answerPermission(id, decision) {
  return readJson(
    await fetch(`${BASE}/permission/${encodeURIComponent(id)}`, jsonRequest("POST", { decision })),
    "Couldn't send your answer"
  );
}

export async function listMemory() {
  return readJson(await fetch(`${BASE}/memory`), "Couldn't load memory");
}

export async function deleteMemory(id) {
  return readJson(await fetch(`${BASE}/memory/${encodeURIComponent(id)}`, { method: "DELETE" }), "Couldn't delete that memory");
}

export async function clearMemory() {
  return readJson(await fetch(`${BASE}/memory`, { method: "DELETE" }), "Couldn't clear memory");
}

export async function getGreetings() {
  return readJson(await fetch(`${BASE}/greetings`), "Couldn't load greetings");
}

/* Assistants. Each one owns its own chats, memory and images, so switching
   is a real change of context, not a change of name. Three at most. */
export async function listAssistants() {
  return readJson(await fetch(`${BASE}/assistants`), "Couldn't load your assistants");
}

export async function createAssistant(name, profile) {
  return readJson(
    await fetch(`${BASE}/assistants`, jsonRequest("POST", { name, profile: profile ?? null })),
    "Couldn't create that assistant"
  );
}

export async function activateAssistant(id) {
  return readJson(
    await fetch(`${BASE}/assistants/${encodeURIComponent(id)}/activate`, { method: "POST" }),
    "Couldn't switch to that assistant"
  );
}

/* Destroys that assistant's chats, memory and images. The dashboard confirms
   with the real counts before this is called. */
export async function deleteAssistant(id) {
  return readJson(
    await fetch(`${BASE}/assistants/${encodeURIComponent(id)}`, { method: "DELETE" }),
    "Couldn't delete that assistant"
  );
}

/* What setup still has to download for a tier: the chat model, and the
   embedder long-term memory runs on. */
export async function getNeededModels(tier) {
  return readJson(
    await fetch(`${BASE}/models/needed?tier=${encodeURIComponent(tier)}`),
    "Couldn't check which models you have"
  );
}

/* Downloads one model, reporting progress. Offline mode refuses this in the
   brain as well as hiding it here. */
export async function pullModel(model, onEvent, signal) {
  const res = await fetch(`${BASE}/models/pull`, {
    ...jsonRequest("POST", { model }),
    signal,
  });
  return readEvents(res, onEvent);
}

/* Edit any assistant, active or not. PUT /settings only writes to the
   active one, so renaming another assistant would otherwise mean switching
   to it first. */
export async function patchAssistant(id, patch) {
  return readJson(
    await fetch(`${BASE}/assistants/${encodeURIComponent(id)}`, jsonRequest("PATCH", patch)),
    "Couldn't save that assistant"
  );
}


/* Answers without a token, so "the brain isn't running" can be told apart
   from "the brain is running and rejected us". */
export async function getHealth() {
  const res = await fetch(`${BASE}/health`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Health check failed (${res.status})`);
  return data;
}
