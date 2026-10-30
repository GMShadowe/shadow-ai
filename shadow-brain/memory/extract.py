"""Extracts durable facts worth remembering from a turn.
Used for "remember ..." and, when it is on, auto-memory. Kept deliberately strict."""

import json

import ollama

import providers
import usage
from config import load_tier_config

PROMPT = """You decide what is worth remembering long-term about the user, from one message.

Remember ONLY durable facts about the user: their name, what they do, their
preferences, their projects, their tools, ongoing goals.

Do NOT remember: one-off requests, questions, small talk, anything about you
(the assistant), or temporary things ("open this file").

User message: "{text}"

Reply with a JSON array of short fact strings, written in third person
("Uses Python", "Building an app called Shadow"). If nothing is worth
remembering, reply with an empty array [].
Reply with ONLY the JSON array, nothing else."""


def _ask(cfg: dict, prompt: str) -> str:
    messages = [{"role": "user", "content": prompt}]
    if cfg.get("kind") == "byok":
        from model import _record

        usage.check(cfg, 0)
        text = ""
        for chunk in providers.openai_stream(cfg, messages, None, 0):
            text += chunk.message.content or ""
            if chunk.usage is not None:
                _record(cfg, chunk.usage)
        return text
    resp = ollama.chat(model=cfg["base_model"], messages=messages,
                       think=False, options={"temperature": 0})
    return resp.message.content or ""


def extract_facts(user_text: str, tier: str | None = None) -> list[str]:
    try:
        cfg = load_tier_config(tier)
        content = _ask(cfg, PROMPT.format(text=user_text[:800])).strip()
    except Exception as e:
        print(f"[memory] fact extraction failed: {type(e).__name__}: {e}")
        return []
    start, end = content.find("["), content.rfind("]")
    if start == -1 or end == -1:
        print(f"[memory] fact extraction got no JSON array back: {content[:120]!r}")
        return []
    try:
        facts = json.loads(content[start:end + 1])
    except ValueError as e:
        print(f"[memory] fact extraction got unreadable JSON ({e}): {content[:120]!r}")
        return []
    if not isinstance(facts, list):
        return []
    return [f.strip() for f in facts if isinstance(f, str) and f.strip()][:5]
