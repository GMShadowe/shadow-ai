"""Tool on/ask/off state, read from the active assistant's profile."""

from assistants import get_profile
from settings import get_settings

TOOL_STATES = ["on", "ask", "off"]
# The only tools that send anything off this computer.
WEB_TOOLS = ["web_search", "fetch_url", "http_request"]
# Tools that start as Ask for any assistant whose profile doesn't say
# otherwise. run_command is here because a shell can do anything the other
# tools can and more; it used to be added per assistant instead, so any
# profile without the entry - an old one, a hand-written one - had it on.
# open_app launches programs, so it asks too.
DANGEROUS_DEFAULT_ASK = {"delete_file", "delete_dir", "http_request", "kill_process", "run_command",
                         "open_app"}


def default_state(name: str) -> str:
    """What a tool is set to when an assistant's profile doesn't say. Served
    to the UI with the tool list, so the wizard can't drift from this."""
    return "ask" if name in DANGEROUS_DEFAULT_ASK else "on"


def tool_state(name: str, profile: dict | None = None) -> str:
    profile = profile if profile is not None else get_profile()
    default = default_state(name)
    state = profile.get("tools", {}).get(name, default)
    return state if state in TOOL_STATES else default


def offline() -> bool:
    """Offline mode: no tool and no lookup may leave this computer."""
    return bool(get_settings().get("offline"))
