"""Assistant layer. Each assistant is a folder under data/assistants/
holding its own profile, chats, memory and images.

Three at most. The cap is a product decision, not a technical one: the
assistants share downloaded models, so a fourth costs almost nothing on
disk, but a dashboard of cards stops reading as a choice past three.
"""

import json
import os
import re
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSISTANTS_DIR = os.path.join(BASE_DIR, "data", "assistants")
STATE_PATH = os.path.join(BASE_DIR, "data", "active_assistant.txt")
MAX_ASSISTANTS = 3
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,31}$")

# Per-assistant profile fields and their defaults.
PROFILE_DEFAULTS = {
    "name": "Shadow",
    "model": "default",
    "effort": "medium",
    "tone": "friendly",
    "response_length": "balanced",
    "custom_instructions": "",
    "auto_memory": False,
    "location": "",
    "tools": {},  # tool name -> "on" / "ask" / "off"
}

# A new assistant starts with the one tool that can do real damage set to
# Ask, rather than inheriting whatever the global default happens to be.
NEW_ASSISTANT_TOOLS = {"run_command": "ask"}


class AssistantError(Exception):
    """Something the user should be told in plain words."""


def _assistant_dir(aid: str) -> str:
    path = os.path.join(ASSISTANTS_DIR, aid)
    os.makedirs(os.path.join(path, "images"), exist_ok=True)
    return path


def active_id() -> str:
    """The assistant currently in use. Creates 'default' on first run."""
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            aid = f.read().strip()
        if aid and os.path.isdir(os.path.join(ASSISTANTS_DIR, aid)):
            return aid
    except FileNotFoundError:
        pass
    # The pointer is missing or points at a folder that is gone. Adopt an
    # existing assistant before inventing one, or deleting the active
    # assistant would silently resurrect "Shadow" alongside the real ones.
    existing = list_ids()
    if existing:
        set_active(existing[0])
        return existing[0]
    # The very first assistant gets the same cautious default as any other:
    # run_command is not in tools.state's dangerous set, so without this it
    # would start as "on" for the one assistant nobody chose the settings for.
    ensure("default", {"name": "Shadow", "tools": dict(NEW_ASSISTANT_TOOLS)})
    set_active("default")
    return "default"


def set_active(aid: str) -> None:
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        f.write(aid)


def list_ids() -> list[str]:
    if not os.path.isdir(ASSISTANTS_DIR):
        return []
    return sorted(d for d in os.listdir(ASSISTANTS_DIR)
                  if os.path.isdir(os.path.join(ASSISTANTS_DIR, d)))


def slugify(name: str) -> str:
    """A folder id from a display name.

    Names are free text ("Nova 2.0", "Ayaan's helper", "☆"), ids are not:
    ID_RE allows lowercase letters, numbers and dashes only. Anything that
    survives nothing becomes 'assistant', and a clash gets a number, so
    two assistants called the same thing both get a home.
    """
    base = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")[:32].strip("-")
    if not base or not base[0].isalnum():
        base = f"a{base}" if base else "assistant"
    taken = set(list_ids())
    if base not in taken:
        return base
    for n in range(2, 100):
        candidate = f"{base[:29]}-{n}"
        if candidate not in taken:
            return candidate
    raise AssistantError("Couldn't find a free name for that assistant. Try a different one.")


def ensure(aid: str, profile: dict | None = None) -> None:
    """Create an assistant folder and profile if it doesn't exist."""
    if not ID_RE.match(aid):
        raise ValueError("Assistant id must be lowercase letters, numbers and dashes.")
    path = _assistant_dir(aid)
    profile_path = os.path.join(path, "profile.json")
    if not os.path.exists(profile_path):
        data = {**PROFILE_DEFAULTS, **(profile or {})}
        with open(profile_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)


def create(name: str, profile: dict | None = None) -> dict:
    """Make a new assistant and return its profile. Does not activate it."""
    name = (name or "").strip()
    if not name:
        raise AssistantError("Give the assistant a name.")
    if len(name) > 40:
        raise AssistantError("That name is too long. Keep it under 40 characters.")
    if len(list_ids()) >= MAX_ASSISTANTS:
        raise AssistantError(
            f"You already have {MAX_ASSISTANTS} assistants, which is the most Shadow keeps. "
            "Delete one first, or edit an existing one instead."
        )
    fields = {k: v for k, v in (profile or {}).items() if k in PROFILE_DEFAULTS}
    fields["name"] = name
    # Merge rather than replace: a wizard that set some tool states shouldn't
    # lose the Ask default on run_command, and shouldn't be overridden either.
    fields["tools"] = {**NEW_ASSISTANT_TOOLS, **(fields.get("tools") or {})}

    aid = slugify(name)
    ensure(aid, fields)
    # ensure() only writes a profile when there isn't one, so normalize the
    # model through the same path every other write uses.
    return update_profile(fields, aid)


def delete(aid: str) -> dict:
    """Remove an assistant and everything it owns: chats, memory, images.

    Returns what was removed, so the caller can report it. Refuses the last
    one - an install with no assistant has no working chat screen.
    """
    existing = list_ids()
    if aid not in existing:
        raise AssistantError("That assistant doesn't exist any more.")
    if len(existing) <= 1:
        raise AssistantError(
            "This is your only assistant, so it can't be deleted. "
            "Make another one first, or just rename this one."
        )
    removed = {"id": aid, "name": get_profile(aid)["name"], **counts(aid)}
    shutil.rmtree(os.path.join(ASSISTANTS_DIR, aid))
    # If the active assistant just went away, move the pointer before anyone
    # asks for it, rather than letting active_id() discover the gap.
    if read_active() == aid:
        remaining = list_ids()
        if remaining:
            set_active(remaining[0])
    return removed


def read_active() -> str | None:
    """The stored pointer, without creating anything. active_id() is the one
    that heals a missing or stale value; this one just reports it."""
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return f.read().strip() or None
    except (FileNotFoundError, OSError):
        return None


def counts(aid: str) -> dict:
    """How many chats and memories an assistant owns.

    Read straight from its SQLite files rather than through storage.py,
    because those modules always answer for the *active* assistant and the
    dashboard needs numbers for all of them. A file that doesn't exist yet
    means an assistant that has never been chatted to, which is zero, not
    an error.
    """
    import sqlite3

    out = {"chats": 0, "memories": 0}
    for key, filename, table in (("chats", "chats.db", "conversations"),
                                 ("memories", "memory.db", "memories")):
        path = os.path.join(ASSISTANTS_DIR, aid, filename)
        if not os.path.isfile(path):
            continue
        try:
            conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
            try:
                out[key] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            finally:
                conn.close()
        except sqlite3.Error as e:
            # Never silently swallow it: a wrong count on a delete
            # confirmation is worse than an obvious one.
            print(f"[assistants] couldn't count {key} for {aid}: {e}")
    return out


def summaries() -> list[dict]:
    """Every assistant, for the dashboard.

    The *whole* profile, not a summary of it, because the dashboard edits
    assistants that aren't active. Sending only name and model would make an
    edit form start from the defaults and quietly wipe the tone and
    instructions of whichever assistant was opened.
    """
    active = active_id()
    out = []
    for aid in list_ids():
        out.append({
            **get_profile(aid),
            "active": aid == active,
            **counts(aid),
        })
    return out


def migrate_tiers() -> list[str]:
    """Move saved profiles off tier ids that no longer exist.

    The 2B tier ("potato") was dropped, and medium/good were renamed to
    default/plus. Reading a stale id still works - config.normalize_tier
    maps it - but the file is rewritten once so the stored value matches
    what the UI shows. Returns the assistants it changed.
    """
    from config import TIER_ORDER, normalize_tier

    changed = []
    for aid in list_ids():
        path = os.path.join(ASSISTANTS_DIR, aid, "profile.json")
        try:
            with open(path, "r", encoding="utf-8") as f:
                saved = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            continue
        old = saved.get("model")
        if old in TIER_ORDER:
            continue
        new = normalize_tier(old) or TIER_ORDER[0]
        saved["model"] = new
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(saved, f, indent=2)
        except OSError as e:
            print(f"[assistants] couldn't migrate {aid}'s tier: {e}")
            continue
        print(f"[assistants] {aid}: model tier '{old}' is gone, now '{new}'")
        changed.append(aid)
    return changed


def raw_model(aid: str) -> str | None:
    """The model id exactly as stored, before it is normalized. Needed when
    a custom model is deleted: get_profile already falls back to the floor,
    so the dead id would otherwise sit in the file unnoticed."""
    try:
        with open(os.path.join(ASSISTANTS_DIR, aid, "profile.json"), "r", encoding="utf-8") as f:
            return json.load(f).get("model")
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None


def get_profile(aid: str | None = None) -> dict:
    aid = aid or active_id()
    profile = dict(PROFILE_DEFAULTS)
    try:
        with open(os.path.join(ASSISTANTS_DIR, aid, "profile.json"), "r", encoding="utf-8") as f:
            saved = json.load(f)
        profile.update({k: v for k, v in saved.items() if k in PROFILE_DEFAULTS})
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    # An old tier id resolves to its replacement even before migrate_tiers
    # has rewritten the file, so nothing ever reads a tier that is gone.
    from config import TIER_ORDER, normalize_tier
    profile["model"] = normalize_tier(profile.get("model")) or TIER_ORDER[0]
    profile["id"] = aid
    return profile


def update_profile(patch: dict, aid: str | None = None) -> dict:
    aid = aid or active_id()
    ensure(aid)
    from config import TIER_ORDER, normalize_tier

    current = get_profile(aid)
    current.update({k: v for k, v in patch.items() if k in PROFILE_DEFAULTS})
    current.pop("id", None)
    # Normalize on the way in as well as on the way out, so an old tier id
    # sent by an older UI isn't written back into the file.
    current["model"] = normalize_tier(current.get("model")) or TIER_ORDER[0]
    with open(os.path.join(ASSISTANTS_DIR, aid, "profile.json"), "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)
    current["id"] = aid
    return current


def set_tool_state(name: str, state: str, aid: str | None = None) -> dict:
    """Change one tool's on/ask/off state for one assistant, keeping the rest.

    Tool state is per assistant, so this goes into the profile - never into
    global settings, which have no "tools" key and refused the write, so
    "Always allow" on a permission prompt used to fail the whole turn.
    """
    aid = aid or active_id()
    tools = dict(get_profile(aid).get("tools") or {})
    tools[name] = state
    return update_profile({"tools": tools}, aid)


# Paths into the active assistant's folder.
def chats_db_path(aid: str | None = None) -> str:
    return os.path.join(_assistant_dir(aid or active_id()), "chats.db")


def memory_db_path(aid: str | None = None) -> str:
    return os.path.join(_assistant_dir(aid or active_id()), "memory.db")


def images_dir(aid: str | None = None) -> str:
    return os.path.join(_assistant_dir(aid or active_id()), "images")
