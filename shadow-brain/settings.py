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
    # The training log keeps a copy of every turn that deleting a chat doesn't
    # remove, so it is something to opt into, not out of.
    "log_turns": False,
    # False until first-run setup finishes. It describes the install, not an
    # assistant, which is why it is here and not in a profile.
    "onboarded": False,
    # None until someone chooses: Cool mode then follows the machine
    # (cool.default), on at 16 GB and under without a strong graphics card.
    "cool_mode": None,
}

CHOICES = {
    "router": ["laya", "keywords"],
}

BOOLEANS = ["offline", "log_turns", "onboarded"]

PROTECTED_HOME_FOLDERS = {"Library", "AppData"}


class SettingsError(Exception):
    pass


def secure_data_dir() -> None:
    data = os.path.dirname(SETTINGS_PATH)
    os.makedirs(data, mode=0o700, exist_ok=True)
    if os.name != "nt" and os.stat(data).st_mode & 0o077:
        os.chmod(data, 0o700)
        print(f"[privacy] {data} was readable by other accounts; it is now yours alone (0700)")


def get_settings() -> dict:
    settings = dict(DEFAULTS)
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            saved = json.load(f)
    except FileNotFoundError:
        return settings
    except (json.JSONDecodeError, UnicodeDecodeError, OSError) as e:
        raise SettingsError(
            f"Shadow's settings file is damaged ({SETTINGS_PATH}: {e}), so nothing will run until "
            "it is fixed - whether offline mode is on can't be known. Fix the file, or move it "
            "aside to go back to the default settings."
        ) from e
    if not isinstance(saved, dict):
        raise SettingsError(
            f"Shadow's settings file isn't in the expected shape ({SETTINGS_PATH}). Fix it, or move "
            "it aside to go back to the default settings."
        )
    settings.update({k: v for k, v in saved.items() if k in DEFAULTS})
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
        if key == "cool_mode" and value is not None and not isinstance(value, bool):
            raise ValueError("cool_mode must be true, false or null (follow this computer).")
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
    if os.path.commonpath([full, home]) != home:
        raise ValueError(f"Pick a folder inside your home folder. {full} is outside it.")
    parts = os.path.relpath(full, home).split(os.sep)
    hidden = next((p for p in parts if p.startswith(".")), None)
    if hidden:
        raise ValueError(f"{hidden} is a hidden settings folder, and Shadow's tools could change what's in it. Pick an ordinary folder.")
    if parts[0] in PROTECTED_HOME_FOLDERS:
        raise ValueError(f"~/{parts[0]} holds app data, mail and keychains. Pick an ordinary folder.")
    if not os.path.isdir(full):
        raise ValueError(f"That folder doesn't exist: {full}")
    return full
