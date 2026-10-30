"""What Shadow knows about itself and the world right now.
A compact version goes into every prompt; the full version is a tool."""

import platform
import time
from datetime import datetime

from assistants import get_profile
from config import load_tier_config, EFFORT_STEPS, get_workspace
from settings import get_settings
from memory import long_term
from tools.state import offline, tool_state

NO_TOOLS = (
    "No file, shell or web tools are loaded for this message, so you can only talk this turn. "
    "If the user wants a file read, a command run or the web searched, say plainly that you "
    "can't do it in this reply, and ask them to say it as a direct instruction "
    "(like \"read notes.txt\") so the right tools load. Never pretend you did it."
)

_weather_cache = {"at": 0, "text": None}
WEATHER_TTL = 3600  # one hour


def _weather(location: str) -> str | None:
    """Fetched lazily and cached. Uses wttr.in, which needs no API key."""
    if not location or offline():
        return None
    if _weather_cache["text"] and time.time() - _weather_cache["at"] < WEATHER_TTL:
        return _weather_cache["text"]
    try:
        import urllib.parse
        import urllib.request
        url = f"https://wttr.in/{urllib.parse.quote(location)}?format=%C+%t"
        req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            text = resp.read().decode("utf-8").strip()
        if text and len(text) < 60:
            _weather_cache.update({"at": time.time(), "text": text})
            return text
    except Exception:
        pass
    return None


def compact(tier: str | None = None, effort: str | None = None,
            allowed: list[str] | None = None, ask: list[str] | None = None,
            profile: dict | None = None) -> str:
    """The short block that goes into every system prompt."""
    profile = profile or get_profile()
    cfg = load_tier_config(tier)
    now = datetime.now()

    lines = [
        f"You are {profile['name']}, running the {cfg['label']} model ({cfg['base_model']}) "
        f"locally on this computer via Ollama.",
        f"Right now: {now.strftime('%A, %d %B %Y, %H:%M')}.",
    ]

    # Location is per assistant, so it lives in the profile, not in global
    # settings. Empty means the user shared nothing: no line, and no weather
    # lookup, so nothing leaves the machine.
    location = (profile.get("location") or "").strip()
    if location:
        weather = _weather(location)
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
        "the web_search, fetch_url and http_request tools.",
    ]
    if profile.get("custom_instructions"):
        out += ["", f"The user's custom instructions: {profile['custom_instructions']}"]
    return "\n".join(out)
