"""A shared secret between the UI and the brain.

The brain can run shell commands, read and write files and delete things.
Binding to 127.0.0.1 keeps it off the network, but it does not keep it away
from the browser: a page the user happens to be visiting can issue requests
to localhost, and ports are not part of a "site", so every other app on this
machine that serves a page is a same-site caller as far as a browser is
concerned.

So every request needs a token. It is generated once, kept in the data folder
at 0600 like the API key, and attached by the dev server rather than by the
page - the browser never holds it, which means a bug in the UI can't leak it
and no one ever has to type it.

**What this does not do.** Any process running as this user can read
data/auth_token, so this stops web pages and anything that cannot read your
files. It cannot stop a program running as you; a local server has no way to
out-privilege its own user. That limit is worth stating plainly rather than
implying a protection that isn't there.
"""

import os
import secrets

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOKEN_PATH = os.path.join(BASE_DIR, "data", "auth_token")
HEADER = "x-shadow-token"

# Endpoints that answer without a token. Only things that expose no state and
# change nothing: the UI needs one of these to tell "the brain isn't running"
# apart from "the brain is running and refused us".
PUBLIC_PATHS = {"/health"}

# A browser tells us where a request came from, and cannot be talked out of it
# by the page making it. Anything other than these two means another origin is
# driving us: "cross-site" is an outside page, and "same-site" is another app
# on this machine, because a different port is the same site.
SAFE_FETCH_SITES = {"same-origin", "none"}

_cached: str | None = None


def token() -> str:
    """The secret, creating it on first run."""
    global _cached
    if _cached:
        return _cached

    try:
        with open(TOKEN_PATH, "r", encoding="utf-8") as f:
            existing = f.read().strip()
        if existing:
            _cached = existing
            return _cached
    except (FileNotFoundError, OSError):
        pass

    _cached = secrets.token_urlsafe(32)
    os.makedirs(os.path.dirname(TOKEN_PATH), exist_ok=True)
    # Write through a private temp file, so the token is never briefly
    # world-readable between create and chmod.
    fd = os.open(TOKEN_PATH + ".tmp", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(_cached)
        os.replace(TOKEN_PATH + ".tmp", TOKEN_PATH)
    except OSError as e:
        print(f"[auth] couldn't save the token to {TOKEN_PATH}: {e}")
        raise
    print(f"[auth] wrote a new access token to {os.path.relpath(TOKEN_PATH, BASE_DIR)}")
    return _cached


def allowed_origins() -> set[str]:
    """The origins a browser may name. The UI talks to the brain through the
    dev server's own origin, so in normal use there is no cross-origin request
    at all and this stays empty of anything but what SHADOW_UI_ORIGIN adds."""
    extra = os.environ.get("SHADOW_UI_ORIGIN", "").strip()
    return {o.strip() for o in extra.split(",") if o.strip()}


def check(method: str, path: str, headers) -> tuple[int, str] | None:
    """None if the request may proceed, else (status, reason).

    Order matters. The origin checks come first because a *simple* cross-origin
    POST - form or text content type, no custom headers - is sent by the
    browser without a preflight, and CORS only hides the response from the
    page. The side effect would already have happened, so the token is not the
    only thing standing in the way of it.
    """
    if method == "OPTIONS":
        return None
    if path in PUBLIC_PATHS:
        return None

    site = (headers.get("sec-fetch-site") or "").lower()
    if site and site not in SAFE_FETCH_SITES:
        return (403, "Refused: this request came from another page or another app on this "
                     "computer. Only Shadow's own interface may use this API.")

    origin = headers.get("origin")
    if origin and origin not in allowed_origins():
        return (403, f"Refused: requests from {origin} aren't allowed. Only Shadow's own "
                     "interface may use this API.")

    sent = headers.get(HEADER) or ""
    if not sent:
        return (401, "This API needs Shadow's access token, and this request had none. "
                     "Shadow's own interface attaches it for you - if you're seeing this in "
                     "the app, restart the UI dev server so it picks the token up again.")
    if not secrets.compare_digest(sent, token()):
        return (401, "That access token doesn't match this brain's. The token is in "
                     "shadow-brain/data/auth_token; restart the UI dev server so it reads "
                     "the current one.")
    return None
