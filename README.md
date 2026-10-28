# Shadow

A local-first AI assistant. Everything runs on your own computer — models
via [Ollama](https://ollama.com), storage in SQLite, no servers, no
accounts, no data leaving the machine.

Built by Ayaan.

## What's here

- `shadow-brain/` — Python (FastAPI) backend. Router → adapters → tools →
  model, streamed over SSE.
- `shadow-ui/` — React + Vite + Tailwind frontend.

`shadow-web/` (a separate frontend) and `laya-fine-tune/` (training
scratch space for the router) are not part of this release yet.

## Nothing personal is in this repo

`shadow-brain/data/` — chats, long-term memory, images, the auth token, any
BYOK API keys, the training log — is git-ignored and was never committed.
What you're looking at is the code that runs the assistant, not anyone's
conversations with it. See `CLAUDE.md` for exactly what's local-only and
what (if anything) ever leaves the machine.

## Running it

```bash
cd shadow-brain && source .venv/bin/activate && uvicorn server:app --host 127.0.0.1 --port 8765
cd shadow-ui && npm run dev
```

Both bind to localhost only.

## Learn more

- `CLAUDE.md` — architecture, design decisions, and the rules that aren't
  negotiable (honesty, privacy, safety).
- `ROADMAP.md` — what's done and what's next.
