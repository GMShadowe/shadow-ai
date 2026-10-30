"""Decides which adapter(s) handle a message.
Laya or keywords, chosen in settings. Explicit phrases always add their route."""

import re
from router.keywords import classify_keywords
from settings import get_settings

# Thresholds, tuned so the router leans toward plain chat when unsure
# rather than firing a tool-using adapter on a weak guess.
MIN_CONFIDENCE = 0.30      # below this, Laya basically has no idea → plain chat
BLEND_MARGIN = 0.10        # only add a 2nd adapter if it's within this of the top
RESEARCH_MIN = 0.45        # research is slow/privacy-sensitive, so it needs real confidence
IMAGE_MIN = 0.40           # with an image, text-only routing needs higher confidence

# Phrases that always force a route regardless of Laya.
EXPLICIT = {
    "research": ["look up", "look it up", "search the web", "search online", "google it",
                 "browse", "find online", "on the web", "search for",
                 "latest", "current version", "newest", "today", "right now",
                 "this year", "recent", "what version"],
}
FILE_WORDS = ["file", "folder", "directory"]
# Anchored to the start: "I don't remember the filename" is not a memory save.
REMEMBER_RE = re.compile(
    r"^\s*(?:(?:hey|ok|okay|so|and|also|please|pls)[\s,]+)*"
    r"(?:remember|keep in mind|don'?t forget|do not forget|note this|note that)\b",
    re.I,
)


def is_remember(text: str) -> bool:
    return bool(REMEMBER_RE.match(text or ""))


def _decide(probs: dict) -> list[str]:
    """Turn Laya's probabilities into a list of adapters (may be empty = chat)."""
    ranked = sorted(probs.items(), key=lambda kv: kv[1], reverse=True)
    (top, p1), (second, p2) = ranked[0], ranked[1]

    # Too unsure overall → plain chat, no tools.
    if p1 < MIN_CONFIDENCE:
        return []

    # 'chat' winning means no adapter is needed.
    if top == "chat":
        return []

    picked = [top]

    # Blend in a second adapter only if it's genuinely close AND not chat.
    if second != "chat" and (p1 - p2) < BLEND_MARGIN:
        picked.append(second)

    # Research is expensive, so drop it unless it cleared its own higher bar.
    picked = [r for r in picked if r != "research" or probs.get("research", 0) >= RESEARCH_MIN]
    return picked


def _explicit_routes(text: str) -> list[str]:
    lowered = text.lower()
    routes = []
    for route, phrases in EXPLICIT.items():
        if any(p in lowered for p in phrases):
            if route == "research" and any(w in lowered for w in FILE_WORDS) and "web" not in lowered:
                continue
            routes.append(route)
    return routes


def classify_detailed(text: str, previous: str | None = None, has_images: bool = False) -> dict:
    # A "remember ..." message is a memory save — never route it to a tool adapter.
    if is_remember(text):
        return {"adapters": [], "method": "remember", "probabilities": None, "ms": 0}

    result = None
    if get_settings()["router"] == "laya":
        try:
            from router.laya_router import predict_routes
            probs, ms = predict_routes(text, previous)
            result = {"adapters": _decide(probs), "method": "laya",
                      "probabilities": probs, "ms": round(ms)}
        except Exception as e:
            print(f"[router] Laya failed, falling back to keywords: {e}")

    if result is None:
        route = classify_keywords(text)
        result = {"adapters": [route] if route else [], "method": "keywords",
                  "probabilities": None, "ms": 0}

    # With an image, the question is usually about the picture → be stricter,
    # and never auto-route to research (the model should look first).
    if has_images and result["probabilities"]:
        if max(result["probabilities"].values()) < IMAGE_MIN:
            result["adapters"] = []
        result["adapters"] = [a for a in result["adapters"] if a != "research"]
        result["method"] += "+image"

    # Explicit "search/look up" always wins.
    for route in _explicit_routes(text):
        if route not in result["adapters"]:
            result["adapters"].append(route)
            result["method"] += "+explicit"

    return result
