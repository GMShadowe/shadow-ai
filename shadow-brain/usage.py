"""What a BYOK endpoint has been asked to do, counted in tokens.

Shadow runs agentic turns: at Ultra effort one message can be 32 separate
calls to the provider, each carrying the whole conversation so far. That is a
genuinely surprising bill if nobody is counting, and the user is the one who
pays it.

**Tokens, never money.** Rates differ per provider, per model and over time,
and a wrong price is worse than no price - someone would plan around it. The
numbers here are what the provider itself reported, and when a provider
reports nothing Shadow says so instead of estimating.

Counts are per endpoint, because that is what has a bill attached, and they
live in data/byok_usage.json rather than in a profile: the same endpoint can
be used by any assistant, and the spend is still one spend.
"""

import json
import os
import tempfile
from datetime import date, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(BASE_DIR, "data", "byok_usage.json")

# Enough history to see a pattern, not enough to grow forever.
KEEP_DAYS = 90


class CapReached(Exception):
    """A spend cap stopped the turn. Already worded for the user."""


def _today() -> str:
    return date.today().isoformat()


def _load() -> dict:
    try:
        with open(PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("not an object")
        data.setdefault("endpoints", {})
        return data
    except FileNotFoundError:
        return {"endpoints": {}}
    except (json.JSONDecodeError, ValueError, OSError) as e:
        # Report it and carry on counting from zero rather than crashing a
        # turn over a bookkeeping file - but never silently.
        print(f"[usage] couldn't read {os.path.basename(PATH)}: {e}. Starting a fresh count.")
        return {"endpoints": {}}


def _save(data: dict) -> None:
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(PATH), prefix=".usage-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.chmod(tmp, 0o600)
        os.replace(tmp, PATH)
    except OSError as e:
        print(f"[usage] couldn't save token counts: {e}")
        try:
            os.unlink(tmp)
        except OSError:
            pass


def _blank() -> dict:
    return {"prompt": 0, "completion": 0, "calls": 0, "turns": 0,
            "days": {}, "unreported_calls": 0}


def _prune(entry: dict) -> None:
    cutoff = (date.today() - timedelta(days=KEEP_DAYS)).isoformat()
    entry["days"] = {d: v for d, v in entry.get("days", {}).items() if d >= cutoff}


def record(endpoint_id: str, prompt: int, completion: int, reported: bool = True) -> None:
    """Add one call's tokens. `reported` false means the provider sent no usage
    block, which is counted separately so the UI can say the total is partial
    rather than showing a number that is quietly too low."""
    if not endpoint_id:
        return
    data = _load()
    entry = data["endpoints"].setdefault(endpoint_id, _blank())
    for key, value in _blank().items():
        entry.setdefault(key, value)

    entry["calls"] += 1
    if reported:
        entry["prompt"] += int(prompt or 0)
        entry["completion"] += int(completion or 0)
    else:
        entry["unreported_calls"] += 1

    day = entry["days"].setdefault(_today(), {"prompt": 0, "completion": 0, "calls": 0})
    day["calls"] += 1
    if reported:
        day["prompt"] += int(prompt or 0)
        day["completion"] += int(completion or 0)

    _prune(entry)
    _save(data)


def count_turn(endpoint_id: str) -> None:
    """One finished turn, for an average worth reading."""
    if not endpoint_id:
        return
    data = _load()
    entry = data["endpoints"].setdefault(endpoint_id, _blank())
    entry["turns"] = entry.get("turns", 0) + 1
    _save(data)


def today_total(endpoint_id: str) -> int:
    entry = _load()["endpoints"].get(endpoint_id) or {}
    day = (entry.get("days") or {}).get(_today()) or {}
    return int(day.get("prompt", 0)) + int(day.get("completion", 0))


def summary(endpoint_id: str) -> dict:
    """What this endpoint has used, for Settings and the status bar."""
    entry = _load()["endpoints"].get(endpoint_id) or {}
    day = (entry.get("days") or {}).get(_today()) or {}
    total = int(entry.get("prompt", 0)) + int(entry.get("completion", 0))
    return {
        "prompt": int(entry.get("prompt", 0)),
        "completion": int(entry.get("completion", 0)),
        "total": total,
        "calls": int(entry.get("calls", 0)),
        "turns": int(entry.get("turns", 0)),
        "today": int(day.get("prompt", 0)) + int(day.get("completion", 0)),
        "today_calls": int(day.get("calls", 0)),
        # True when at least one call came back with no usage block, so every
        # number above is a floor rather than the real figure.
        "partial": int(entry.get("unreported_calls", 0)) > 0,
    }


def all_summaries() -> dict:
    return {mid: summary(mid) for mid in _load()["endpoints"]}


def check(cfg: dict, turn_tokens: int) -> None:
    """Raise CapReached if this turn should not continue.

    Called before the turn and before every later step, so a runaway turn is
    stopped part-way rather than reported afterwards. Caps are per endpoint and
    off unless the user set them.
    """
    cap_turn = int(cfg.get("cap_turn") or 0)
    cap_day = int(cfg.get("cap_day") or 0)
    host = cfg.get("host") or cfg.get("base_url", "the endpoint")
    label = cfg.get("label") or host

    if cap_turn and turn_tokens >= cap_turn:
        raise CapReached(
            f"Stopped: this turn has used {turn_tokens:,} tokens on {label}, which is its "
            f"per-turn cap of {cap_turn:,}. Nothing further was sent. Raise or clear the cap "
            "in Settings - Models & brain, or ask for something smaller."
        )

    if cap_day:
        used = today_total(cfg["tier"]) if cfg.get("tier") else 0
        if used + turn_tokens >= cap_day:
            raise CapReached(
                f"Stopped: {label} has used {used + turn_tokens:,} tokens today, which is its "
                f"daily cap of {cap_day:,}. Nothing further was sent. The count resets "
                "tomorrow, or you can raise the cap in Settings - Models & brain."
            )


def forget(endpoint_id: str) -> None:
    """Drop an endpoint's counts, when the endpoint itself is deleted."""
    data = _load()
    if data["endpoints"].pop(endpoint_id, None) is not None:
        _save(data)


def file_size() -> int:
    try:
        return os.path.getsize(PATH)
    except OSError:
        return 0
