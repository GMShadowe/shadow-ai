"""Models the user brings themselves: their own Ollama model (BYOM) or
their own OpenAI-compatible endpoint (BYOK).

Why both, and why they are not the same thing:

- **BYOM** is any model already pulled in the user's Ollama. Nothing
  changes about the promise - it runs on this computer, nothing leaves it.
  The only caveat is quality: Shadow's prompts are tuned for Qwen 3.5, and
  another model may handle tools worse.
- **BYOK** sends the conversation to somebody else's computer. Files that
  were read, tool results, images - all of it goes to the endpoint. That
  is the one thing Shadow otherwise promises never to do, so it is opt-in
  per model, stated plainly where it is turned on, shown in the privacy
  report, blocked by offline mode, and flagged in the UI for as long as
  such a model is selected.

The definitions are global (`data/custom_models.json`) because defining a
model once and using it from any assistant is the obvious behaviour; the
*selection* is per assistant, in `profile.model`, like any built-in tier.

The API key lives in that file and nowhere else: not in the UI's storage,
not in the settings response, not in a log line, not in an export. `public()`
is the only shape that ever leaves this module, and it has no key in it.
"""

import json
import os
import re
import tempfile
import uuid
from urllib.parse import urlparse

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(BASE_DIR, "data", "custom_models.json")

KINDS = ("byom", "byok")
MAX_MODELS = 12
MAX_LABEL = 40
# Ollama model names: letters, digits, and the usual separators.
MODEL_RE = re.compile(r"^[A-Za-z0-9._/:@-]{1,120}$")


class CustomError(Exception):
    """The message is shown to the user."""


def _load() -> dict:
    try:
        with open(PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        return {"version": 1, "models": []}
    except (OSError, json.JSONDecodeError) as e:
        raise CustomError(
            f"Couldn't read {os.path.basename(PATH)}: {e}. Move the file aside and add the model again."
        ) from e
    if not isinstance(data, dict) or not isinstance(data.get("models"), list):
        raise CustomError(
            f"{os.path.basename(PATH)} isn't in the expected shape. Move it aside and add the model again."
        )
    return data


def _save(data: dict) -> None:
    os.makedirs(os.path.dirname(PATH), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(PATH), prefix=".custom-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        # The file holds an API key, so it is readable by this user only.
        os.chmod(tmp, 0o600)
        os.replace(tmp, PATH)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


def all_models() -> list[dict]:
    """Full entries, keys included. Internal use only."""
    return [m for m in _load()["models"] if m.get("kind") in KINDS]


def get(mid: str) -> dict | None:
    return next((m for m in all_models() if m["id"] == mid), None)


def _strip(model: dict) -> dict:
    """The only version that leaves this module. The key is reduced to a
    hint, so the UI can show that one is stored without ever holding it."""
    out = {k: v for k, v in model.items() if k != "key"}
    if model.get("kind") == "byok":
        key = model.get("key") or ""
        out["key_set"] = bool(key)
        out["key_hint"] = f"…{key[-4:]}" if len(key) > 4 else ("set" if key else "")
        out["host"] = host_of(model.get("base_url", ""))
    return out


def public() -> list[dict]:
    return [_strip(m) for m in all_models()]


def host_of(base_url: str) -> str:
    try:
        return urlparse(base_url).hostname or base_url
    except ValueError:
        return base_url


def is_custom(mid: str | None) -> bool:
    return bool(mid) and mid.split(":", 1)[0] in KINDS


def _check_label(label: str, fallback: str) -> str:
    label = " ".join((label or "").split())[:MAX_LABEL]
    return label or fallback


def add_byom(model: str, label: str = "", vision: bool | None = None,
             tools: bool | None = None) -> dict:
    """One of the user's own Ollama models. Capabilities are read from
    Ollama itself where it will tell us, so the user isn't asked to know."""
    model = (model or "").strip()
    if not MODEL_RE.match(model):
        raise CustomError("That isn't a valid Ollama model name. Pick one from the list of installed models.")

    detected = detect_ollama(model)
    entry = {
        "id": f"byom:{model}",
        "kind": "byom",
        "label": _check_label(label, model),
        "model": model,
        "vision": detected["vision"] if vision is None else bool(vision),
        "tools": detected["tools"] if tools is None else bool(tools),
        "detected": detected["detected"],
    }
    return _put(entry)


LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}


def is_loopback(host: str | None) -> bool:
    host = (host or "").lower().strip("[]")
    return host in LOOPBACK_HOSTS or host.startswith("127.") or host.endswith(".localhost")


def check_base_url(base_url: str) -> str:
    """A base URL the key may be sent to, or a CustomError saying why not.

    https only, because the key travels in a header on every request and
    plain http hands it to anyone on the path. The one exception is a server
    on this computer (localhost), where there is no path to listen on.
    """
    base_url = (base_url or "").strip().rstrip("/")
    try:
        parsed = urlparse(base_url)
        parsed.port  # raises on a port that isn't a number
    except ValueError:
        parsed = None
    if parsed is None or parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise CustomError(
            "The base URL needs to start with https:// and include a host, "
            "like https://api.openai.com/v1."
        )
    if parsed.scheme == "http" and not is_loopback(parsed.hostname):
        raise CustomError(
            f"{parsed.hostname} would get your API key over plain http, unencrypted. "
            "Use its https:// address. Plain http is only allowed for a server on this computer (localhost)."
        )
    return base_url


def _origin(base_url: str) -> tuple:
    """Where a key actually goes: scheme, host and port. The path can change
    freely without it going anywhere new."""
    parsed = urlparse(base_url or "")
    try:
        port = parsed.port
    except ValueError:
        port = None
    return (parsed.scheme, (parsed.hostname or "").lower(), port)


def add_byok(base_url: str, model: str, key: str, label: str = "",
             vision: bool = False, tools: bool = True) -> dict:
    """An OpenAI-compatible endpoint: base URL, key, model name."""
    base_url = check_base_url(base_url)
    model = (model or "").strip()
    key = (key or "").strip()

    if not model:
        raise CustomError("Give the model name the provider expects, like gpt-4o-mini.")
    if not key:
        raise CustomError("An API key is needed. If the endpoint doesn't check one, put any text here.")

    entry = {
        "id": f"byok:{uuid.uuid4().hex[:8]}",
        "kind": "byok",
        "label": _check_label(label, model),
        "base_url": base_url,
        "model": model,
        "key": key,
        "vision": bool(vision),
        "tools": bool(tools),
        "detected": False,
        # Token caps, off until the user sets them. They sit on the endpoint
        # rather than on an assistant: the same endpoint can be used by any
        # assistant and the spend is still one spend.
        "cap_turn": 0,
        "cap_day": 0,
    }
    return _put(entry)


def _put(entry: dict) -> dict:
    data = _load()
    models = [m for m in data["models"] if m.get("id") != entry["id"]]
    if len(models) >= MAX_MODELS:
        raise CustomError(f"You can keep up to {MAX_MODELS} of your own models. Remove one first.")
    models.append(entry)
    data["models"] = models
    _save(data)
    return _strip(entry)


def update(mid: str, patch: dict) -> dict:
    entry = get(mid)
    if entry is None:
        raise CustomError("That model isn't in your list any more.")
    allowed = {"label", "vision", "tools", "base_url", "model", "key",
               "cap_turn", "cap_day"}
    # A key was given to one host. Pointing the endpoint somewhere else must
    # not quietly send that key along, so a new host needs a new key in the
    # same request - asked for, rather than cleared, so the endpoint never
    # sits half-configured.
    new_url = patch.get("base_url")
    if entry.get("kind") == "byok" and new_url is not None:
        new_url = check_base_url(new_url)
        patch = {**patch, "base_url": new_url}
        new_key = str(patch.get("key") or "").strip()
        if _origin(new_url) != _origin(entry.get("base_url", "")) and not new_key:
            raise CustomError(
                f"The stored API key was for {host_of(entry.get('base_url', ''))}, so it isn't sent to "
                f"{host_of(new_url)}. Enter the key for the new address along with it."
            )
    for field, value in patch.items():
        if field not in allowed or value is None:
            continue
        if field == "label":
            entry["label"] = _check_label(value, entry["label"])
        elif field in ("vision", "tools"):
            entry[field] = bool(value)
        elif field in ("cap_turn", "cap_day"):
            # 0 means no cap. A negative or unreadable number would silently
            # stop every turn, so it is refused rather than clamped.
            try:
                number = int(value)
            except (TypeError, ValueError):
                raise CustomError(f"A token cap has to be a whole number, not '{value}'.") from None
            if number < 0:
                raise CustomError("A token cap can't be negative. Use 0 for no cap.")
            entry[field] = number
        elif field == "key":
            value = str(value).strip()
            if value:  # an empty key means "leave the stored one alone"
                entry["key"] = value
        else:
            entry[field] = str(value).strip()
    data = _load()
    data["models"] = [entry if m["id"] == mid else m for m in data["models"]]
    _save(data)
    return _strip(entry)


def remove(mid: str) -> bool:
    data = _load()
    before = len(data["models"])
    data["models"] = [m for m in data["models"] if m.get("id") != mid]
    if len(data["models"]) == before:
        return False
    _save(data)
    # The endpoint is gone, so its token counts are about nothing. Dropping
    # them also keeps a stale id out of the privacy report.
    try:
        import usage
        usage.forget(mid)
    except Exception as e:
        print(f"[custom] couldn't clear token counts for {mid}: {e}")
    return True


def detect_ollama(model: str) -> dict:
    """Ask Ollama what the model can do. Recent versions report
    capabilities; older ones don't, and then the user decides."""
    try:
        import ollama
        info = ollama.show(model)
        caps = [c.lower() for c in (getattr(info, "capabilities", None) or [])]
        if caps:
            return {"vision": "vision" in caps, "tools": "tools" in caps, "detected": True}
    except Exception as e:
        print(f"[custom] couldn't read capabilities for {model}: {e}")
    return {"vision": False, "tools": True, "detected": False}


def installed_ollama() -> list[dict]:
    """What the user has pulled, so they pick from a list instead of typing
    a string. Embedding models are left out - they can't hold a conversation."""
    try:
        import ollama
        models = ollama.list().models
    except Exception as e:
        raise CustomError(f"Couldn't reach Ollama to list your models: {e}. Is it running?") from e

    out = []
    for m in models:
        name = m.model
        if "embed" in name:
            continue
        caps = detect_ollama(name)
        size = getattr(m, "size", None)
        out.append({"model": name, "bytes": int(size) if size else 0,
                    "vision": caps["vision"], "tools": caps["tools"],
                    "detected": caps["detected"]})
    return sorted(out, key=lambda m: m["model"])


def byok_endpoints() -> list[dict]:
    """For the privacy report: every endpoint that could be sent a message."""
    return [{"id": m["id"], "label": m["label"], "host": host_of(m.get("base_url", "")),
             "model": m.get("model", "")}
            for m in all_models() if m["kind"] == "byok"]
