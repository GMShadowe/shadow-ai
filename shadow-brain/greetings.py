"""Generates short, personal greetings for the empty-chat screen,
using the assistant's name and a few things it remembers about the user."""

import random
import re

import ollama

from assistants import get_profile
from config import load_tier_config
from memory import long_term

# Always-available fallbacks, used if the model is slow or memory is empty.
GENERIC = [
    "What are we building?",
    "Where should we start?",
    "What's on your mind?",
    "What can I do for you?",
    "What are you working on?",
    "Ready when you are.",
]

# {name} is the assistant's own name - the speaker, not the person being
# greeted. It used to be labelled as the user's name here, which made an
# assistant called Nova greet the user as "Nova". Anything actually known
# about the user comes from memory, in {facts}.
PROMPT = """Write 5 very short, warm greetings for the start of a new chat.
Each must be ONE short line, under 8 words, friendly and natural.

You are the assistant, and your name is {name}. You are greeting the person
you are talking to. Things you remember about them:
{facts}

Use something you remember about them in SOME of the greetings, lightly and
naturally (not forced, not every line). Only use a name for them if one of
those facts actually gives you their name - otherwise don't guess at one, and
never call them by your own name. Keep them casual and real, like a friend
saying hi. If something is in another language or culture, a playful nod is
welcome.

Reply with ONLY a JSON array of 5 strings, nothing else."""


def _parse(content: str) -> list[str]:
    """Pull the greetings out of whatever the model actually sent.

    Asked for one array of five strings, the 9B often answers with five
    separate one-item arrays instead. Reading from the first "[" to the last
    "]" then spans all of them, which is not valid JSON, so every generated
    greeting was quietly thrown away and only the generic ones ever showed.
    So: try the whole span first, and fall back to each array on its own.
    """
    import json

    def clean(items) -> list[str]:
        return [s.strip() for s in items
                if isinstance(s, str) and 0 < len(s.strip()) < 60]

    start, end = content.find("["), content.rfind("]")
    if start == -1 or end == -1:
        return []

    try:
        parsed = json.loads(content[start:end + 1])
        if isinstance(parsed, list):
            return clean(parsed)[:5]
    except json.JSONDecodeError:
        pass

    # One array per line, or several runs of them.
    out = []
    for match in re.findall(r"\[[^\[\]]*\]", content):
        try:
            parsed = json.loads(match)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, list):
            out.extend(clean(parsed))
    return out[:5]


def _local_model() -> str | None:
    """The Ollama model to write greetings with, or None when there isn't one
    that is allowed to see the user's memories.

    With a BYOK model selected, asking it would send those memories to the
    provider - and bill for it - just to say hello, and Ollama doesn't know
    the name either. Greetings are decoration; the generic ones are fine."""
    try:
        cfg = load_tier_config()
    except ValueError as e:
        print(f"[greetings] no model to write them with: {e}")
        return None
    if cfg.get("kind") == "byok":
        print("[greetings] the selected model is BYOK, so memories stay here and the generic greetings are used")
        return None
    return cfg.get("base_model")


def _generated(name: str, facts: list[str]) -> list[str]:
    model = _local_model()
    if not model:
        return []
    try:
        resp = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": PROMPT.format(
                name=name, facts="\n".join(f"- {f}" for f in facts))}],
            think=False,
            options={"temperature": 0.9},
        )
    except Exception as e:
        # A greeting is decoration, so a failure here must never break the
        # screen - but it shouldn't vanish without a word either.
        print(f"[greetings] couldn't generate any: {e}")
        return []

    out = _parse(resp.message.content or "")
    if not out:
        print("[greetings] model didn't return a usable list, using the generic ones")
    return out


def greetings() -> list[str]:
    profile = get_profile()
    name = profile.get("name", "Shadow")
    facts = [m["text"] for m in long_term.all_memories()][:8]

    options = list(GENERIC)
    # Only spend a model call if there is something to personalize *with*.
    # This used to also fire on any name other than "Shadow", which stopped
    # meaning anything once people name their own assistants - every name is
    # a custom one now, and a name alone personalizes nothing.
    if facts:
        options = _generated(name, facts) + GENERIC
    random.shuffle(options)
    return options[:6]
