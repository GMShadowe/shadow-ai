# Shadow

A local-first AI assistant. Everything runs on your own computer, models
via [Ollama](https://ollama.com), storage in SQLite, no servers, no
accounts, no data leaving the machine.

Built by [shadow](https://github.com/GMShadowe). 

## What's here

- `shadow-brain/` — Python (FastAPI) backend. Router → adapters → tools →
  model, streamed over SSE.
- `shadow-ui/` — React + Vite + Tailwind frontend.

`shadow-web/` (a separate frontend) and `laya-fine-tune/` (training
scratch space for the router) are not part of this release yet.

## Running it

```bash
cd shadow-brain && source .venv/bin/activate && uvicorn server:app --host 127.0.0.1 --port 8765
cd shadow-ui && npm run dev
```

Both bind to localhost only.
