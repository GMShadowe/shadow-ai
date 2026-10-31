"""Things Shadow puts on screen when the user asks to see them: a list, a
chart, pictures.

The data travels as data. The model passes items and numbers as tool
arguments, they are checked here, and the UI draws the card from those same
arguments - nothing is ever parsed back out of prose, which is what
CLAUDE.md asks of any chart. A malformed call comes back as an Error the
model can read and fix, and the UI draws nothing for it.

The result the model reads is a short note, not the data again: it already
has the data, and a voice reply that read the list back out would be the
opposite of what the screen is for.
"""

import json
import re

from tools.state import offline

MAX_ITEMS = 30
MAX_POINTS = 24
MAX_IMAGES = 6

SHOWN = ("It is on the user's screen now. Don't repeat it in your reply: say in a sentence "
         "or two what it shows, or answer their question about it.")


def _text(value, limit: int) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def list_items(items) -> list[dict]:
    """Items as [{title, detail}], from objects or plain strings. Raises
    ValueError with something the model can act on."""
    if isinstance(items, str):
        try:
            items = json.loads(items)
        except json.JSONDecodeError:
            raise ValueError("items must be a list, e.g. [{\"title\": \"Apple\", \"detail\": \"Makes the iPhone\"}]")
    if not isinstance(items, list) or not items:
        raise ValueError("items must be a non-empty list of {title, detail} objects")
    out = []
    for item in items[:MAX_ITEMS]:
        if isinstance(item, dict):
            title, detail = _text(item.get("title"), 120), _text(item.get("detail"), 300)
        else:
            title, detail = _text(item, 120), ""
        if title:
            out.append({"title": title, "detail": detail})
    if not out:
        raise ValueError("every item needs a title")
    return out


def show_list(title: str, items) -> str:
    try:
        rows = list_items(items)
    except ValueError as e:
        return f"Error: {e}."
    return f"Shown: a list titled \"{_text(title, 120)}\" with {len(rows)} items. {SHOWN}"


def _number(value) -> float:
    if isinstance(value, bool):
        raise ValueError
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r"[,\s%$€£₹]", "", str(value))
    return float(cleaned)


def chart_points(labels, values) -> list[dict]:
    for name, value in (("labels", labels), ("values", values)):
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                raise ValueError(f"{name} must be a list")
        if name == "labels":
            labels = value
        else:
            values = value
    if not isinstance(labels, list) or not isinstance(values, list) or not labels:
        raise ValueError("labels and values must be non-empty lists")
    if len(labels) != len(values):
        raise ValueError(f"labels has {len(labels)} entries and values has {len(values)}; they must match")
    points = []
    for label, value in list(zip(labels, values))[:MAX_POINTS]:
        try:
            number = _number(value)
        except (TypeError, ValueError):
            raise ValueError(f"the value for \"{label}\" isn't a number: {value!r}")
        points.append({"label": _text(label, 40), "value": number})
    return points


def show_chart(title: str, labels, values, unit: str = "", kind: str = "bar") -> str:
    try:
        points = chart_points(labels, values)
    except ValueError as e:
        return f"Error: {e}."
    kind = kind if kind in ("bar", "line") else "bar"
    return f"Shown: a {kind} chart titled \"{_text(title, 120)}\" with {len(points)} points. {SHOWN}"


def show_images(query: str, count: int = 4) -> str:
    """Searches DuckDuckGo images and returns thumbnails. The browser never
    fetches them: the UI loads each through the brain's /preview/image,
    like link previews, so the sites don't learn who is looking."""
    if offline():
        return ("Blocked: offline mode is on, so nothing may leave this computer. "
                "Tell the user they can turn it off in Settings - Privacy.")
    query = _text(query, 200)
    if not query:
        return "Error: say what to search pictures of, e.g. query: \"Taj Mahal\"."
    try:
        count = max(1, min(int(count), MAX_IMAGES))
    except (TypeError, ValueError):
        count = 4
    try:
        from ddgs import DDGS
    except ImportError:
        return "Error: picture search needs the 'ddgs' package. Run: pip install ddgs"
    try:
        results = DDGS().images(query, max_results=count * 2) or []
    except Exception as e:
        return f"Error searching for pictures: {e}"

    images = []
    for r in results:
        thumb, page = r.get("thumbnail") or "", r.get("url") or ""
        if thumb.startswith("https://") and page.startswith(("https://", "http://")):
            images.append({"thumb": thumb, "page": page, "title": _text(r.get("title"), 140),
                           "source": _text(r.get("source"), 40)})
        if len(images) == count:
            break
    if not images:
        return f"No pictures found for \"{query}\"."
    # The UI reads the JSON on the first line; the model reads the note.
    return (json.dumps({"images": images}) +
            f"\nShown: {len(images)} pictures of \"{query}\". They are on the user's screen now. "
            "Say in a sentence what they show; you can't see them, so don't describe details.")


def images_from_result(result: str) -> list[dict]:
    try:
        return json.loads(result.split("\n", 1)[0]).get("images", [])
    except (ValueError, AttributeError):
        return []
