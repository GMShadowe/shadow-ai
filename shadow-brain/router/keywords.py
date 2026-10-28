"""Keyword fallback router, used only if Laya fails to load."""

RULES = {
    "coding": ["code", "script", "function", "bug", "debug", "python", ".py", "javascript",
               "program", "compile", "error in", "refactor", "fix the"],
    "research": ["search", "look up", "google", "website", "http", "url", "find out",
                 "news", "latest", "who is", "what is the price"],
    "system": ["run ", "command", "terminal", "install", "open ", "launch", "app",
               "ram", "cpu", "disk", "system info", "my computer", "my mac"],
    "files": ["file", "folder", "directory", "rename", "move ", "organize", "read ",
              "find ", "where is", "contains"],
}


def classify_keywords(text: str) -> str | None:
    lowered = text.lower()
    scores = {name: sum(word in lowered for word in words) for name, words in RULES.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else None
