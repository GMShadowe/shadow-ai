"""Global settings, saved to data/settings.json. Per-assistant things
(name, model, tools, personality) live in each assistant's profile."""

import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SETTINGS_PATH = os.path.join(BASE_DIR, "data", "settings.json")

DEFAULTS = {
    "workspace": os.environ.get("SHADOW_WORKSPACE", "~/shadow_workspace"),
    "router": os.environ.get("SHADOW_ROUTER", "laya"),
    # Offline mode blocks every outbound call: the web tools refuse, and the
    # weather lookup is skipped. Nothing at all leaves this computer.
    "offline": False,
    # The training log is the one file that keeps a copy of every turn, so it
    # can be turned off without turning off anything else.
    "log_turns": True,
    # False until first-run setup finishes. It describes the install, not an
    # assistant, which is why it is here and not in a profile.
    "onboarded": False,
}

CHOICES = {
    "router": ["laya", "keywords"],
}

BOOLEANS = ["offline", "log_turns", "onboarded"]


def get_settings() -> dict:
    settings = dict(DEFAULTS)
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            saved = json.load(f)
        settings.update({k: v for k, v in saved.items() if k in DEFAULTS})
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return settings


def update_settings(patch: dict) -> dict:
    current = get_settings()
    for key, value in patch.items():
        if key not in DEFAULTS:
            raise ValueError(f"Unknown setting '{key}'.")
        if key in CHOICES and value not in CHOICES[key]:
            raise ValueError(f"'{value}' isn't a valid choice for {key}.")
        if key in BOOLEANS:
            if not isinstance(value, bool):
                raise ValueError(f"{key} must be true or false.")
        if key == "workspace":
            value = _check_workspace(value)
        current[key] = value
    os.makedirs(os.path.dirname(SETTINGS_PATH), exist_ok=True)
    tmp = SETTINGS_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)
    os.replace(tmp, SETTINGS_PATH)
    return current


def _check_workspace(path) -> str:
    if not isinstance(path, str) or not path.strip():
        raise ValueError("The workspace folder can't be empty.")
    full = os.path.realpath(os.path.expanduser(path.strip()))
    home = os.path.realpath(os.path.expanduser("~"))
    if full == "/":
        raise ValueError("The workspace can't be your whole disk.")
    if full == home:
        raise ValueError("Pick a folder inside your home folder, not the home folder itself.")
    if not os.path.isdir(full):
        raise ValueError(f"That folder doesn't exist: {full}")
    return full
