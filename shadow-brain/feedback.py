"""Thumbs up and down on a reply, kept as training signal.

This is not decoration. A rating is only worth storing if it can later be
turned into a training example, so each record carries the whole turn: what
the user asked, what Shadow answered, which route and model produced it,
how confident the router was, which tools ran, and - when the user says -
what was wrong with it. The shape deliberately echoes turns.jsonl, since
both files feed the same future fine-tuning work.

Global rather than per-assistant: the signal is about the models and the
pipeline, not about one assistant's personality.

One file, rewritten whole on each change, because a rating has to be
changeable and clearable - an append-only log would need replaying to know
the current state. It is small (a few hundred bytes a turn) and written
atomically, so a crash mid-write can't leave half a file.
"""

import json
import os
import tempfile
from datetime import datetime

PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "feedback.json")

RATINGS = ("up", "down")

# The failure modes actually seen in this project, so a dislike can be
# labelled in one tap. Free text covers everything else.
REASONS = {
    "wrong_tool": "Used the wrong tool",
    "claimed": "Claimed something it didn't do",
    "ignored": "Didn't follow the instruction",
    "slow": "Too slow",
    "wrong_info": "Wrong information",
    "formatting": "Bad formatting",
}

MAX_REASON = 300
# Enough of a tool result to see what it did, not the whole 8000-char file.
RESULT_KEEP = 400


class FeedbackError(Exception):
    """The message is shown to the user."""


def _load() -> dict:
    try:
        with open(PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return {"version": 1, "ratings": []}
    except (OSError, json.JSONDecodeError) as e:
        # Never silently start a fresh file over a damaged one: that would
        # throw away every rating collected so far.
        raise FeedbackError(
            f"Couldn't read {os.path.basename(PATH)}: {e}. Move the file aside and rate again."
        ) from e
    if not isinstance(data, dict) or not isinstance(data.get("ratings"), list):
        raise FeedbackError(
            f"{os.path.basename(PATH)} isn't in the expected shape. Move it aside and rate again."
        )
    return data


def _save(data: dict) -> None:
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    folder = os.path.dirname(PATH)
    fd, tmp = tempfile.mkstemp(dir=folder, prefix=".feedback-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, PATH)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def _tool_summary(tools: list | None) -> list[dict]:
    """Which tools ran and what came back, trimmed. Permission prompts are
    kept too: "the user denied it" explains a lot of bad replies."""
    out = []
    for t in tools or []:
        if t.get("kind") == "permission":
            out.append({"permission": t.get("name"), "decision": t.get("decision")})
            continue
        result = t.get("result")
        if isinstance(result, str) and len(result) > RESULT_KEEP:
            result = result[:RESULT_KEEP] + f"… [{len(result)} chars]"
        out.append({"name": t.get("name"), "args": t.get("args"), "result": result})
    return out


def record(message_id: str, rating: str | None, *, conversation_id: str = "",
           user_input: str = "", reply: str = "", meta: dict | None = None,
           reason_code: str | None = None, reason: str = "") -> dict | None:
    """Set, change or clear the rating on one reply.

    rating=None clears it. Returns the stored record, or None when cleared.
    """
    if rating is not None and rating not in RATINGS:
        raise FeedbackError(f"A rating is 'up', 'down' or nothing, not '{rating}'.")
    if reason_code and reason_code not in REASONS:
        raise FeedbackError(f"'{reason_code}' isn't one of the reasons: {', '.join(REASONS)}.")

    data = _load()
    # One record per reply: rating again replaces it rather than piling up.
    data["ratings"] = [r for r in data["ratings"] if r.get("message_id") != message_id]

    if rating is None:
        _save(data)
        return None

    meta = meta or {}
    router = meta.get("router") or {}
    probabilities = router.get("probabilities") or {}
    record = {
        "message_id": message_id,
        "conversation_id": conversation_id,
        "time": datetime.now().isoformat(),
        "rating": rating,
        # Only ever set on a dislike, and always optional.
        "reason_code": reason_code or None,
        "reason_label": REASONS.get(reason_code or "") or None,
        "reason": (reason or "").strip()[:MAX_REASON] or None,
        "input": user_input,
        "reply": reply,
        "route": meta.get("route"),
        "skill": meta.get("skill"),
        "model": meta.get("model"),
        "effort": meta.get("effort"),
        "router_method": router.get("method"),
        "router_confidence": round(max(probabilities.values()), 4) if probabilities else None,
        "probabilities": probabilities,
        "tools": _tool_summary(meta.get("tools")),
    }
    data["ratings"].append(record)
    _save(data)
    return record


def stats() -> dict:
    """For the privacy and data lists, and for a quick sanity check."""
    try:
        data = _load()
    except FeedbackError:
        return {"up": 0, "down": 0, "with_reason": 0, "total": 0, "unreadable": True}
    rows = data["ratings"]
    return {
        "up": sum(1 for r in rows if r.get("rating") == "up"),
        "down": sum(1 for r in rows if r.get("rating") == "down"),
        "with_reason": sum(1 for r in rows if r.get("reason") or r.get("reason_code")),
        "total": len(rows),
        "unreadable": False,
    }
