"""Turning the failures people actually hit into something they can act on.

Every one of these used to reach the user as whatever the library said.
`[Errno 61] Connection refused` is the most likely first-run failure in the
whole product - Ollama simply isn't running - and it tells someone nothing.

Each translation says what happened and what to do next, and where there is
an obvious action it names it so the UI can offer a button instead of asking
the user to go and type a command. The original text is kept in `detail`:
CLAUDE.md's rule is that tool errors are reported verbatim, and the same
honesty applies here - the plain words are added, they don't replace anything.
"""

import re

# Action types the UI knows how to offer. Anything else is just a message.
#   pull     -> offer to download `model`
#   retry    -> offer to send the message again
#   models   -> offer to open Settings - Models & brain
#   privacy  -> offer to open Settings - Privacy


def _smaller_tier(current: str | None) -> str | None:
    """A tier the machine is likelier to cope with, by name, so an
    out-of-memory message can suggest something real instead of "try a
    smaller model"."""
    from config import TIER_ORDER
    try:
        index = TIER_ORDER.index(current)
    except (ValueError, AttributeError):
        return None
    for name in reversed(TIER_ORDER[:index]):
        return name
    return None


def _label(tier: str | None) -> str:
    if not tier:
        return ""
    try:
        from config import load_tier_config
        cfg = load_tier_config(tier)
        return f"{cfg['label']} ({cfg['base_model']})"
    except Exception:
        return tier


def explain(exc: Exception, model: str | None = None, tier: str | None = None) -> dict:
    """{kind, message, detail, action} for any exception from a turn."""
    import httpx

    text = str(exc)
    name = type(exc).__name__
    status = getattr(exc, "status_code", None)
    lower = text.lower()

    # Already worded for the user by providers._explain, which knows the host,
    # the model and what the provider said. Don't second-guess it.
    import providers
    if isinstance(exc, providers.ProviderError):
        action = "models"
        if "offline mode" in lower:
            action = "privacy"
        return {"kind": "provider", "message": text, "detail": "", "action": action}

    # A BYOK spend cap stopped the turn. Raised by model.py, already worded.
    from usage import CapReached
    if isinstance(exc, CapReached):
        return {"kind": "cap", "message": text, "detail": "", "action": "models"}

    # Ollama isn't running. The connection is refused at the socket, so this
    # arrives as httpx long before Ollama has a chance to say anything.
    if isinstance(exc, (httpx.ConnectError, ConnectionError)) or "connection refused" in lower \
            or "connect call failed" in lower or "max retries exceeded" in lower:
        return {
            "kind": "ollama_down",
            "message": ("Ollama isn't running, so there's no model to answer with. "
                        "Start it and try again - on a Mac that's opening the Ollama app, "
                        "or running `ollama serve` in a terminal. "
                        "Everything else in Shadow keeps working; only the model needs it."),
            "detail": text,
            "action": "retry",
        }

    # The model isn't pulled. Ollama says which one, but buried in a 404.
    missing = re.search(r"model ['\"]?([\w.:\-/]+)['\"]? not found", text, re.I)
    if missing or (status == 404 and "model" in lower):
        wanted = missing.group(1) if missing else (model or "that model")
        return {
            "kind": "model_missing",
            "message": (f"The model {wanted} isn't downloaded yet, so nothing could answer. "
                        f"Download it and this will work - or run `ollama pull {wanted}` "
                        "yourself if you'd rather do it in a terminal."),
            "detail": text,
            "action": "pull",
            "model": wanted,
        }

    # Out of memory loading the model. Ollama puts both numbers in the message,
    # which are the useful part, so they are kept rather than summarised.
    if "more system memory" in lower or "out of memory" in lower or "cannot allocate" in lower:
        smaller = _smaller_tier(tier)
        advice = (f"Pick {_label(smaller)} instead - it needs less." if smaller
                  else "Close some other applications, or pick a smaller model.")
        return {
            "kind": "oom",
            "message": (f"This computer ran out of memory loading {model or 'the model'}. "
                        f"{advice} Ollama said: {text}"),
            "detail": text,
            "action": "models",
        }

    # Ollama is up but unhappy in some other way. Say that much rather than
    # dressing it up as something understood.
    if name == "ResponseError":
        return {
            "kind": "ollama_error",
            "message": (f"Ollama refused the request: {text}. "
                        "The model list in Settings - Models & brain shows what's available here."),
            "detail": text,
            "action": "models",
        }

    if isinstance(exc, httpx.TimeoutException) or "timed out" in lower:
        return {
            "kind": "timeout",
            "message": ("The model took too long to answer and the request timed out. "
                        "A smaller model or a lower effort setting will be quicker, "
                        "or try again - the first reply after a model loads is the slowest."),
            "detail": text,
            "action": "retry",
        }

    # Unrecognised. Pass it through unchanged rather than inventing a cause -
    # a wrong explanation is worse than a raw one.
    return {"kind": "unknown", "message": text, "detail": text, "action": "retry"}


def event(exc: Exception, model: str | None = None, tier: str | None = None) -> dict:
    """The same thing as a stream event the UI can render."""
    out = explain(exc, model, tier)
    out["type"] = "error"
    return out
