"""What Shadow knows about itself and the world right now.
A compact version goes into every prompt; the full version is a tool."""

import platform
import re
import shutil
import threading
import time
from datetime import datetime

from assistants import get_profile
from config import load_tier_config, EFFORT_STEPS, get_workspace, max_steps
from settings import get_settings
from memory import long_term
from tools.state import WEB_TOOLS, offline, tool_state
from tools.shell import platform_note

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
WEATHER_WAIT = 3

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


def _weather_now(location: str) -> str | None:
    """For a message that asks about the weather: the cache is empty after a
    restart, and answering "no data" while the lookup lands a second later is
    worse than a short wait."""
    deadline = time.time() + WEATHER_WAIT
    weather = _weather(location)
    while weather is None and location in _weather_fetching and time.time() < deadline:
        time.sleep(0.05)
        weather = _weather(location)
    return weather


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
ASKS_WEATHER_RE = re.compile(r"\b(weather|forecast|temperature|rain(ing|y)?)\b", re.I)
PLACE_NAMED_RE = re.compile(
    r"\b(?:weather|forecast|temperature|rain(?:ing|y)?)\b.*?\b(?:in|at|for)\s+([a-z][a-z .'-]{1,40})", re.I)
WHEN_WORDS_RE = re.compile(r"\s*\b(today|tonight|tomorrow|now|right now|this week|this weekend|like)\b.*$", re.I)
NOT_A_PLACE = {"yes", "yeah", "yep", "no", "nope", "ok", "okay", "sure", "do", "do it", "go", "thanks",
               "thank you", "search", "please", "pls", "here", "there", "me", "my city", "home"}


def weather_place(message: str | None, previous: str | None = None) -> str | None:
    """A place the user named for the weather: "weather in Pune", or "pune" in
    answer to being asked which city. The profile's location was the only
    place ever looked up, so "ahmedabad" after "which city?" got nothing."""
    text = (message or "").strip().rstrip("?!. ")
    named = PLACE_NAMED_RE.search(text)
    if named:
        place = WHEN_WORDS_RE.sub("", named.group(1)).strip(" .'-")
        return place or None
    if previous and ASKS_WEATHER_RE.search(previous) and re.fullmatch(r"[a-z][a-z .'-]{1,30}", text, re.I):
        if len(text.split()) <= 3 and text.lower() not in NOT_A_PLACE:
            return text
    return None


NO_LOCATION = ("The user hasn't set a location, so you don't know their weather. Ask which city "
               "they're in, and say they can set it in Settings to get the weather straight away.")


PLACE_RE = re.compile(
    r"\b(where|city|town|country|near|nearby|local|locally|around here|location|visit|places?|"
    r"restaurants?|cafes?|shops?|travel|trip|time ?zone)\b", re.I)


def identity(tier: str | None = None, profile: dict | None = None) -> str:
    """The part of the awareness block that stays the same for a whole chat.
    It opens every prompt, so anything that changes from one message to the
    next belongs in turn_facts: Qwen 3.5 reads the whole conversation again
    when the start of the prompt changes."""
    profile = profile or get_profile()
    cfg = load_tier_config(tier)
    return "\n".join([
        f"You are {profile['name']}, running the {cfg['label']} model ({cfg['base_model']}) "
        f"locally on this computer via Ollama.",
        STALE_KNOWLEDGE,
        f"This machine runs {platform.system()} on {platform.machine()}. "
        f"Your workspace folder is {get_workspace()} — you can only read, write and run things inside it.",
        "You can't see the user's screen, hear them, or access anything outside the workspace and the web tools.",
    ])


ASK_HOW = ("Call them like any other tool: Shadow shows the user an approval card and waits for "
           "their answer. Never ask for permission in your reply instead of calling the tool.")
LOOKING_IS_FREE = ("Commands that only look, like ls, cat, wc, du, df, ps, uptime or lsof, run straight "
                   "away without approval.")
COMMON_TOOLS = ("python3", "node", "npm", "git", "pip3", "brew", "zip", "tree")
_installed: list[str] | None = None


def shell_facts() -> str:
    global _installed
    if _installed is None:
        _installed = [name for name in COMMON_TOOLS if shutil.which(name)]
    return platform_note() + " Installed here: " + (", ".join(_installed) or "none of the usual tools") + "."


def turn_facts(effort: str | None = None, allowed: list[str] | None = None,
               ask: list[str] | None = None, profile: dict | None = None,
               message: str | None = None, previous: str | None = None) -> str:
    """What is true for this message only: the time, the tools loaded for it,
    the location and weather when the message is about them."""
    profile = profile or get_profile()
    lines = [f"Right now: {datetime.now().strftime('%A, %d %B %Y, %H:%M')}."]

    # Location is per assistant, so it lives in the profile, not in global
    # settings. Empty means the user shared nothing: no line, and no weather
    # lookup, so nothing leaves the machine.
    location = (profile.get("location") or "").strip()
    asks_weather = message is not None and bool(ASKS_WEATHER_RE.search(message))
    place = weather_place(message, previous)
    if place and place.lower() != location.lower():
        weather = _weather_now(place)
        lines.append(f"Weather in {place}: {weather}." if weather else
                     "The weather lookup is blocked by offline mode." if offline() else
                     f"The weather lookup for {place} didn't answer, so say you couldn't get it right now.")
    elif location:
        # Fetched every turn so the cache is warm; the location and the weather
        # are shown only when the message is about them. In every prompt, the 4B
        # brought both into greetings and argued with a user who said it was cold.
        asks_weather = asks_weather or bool(place)
        weather = _weather_now(location) if asks_weather else _weather(location)
        about_weather = message is None or bool(WEATHER_RE.search(message))
        if about_weather or PLACE_RE.search(message):
            line = f"The user is in {location}."
            if weather and about_weather:
                line += f" Weather: {weather}."
            elif asks_weather:
                line += (" The weather lookup is blocked by offline mode." if offline()
                         else " The weather lookup didn't answer, so say you couldn't get it right now.")
            lines.append(line)
    elif asks_weather:
        lines.append(NO_LOCATION)

    if allowed is not None:
        on = [t for t in allowed if t not in (ask or [])]
        # Name the tools rather than counting them. A count told the model
        # nothing, so it went looking for tools it half-remembered from an
        # earlier turn — and about_me lists every tool enabled in settings,
        # which is a longer list than the one loaded for this message.
        if on:
            lines.append("Tools you can call right now: " + ", ".join(on) + ".")
        if ask:
            lines.append("Also callable now, but each use needs the user's approval: " + ", ".join(ask) + ". "
                         + ASK_HOW)
            if "run_command" in ask and not set(allowed) & set(WEB_TOOLS):
                lines.append(LOOKING_IS_FREE)
        if "run_command" in allowed:
            lines.append(shell_facts())
        # A plain-chat message gets no tools at all. Say so, or the model
        # either claims it ran something or argues with its own about_me.
        if not [t for t in on + list(ask or []) if t != "about_me"]:
            lines.append(NO_TOOLS)

    try:
        n = long_term.count(profile.get("id"))
        if n:
            lines.append(f"You remember {n} thing(s) about the user long-term; relevant ones are shown below when they apply.")
    except Exception as e:
        print(f"[memory] couldn't count memories: {e}")

    if effort:
        steps = max_steps(effort, shell="run_command" in (allowed or []))
        lines.append(f"Effort is set to {effort}: you can take up to {steps} tool steps this turn.")
    return "\n".join(lines)


def compact(tier: str | None = None, effort: str | None = None,
            allowed: list[str] | None = None, ask: list[str] | None = None,
            profile: dict | None = None, message: str | None = None) -> str:
    profile = profile or get_profile()
    return identity(tier, profile) + "\n" + turn_facts(effort, allowed, ask, profile, message)


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
