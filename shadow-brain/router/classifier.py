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
                 "latest version", "latest release", "latest news", "current version",
                 "what version"],
    "system": ["disk space", "free space", "storage left", "space left", "my disk", "my drive",
               "my ram", "how much ram", "how much memory", "cpu usage", "my cpu", "my battery",
               "on this computer", "on my computer", "on this mac", "on my mac", "on this laptop",
               "on my laptop", "running processes", "what processes", "which processes",
               "what's running", "whats running", "uptime", "ip address", "my ip", "mac address",
               "this computer been on", "my wifi", "which port", "what port", "on port", "using port", "listening on"],
    "files": ["what kind of file", "what type of file", "type of file is", "file type of"],
}
FILE_WORDS = ["file", "folder", "directory"]
# Naming a file action is as explicit as "search the web". Laya splits its
# confidence six ways, so "read notes.md" scored under MIN_CONFIDENCE and
# arrived as plain chat with no file tools.
FILE_ACTION_RE = re.compile(
    r"\b(?:read|open|list|show|delete|remove|rename|move|copy|edit|create|write|save|find|search)\b"
    r".{0,40}?(?:\b(?:files?|folders?|director(?:y|ies)|workspace)\b|\b[\w\-]+\.(?:md|txt|py|js|ts|tsx|jsx|"
    r"json|csv|html|css|pdf|log|yaml|yml|toml|sh|ipynb|docx?|xlsx?)\b)", re.I)
# A message that names a file by name ("add up the temp column in data.csv")
# is about that file whatever the verb. Library names that look like files
# ("node.js") are not, and neither is anything inside a link.
NAMED_FILE_RE = re.compile(
    r"(?<![/\w.:-])[\w\-]+\.(?:md|txt|py|js|ts|tsx|jsx|json|csv|html|css|pdf|log|yaml|yml|toml|sh|"
    r"ipynb|docx?|xlsx?|zip)\b(?![/.\w])", re.I)
NOT_A_FILE_RE = re.compile(
    r"\b(?:node|next|nuxt|vue|three|express|d3|chart|deno|bun|p5|ember|backbone|angular|react|"
    r"solid|alpine|htmx|moment|socket\.io)\.js\b", re.I)


LINK_RE = re.compile(r"\b(?:https?://|www\.)\S+", re.I)


def names_a_file(text: str) -> bool:
    text = NOT_A_FILE_RE.sub("", LINK_RE.sub("", text))
    return bool(FILE_ACTION_RE.search(text) or NAMED_FILE_RE.search(text))

# Asking about the world, not about the user: "news on my job application"
# is private and must not reach a search engine (#5).
ABOUT_THE_WORLD_RE = re.compile(
    r"\b(?:news (?:about|on)|latest on|search (?:on|in)|try searching)\s+(?!my\b|our\b|me\b|us\b)", re.I)
# Anchored to the start: "I don't remember the filename" is not a memory save.
REMEMBER_RE = re.compile(
    r"^\s*(?:(?:hey|ok|okay|so|and|also|please|pls)[\s,]+)*"
    r"(?:remember|keep in mind|don'?t forget|do not forget|note this|note that)\b",
    re.I,
)


def is_remember(text: str) -> bool:
    return bool(REMEMBER_RE.match(text or ""))


# Asking to *see* something. Matched on the words, like the research phrases,
# because these tools are granted only when asked for: a small model given a
# list tool on every turn starts answering everything as a list.
CHART_RE = re.compile(r"\b(chart|graph|plot|visuali[sz]e)\b", re.I)
LIST_RE = re.compile(r"\b(list|top \d+|ranking|rank)\b", re.I)
# "list the files" is a job for list_dir; a list tool there invites a model to
# write a file listing from memory instead of reading the folder.
FILES_RE = re.compile(r"\b(files?|folders?|director(y|ies)|workspace)\b", re.I)
IMAGES_RE = re.compile(
    r"\b(pictures?|photos?|images?|pics?)\s+of\b"
    r"|\bshow me (?:a |an |some )?(?:pictures?|photos?|images?|pics?)\b"
    r"|\bwhat does .+ look like\b",
    re.I,
)


SKILL_RE = re.compile(r"\b(add|install|get|download|find|search\s+(?:up|for)|look\s+up)\b.{0,60}\bskills?\b",
                      re.IGNORECASE)


def display_tools(text: str, has_images: bool = False) -> list[str]:
    """The on-screen tools this message asks for, if any."""
    text = text or ""
    wanted = []
    if LIST_RE.search(text) and not FILES_RE.search(text):
        wanted.append("show_list")
    if CHART_RE.search(text):
        # A chart is numbers, and the numbers usually live on the web. Asked
        # for in plain chat, the model had nothing to draw it from and
        # (rightly) refused rather than inventing them.
        wanted += ["show_chart", "web_search"]
    # With a picture attached, "image" is about that picture.
    if not has_images and IMAGES_RE.search(text):
        wanted.append("show_images")
    if SKILL_RE.search(text):
        wanted += ["web_search", "add_skill"]
    return wanted


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
        if any(p in lowered for p in phrases) or (route == "research" and ABOUT_THE_WORLD_RE.search(text)):
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

    if names_a_file(text) and "files" not in result["adapters"]:
        result["adapters"].append("files")
        result["method"] += "+explicit"

    # Explicit "search/look up" always wins.
    for route in _explicit_routes(text):
        if route not in result["adapters"]:
            result["adapters"].append(route)
            result["method"] += "+explicit"

    return result
