"""Model tiers and effort levels. User choices come from settings.py."""

import json
import os

from settings import get_settings

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Three tiers, and the ids match the labels the user sees - the old
# potato/medium/good ids against Efficient/Default/Plus labels were a
# standing source of confusion.
TIER_ORDER = ["default", "plus", "primal"]

# Old ids, so saved profiles and remembered preferences keep working.
# "potato" was the 2B tier, dropped because its failures were tool-use
# competence rather than anything a smaller choice of tools could fix
# (see the tool tree note in CLAUDE.md). Anything pointing at it lands on
# the new floor, the 4B.
TIER_ALIASES = {"potato": "default", "medium": "default", "good": "plus"}

EFFORT_STEPS = {"low": 3, "medium": 6, "high": 12, "extra": 20, "ultra": 32}


def normalize_tier(name: str | None) -> str | None:
    """A model id as it is today, or None if the name means nothing.

    Besides the three tiers this accepts the user's own models, whose ids
    are prefixed byom: or byok: (see custom.py). They behave like tiers
    everywhere above this file.
    """
    if not name:
        return None
    if name in TIER_ORDER:
        return name
    if name in TIER_ALIASES:
        return TIER_ALIASES[name]
    import custom
    if custom.is_custom(name) and custom.get(name) is not None:
        return name
    return None


def default_tier() -> str:
    from assistants import get_profile
    return normalize_tier(get_profile()["model"]) or TIER_ORDER[0]


def default_effort() -> str:
    from assistants import get_profile
    effort = get_profile()["effort"]
    return effort if effort in EFFORT_STEPS else "medium"


def get_workspace() -> str:
    path = os.path.realpath(os.path.expanduser(get_settings()["workspace"]))
    os.makedirs(path, exist_ok=True)
    return path


def load_tier_config(name: str | None = None) -> dict:
    """The config for a model, whether it is a built-in tier or one of the
    user's own. Same keys either way - label, base_model, vision - so the
    rest of the brain doesn't care which it got."""
    tier = default_tier() if name is None else normalize_tier(name)
    if tier is None:
        raise ValueError(
            f"Unknown model '{name}'. The built-in tiers are: {', '.join(TIER_ORDER)}. "
            "Your own models are listed in Settings - Models & brain."
        )

    import custom
    if custom.is_custom(tier):
        entry = custom.get(tier)
        if entry is None:
            raise ValueError(
                f"The model '{tier}' isn't in your list any more. Pick another one in Settings."
            )
        cfg = {
            "tier": tier,
            "kind": entry["kind"],
            "label": entry["label"],
            "description": ("Your own model, running in your Ollama." if entry["kind"] == "byom"
                            else f"Your own endpoint at {custom.host_of(entry.get('base_url', ''))}."),
            "base_model": entry["model"],
            "vision": bool(entry.get("vision")),
            "tools": bool(entry.get("tools", True)),
            "min_ram_gb": 0,
            "custom": True,
        }
        if entry["kind"] == "byok":
            cfg["base_url"] = entry.get("base_url", "")
            cfg["host"] = custom.host_of(entry.get("base_url", ""))
            cfg["key"] = entry.get("key", "")  # never leaves the brain
            # The spend caps have to travel with the config: model.py checks
            # them against this dict, not against the stored entry.
            cfg["cap_turn"] = int(entry.get("cap_turn") or 0)
            cfg["cap_day"] = int(entry.get("cap_day") or 0)
        return cfg

    with open(os.path.join(BASE_DIR, "tiers", f"{tier}.json"), "r", encoding="utf-8") as f:
        cfg = json.load(f)
    cfg["tier"] = tier
    cfg.setdefault("kind", "builtin")
    cfg.setdefault("tools", True)
    cfg.setdefault("custom", False)
    return cfg


def is_placeholder(name: str | None = None) -> bool:
    """Primal has no model chosen yet, so it can't run anything. Callers
    check this instead of discovering it as an Ollama error."""
    try:
        cfg = load_tier_config(name)
    except (ValueError, OSError):
        return False
    return bool(cfg.get("placeholder")) or not cfg.get("base_model")


def all_tiers(include_custom: bool = True) -> list[dict]:
    """The three tiers, then the user's own models, in picker order."""
    out = [load_tier_config(n) for n in TIER_ORDER]
    if include_custom:
        import custom
        for entry in custom.all_models():
            try:
                out.append(load_tier_config(entry["id"]))
            except (ValueError, OSError) as e:
                print(f"[config] skipping custom model {entry.get('id')}: {e}")
    return out


def max_steps(effort: str | None = None) -> int:
    return EFFORT_STEPS.get(effort or default_effort(), 6)
