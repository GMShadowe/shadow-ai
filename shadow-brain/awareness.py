"""What Shadow knows about itself and the world right now.
A compact version goes into every prompt; the full version is a tool."""

import platform
import re
import threading
import time
from datetime import datetime

from assistants import get_profile
from config import load_tier_config, EFFORT_STEPS, get_workspace
from settings import get_settings
from memory import long_term
from tools.state import offline, tool_state

STALE_KNOWLEDGE = (
    "What you know comes from training that ended long before today, so it is out of date. "
    "For news, prices, scores, releases or anything else that changes, use web_search if you have it. "
    "If you don't, say you can't check that right now and that asking you to search online will. "
    "Never give recent figures from memory as if they were current."
)

NO_TOOLS = (
    "No file, shell or web tools are loaded for this message, so you can only talk this turn. "
    "If the user wants a file read, a command run or the web searched, say plainly that you "
    "can't do it in this reply, and ask them to say it as a direct instruction "
    "(like \"read notes.txt\") so the right tools load. Never pretend you did it."
)

WEATHER_TTL = 3600
WEATHER_RETRY = 300

_weather_cache: dict[str, dict] = {}
_weather_lock = threading.Lock()
_weather_fetching: set[str] = set()


def _weather(location: str) -> str | None:
    """Never waits on the network: returns what is cached and refreshes it in
    the background, so a slow wttr.in can't hold up a reply."""
    if not location or offline():
        return None
    with _weather_lock:
        entry = _weather_cache.get(location)
        ttl = WEATHER_TTL if entry and entry["text"] else WEATHER_RETRY
        stale = entry is None or time.time() - entry["at"] >= ttl
        if stale and location not in _weather_fetching:
            _weather_fetching.add(location)
            threading.Thread(target=_fetch_weather, args=(location,), daemon=True).start()
    return entry["text"] if entry else None


def _fetch_weather(location: str) -> None:
    text = None
    try:
        import urllib.parse
        import urllib.request
        url = f"https://wttr.in/{urllib.parse.quote(location)}?format=%C+%t"
        req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read(200).decode("utf-8").strip()
        if body and len(body) < 60:
            text = body
        else:
            print(f"[weather] unexpected answer for {location!r}, trying again in {WEATHER_RETRY}s")
    except Exception as e:
        print(f"[weather] lookup for {location!r} failed, trying again in {WEATHER_RETRY}s: {e}")
    with _weather_lock:
        _weather_cache[location] = {"at": time.time(), "text": text}
        _weather_fetching.discard(location)


WEATHER_RE = re.compile(
    r"\b(weather|temperature|forecast|rain\w*|sunny|hot|cold|humid\w*|wind\w*|snow\w*|degrees?|"
    r"umbrella|jacket|outside|outdoors?|walk|run|commute)\b", re.I)


def compact(tier: str | None = None, effort: str | None = None,
            allowed: list[str] | None = None, ask: list[str] | None = None,
            profile: dict | None = None, message: str | None = None) -> str:
    """The short block that goes into every system prompt."""
    profile = profile or get_profile()
    cfg = load_tier_config(tier)
    now = datetime.now()

    lines = [
        f"You are {profile['name']}, running the {cfg['label']} model ({cfg['base_model']}) "
        f"locally on this computer via Ollama.",
        f"Right now: {now.strftime('%A, %d %B %Y, %H:%M')}. {STALE_KNOWLEDGE}",
    ]

    # Location is per assistant, so it lives in the profile, not in global
    # settings. Empty means the user shared nothing: no line, and no weather
    # lookup, so nothing leaves the machine.
    location = (profile.get("location") or "").strip()
    if location:
        # Fetched every turn so the cache is warm, shown only when the message is
        # about it: in every prompt, the 4B brought it into greetings and argued
        # with a user who said it was cold.
        weather = _weather(location)
        if message is not None and not WEATHER_RE.search(message):
            weather = None
        lines.append(f"The user is in {location}." + (f" Weather: {weather}." if weather else ""))

    lines.append(
        f"This machine runs {platform.system()} on {platform.machine()}. "
        f"Your workspace folder is {get_workspace()} — you can only read, write and run things inside it."
    )

    if allowed is not None:
        on = [t for t in allowed if t not in (ask or [])]
        # Name the tools rather than counting them. A count told the model
        # nothing, so it went looking for tools it half-remembered from an
        # earlier turn — and about_me lists every tool enabled in settings,
        # which is a longer list than the one loaded for this message.
        if on:
            lines.append("Tools you can call right now: " + ", ".join(on) + ".")
        if ask:
            lines.append("Also callable now, but each use needs the user's approval: " + ", ".join(ask) + ".")
        # A plain-chat message gets no tools at all. Say so, or the model
        # either claims it ran something or argues with its own about_me.
        if not [t for t in on + list(ask or []) if t != "about_me"]:
            lines.append(NO_TOOLS)

    try:
        n = long_term.count()
        if n:
            lines.append(f"You remember {n} thing(s) about the user long-term; relevant ones are shown below when they apply.")
    except Exception:
        pass

    if effort:
        lines.append(f"Effort is set to {effort}: you can take up to {EFFORT_STEPS.get(effort, 6)} tool steps this turn.")

    lines.append("You can't see the user's screen, hear them, or access anything outside the workspace and the web tools.")
    return "\n".join(lines)


def detailed() -> str:
    """The full self-description, returned by the about_me tool."""
    from tools.registry import TOOLS
    profile = get_profile()
    settings = get_settings()
    cfg = load_tier_config()

    tools_by_state = {"on": [], "ask": [], "off": []}
    for name in sorted(TOOLS):
        tools_by_state[tool_state(name, profile)].append(name)

    out = [
        f"Name: {profile['name']}",
        f"Model: {cfg['label']} ({cfg['base_model']}), vision {'yes' if cfg.get('vision') else 'no'}",
        f"Default effort: {profile['effort']}",
        f"Tone: {profile['tone']}, answer length: {profile['response_length']}",
        f"Router: {settings['router']}",
        f"Workspace: {get_workspace()}",
        f"Location: {(profile.get('location') or '').strip() or 'not set'}",
        f"Long-term memories stored: {long_term.count()}",
        "",
        # This is the settings-level list, not the list for this message: a
        # router picks a subset per message. Saying so matters, because the
        # model used to read this as "I have read_file", find no read_file in
        # its tool list, and tell the user its own tools don't exist.
        "Which of these you can actually call depends on the message: a router loads a",
        "small set each turn, and that set is named at the top of your instructions.",
        "The list below is what the user has enabled in Settings overall.",
        "",
        f"Enabled: {', '.join(tools_by_state['on']) or 'none'}",
        f"Enabled but each use needs approval: {', '.join(tools_by_state['ask']) or 'none'}",
        f"Turned off in Settings: {', '.join(tools_by_state['off']) or 'none'}",
        "",
        # The names of the installed skills are deliberately withheld: a model
        # that can see the list starts offering skills the user didn't ask
        # for, or inventing ones that don't exist. All it gets is the honest
        # shape of the feature, so "what skills do you have?" has a true
        # answer instead of a guessed one.
        "Skills: the user can invoke a skill - a document of instructions for doing one task "
        "well - by typing a slash command in the composer. You are not told which skills are "
        "installed and you cannot list them or invoke one yourself. If asked what skills you "
        "have, say plainly that you can't see them and that typing / in the composer shows "
        "the list. When a skill is invoked, its instructions appear in your instructions for "
        "that message only.",
        "",
        "Limits: everything runs locally on this computer. You cannot see the screen, "
        "hear audio, or touch files outside the workspace. Web access is only through "
        "the web_search, fetch_url, http_request and show_images tools.",
    ]
    if profile.get("custom_instructions"):
        out += ["", f"The user's custom instructions: {profile['custom_instructions']}"]
    return "\n".join(out)
