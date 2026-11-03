/* The brain is reached through this dev server's own /api path, not directly
   on port 8765. Two reasons, both security: every request is then same-origin
   so the brain needs no CORS at all, and the access token is attached by the
   proxy (see vite.config.ts) so the browser never holds it. Image and preview
   URLs are built from this too, and are proxied the same way. */
export const API_BASE = "/api";

/** Responses the UI only passes through are left loosely typed on purpose. */
// oxlint-disable-next-line no-explicit-any
export type Json = any;

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const url = (path: string) => `${API_BASE}${path}`;
export const enc = encodeURIComponent;

async function readJson<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail || fallback, res.status);
  return data as T;
}

/** GET (or any method without a body) and parse the JSON reply. */
export async function request<T = Json>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  return readJson<T>(await fetch(url(path), init), fallback);
}

/** Send a JSON body and parse the JSON reply. */
export async function send<T = Json>(method: string, path: string, body: unknown, fallback: string): Promise<T> {
  return request<T>(path, fallback, jsonInit(method, body));
}

export function jsonInit(method: string, body: unknown, signal?: AbortSignal): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  };
}

/* One SSE reader for every streamed call: a new message, a regenerate, an
   edit and a model download all stream events back the same way. */
export async function readEvents<E>(res: Response, onEvent: (event: E) => void): Promise<void> {
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(data.detail || `Request failed (${res.status})`, res.status);
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
      if (line) onEvent(JSON.parse(line.slice(6)) as E);
    }
  }
}

export async function stream<E>(
  path: string,
  body: unknown,
  onEvent: (event: E) => void,
  signal?: AbortSignal,
): Promise<void> {
  return readEvents(await fetch(url(path), jsonInit("POST", body, signal)), onEvent);
}
