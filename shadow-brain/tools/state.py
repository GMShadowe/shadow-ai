"""Tool on/ask/off state, read from the active assistant's profile."""

from assistants import get_profile
from settings import get_settings

TOOL_STATES = ["on", "ask", "off"]
# The only tools that send anything off this computer.
WEB_TOOLS = ["web_search", "fetch_url", "http_request", "show_images"]
# A profile without an entry for these asks.
DANGEROUS_DEFAULT_ASK = {"delete_file", "delete_dir", "http_request", "kill_process", "run_command",
                         "open_app"}


def default_state(name: str) -> str:
    return "ask" if name in DANGEROUS_DEFAULT_ASK else "on"


def tool_state(name: str, profile: dict | None = None) -> str:
    profile = profile if profile is not None else get_profile()
    default = default_state(name)
    state = profile.get("tools", {}).get(name, default)
    return state if state in TOOL_STATES else default


def offline() -> bool:
    """Offline mode: no tool and no lookup may leave this computer."""
    return bool(get_settings().get("offline"))
