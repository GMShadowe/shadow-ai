"""Extracts durable facts worth remembering from a turn.
Used only when auto-memory is on. Kept deliberately strict."""

import json

import ollama

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


def extract_facts(user_text: str) -> list[str]:
    model = load_tier_config()["base_model"]
    try:
        resp = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": PROMPT.format(text=user_text[:800])}],
            think=False,
            options={"temperature": 0},
        )
        content = resp.message.content.strip()
        start, end = content.find("["), content.rfind("]")
        if start == -1 or end == -1:
            return []
        facts = json.loads(content[start:end + 1])
        return [f.strip() for f in facts if isinstance(f, str) and f.strip()][:5]
    except Exception:
        return []
