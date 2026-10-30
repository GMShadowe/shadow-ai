# Shadow roadmap

Status as of 31 October 2026. Ordered roughly by priority.
Don't reorder without asking Ayaan.

## Done

- Brain: router → adapters → tools → model, streaming over SSE
- Laya router with confidence thresholds, blending, explicit overrides
- 17 tools with danger levels and per-tool on/ask/off state
- Permission flow for "ask" tools (approve in chat, with Always allow)
- Three model tiers + five effort levels (3/6/12/20/32 tool steps)
- Vision (images via the base models, no separate vision model needed)
- Saved chats in SQLite, per assistant
- Long-term memory: embeddings, retrieval, explicit + auto save, full UI
- Per-assistant folder structure (profile, chats, memory, images)
- Awareness block in every prompt + `about_me` tool
- Settings popup: general, personality, memory, tools, appearance,
  models & brain, data & privacy, about
- UI: streaming, tool rows, markdown with tables and highlighted code,
  themes, collapsible sidebar, generated greetings
- Context compressor (`context.py`): runs before every request including
  each tool step, trims old tool results, then tool arguments, then whole
  messages, and tells the model what was dropped
- Voice mode v1: a separate screen, AudioWorklet recording, browser-side
  endpointing, whisper + silero-vad in `stt.py`. No TTS yet
- Skills: folder-based markdown, invoked only by a slash command, never
  listed to the model
- Ratings (`feedback.py`), re-runs, markdown/JSON export, chat search
- Five inferred rich elements in replies, with link previews fetched by the
  brain rather than the browser
- Your own models: BYOM (anything in your Ollama) and BYOK (an
  OpenAI-compatible endpoint, which is loud about leaving the computer)
- Onboarding and the assistant dashboard: first-run setup with a hardware
  scan and an in-app model download, up to three assistants each with their
  own chats and memory, created from Quick start or Customize
- Primal tier filled in: `gemma4:12b`
- Location field in Settings
- Access token on every brain endpoint, with the browser never holding it,
  and no CORS at all now that the UI is same-origin through the dev server
- BYOK token counting, per-endpoint totals and per-turn/per-day caps that stop
- Plain-words error recovery for the failures people hit, with the missing
  model offering to download itself
- Security and correctness pass over the open issues (Tier 1): Host check
  against DNS rebinding, SSRF-safe fetching for web tools and previews
  (`netguard.py`), approvals that show what Allow does, web turns gated to
  Ask, shell sandbox and minimal environment, file backups, Laya pinned and
  hash-checked, assistant pinned per turn, one turn per chat at a time
- Regression tests in `shadow-brain/tests/`, one file per fixed issue
- Light theme as the default (near-white, one blue, Plus Jakarta Sans), with
  the app restyled to match; the dark themes remain choices
- Adding skills from a file, a link, or a pasted `npx skills add` command

**A tool tree was built, measured and removed.** Branches instead of one
flat list measured worse on the 2B it was for, and gave small models two new
ways to fail. The numbers are in CLAUDE.md; don't rebuild it without a
reason they don't already cover.

## Next

### 1. Voice mode v2: speak out loud
STT works; nothing is spoken yet, so "speaking" in the UI only means reply
text is arriving. This is the piece that makes voice mode voice mode.

- TTS: `piper`, local
- Latency trick: start TTS on the first finished sentence while the model is
  still generating
- Voice replies must be short and spoken-style (a `voice` flag on the turn),
  forced low effort
- Ayaan's idea: when a tool or search is needed, say "hang on, let me look
  that up" out loud to cover the pause
- The voice screen's cards (`voice/cards/`) still run on `placeholders.js`.
  Its header says it is the contract: list from `web_search` or `list_dir`,
  chart from a numeric answer, image from anything visual. Wire them to real
  tool results and delete the file and the dev bar.
  **A chart here is the sixth rich element** - CLAUDE.md rules one out for
  replies, and allows it only if the data arrives as data. These do. Decide
  that deliberately rather than by drift.

Reality check: whisper + piper + the chat model + Laya + the embedder on a
16GB Mac is tight. Expect to recommend Default for voice.

### 2. Real QLoRA adapter weights
The biggest quality lever. Current adapters are prompts only.

- Fine-tune per base model (a LoRA is tied to its base, so each tier needs
  its own set). **Default and Plus only** - Primal carries
  `"adapters": false`, since a 12B is expected to be capable without them
- Start with **coding** (tool discipline, complete code, verify by running)
  and **research** (write good queries, don't bias them)
- Mix ~10-15% general instruction data into each adapter's training set to
  avoid catastrophic forgetting of the assistant's voice
- Keep adapters separate (not merged) so the router can hot-swap them
- Use QLoRA; a 3060 12GB can train these

### 3. Laya fine-tune
Confidence is 25-50% on clear questions. The thresholds in `classifier.py`
are a stopgap.

- `turns.jsonl` has real examples but is small (~100) and skewed toward
  repeated test prompts. **Building the dataset is the first task here**, not
  the training: several hundred, spread evenly across
  chat/coding/files/system/research
- `feedback.json` now holds rated turns in the same shape, so it feeds this too
- Laya ships a fine-tuning notebook that runs on free Kaggle T4s
- Keep adapter/tool count under ~20 — accuracy falls off sharply past that

### 4. Context: use what Primal has
`NUM_CTX` is 16K for every model. `gemma4:12b` has 256K, so Primal is being
run at a sixteenth of its window. Make the context per-model rather than
global, and decide what the compressor does with the extra room.

## Later

- Tool *index* (vector search over tool descriptions) once past ~20 tools.
  Not the tree - that was measured and removed
- Connectors / MCP
- Desktop app (Electron or Tauri): one window, starts the brain itself,
  one-click installer that detects hardware and pulls the right model
- Per-tier tool sets (Default may need fewer tools than Plus)
- A browser-screenshot tool so Shadow can see the web pages it builds
  (it can't currently verify its own HTML the way it verifies Python)
- Save partial replies when the user hits Stop
- Summarise what the compressor dropped instead of just noting that it did
- Writing and editing skills in the app; adding one from a file or a link
  works, but there's no editor
- Regenerate or edit further back than the last exchange
- FTS for chat search, when these databases are big enough to need it

## Launch plan (when there's something to show)

Build in public → one week with r/LocalLLaMA + Hacker News + Product Hunt
→ a demo video as the centerpiece: an old laptop, one-click install,
something genuinely useful, offline.

The honest pitch: **the ChatGPT-style experience, local and free, good
enough for most real tasks, better with your hardware.** Don't claim
it matches frontier models on hard reasoning — it doesn't, and someone
will say so on launch day.
