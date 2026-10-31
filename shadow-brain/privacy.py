"""What can leave this computer, and what is kept on it.

Shadow's promise is that everything is local, so the exceptions have to be
visible. This builds that list from the real tool states and the real files
on disk — nothing here is hardcoded optimism.
"""

import os

import custom
import feedback
import preview
import usage
from assistants import ASSISTANTS_DIR, STATE_PATH, active_id, chats_db_path, get_profile, images_dir, memory_db_path
from settings import SETTINGS_PATH, get_settings
from tools.state import offline, tool_state


def _size(path: str) -> int:
    try:
        return os.path.getsize(path)
    except OSError:
        return 0


def _dir_size(path: str) -> tuple[int, int]:
    """Returns (total bytes, file count). Missing folder counts as empty."""
    total = count = 0
    for root, _dirs, files in os.walk(path):
        for name in files:
            total += _size(os.path.join(root, name))
            count += 1
    return total, count


def _lines(path: str) -> int:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return sum(1 for line in f if line.strip())
    except OSError:
        return 0


def outbound(log_path: str) -> list[dict]:
    """Every call that can reach the internet, and whether it can happen now."""
    profile = get_profile()
    off = offline()
    location = (profile.get("location") or "").strip()

    def tool_row(name: str, host: str, what: str) -> dict:
        state = tool_state(name, profile)
        if off:
            active, reason = False, "Offline mode is on"
        elif state == "off":
            active, reason = False, "Turned off in Tools"
        elif state == "ask":
            active, reason = True, "Asks you first, every time"
        else:
            active, reason = True, "On"
        return {"id": name, "label": name, "host": host, "what": what,
                "active": active, "reason": reason, "state": state}

    rows = [
        tool_row("web_search", "duckduckgo.com", "Sends your search words to DuckDuckGo."),
        tool_row("fetch_url", "the page you ask for", "Requests one page and reads its text."),
        tool_row("http_request", "the address it is given", "Can send data, so it asks before running."),
        tool_row("show_images", "duckduckgo.com, then the image hosts",
                 "Sends your picture search to DuckDuckGo; the brain fetches the thumbnails, not your browser."),
    ]

    if off:
        weather_active, weather_reason = False, "Offline mode is on"
    elif not location:
        weather_active, weather_reason = False, "No location set"
    else:
        weather_active, weather_reason = True, f"Sends only '{location}', once an hour"
    import stt
    if not stt.available():
        stt_active, stt_reason = False, "Speech to text isn't installed"
    elif stt.model_cached():
        stt_active, stt_reason = False, "Already downloaded — never fetched again"
    elif off:
        stt_active, stt_reason = False, "Offline mode is on"
    else:
        stt_active, stt_reason = True, f"One download of the {stt.status()['model']} model, then never again"
    rows.append({
        "id": "speech_model", "label": "speech model", "host": "huggingface.co",
        "what": "Downloads the whisper weights the first time you use voice mode.",
        "active": stt_active, "reason": stt_reason, "state": None,
    })

    # Downloading a model. Ollama itself is local, but a pull fetches the
    # weights from Ollama's registry, so it belongs on this list. Nothing is
    # downloaded unless the user asks for it in setup or Settings.
    rows.append({
        "id": "model_pull", "label": "model download", "host": "registry.ollama.ai",
        "what": "Downloads a model's weights when you ask for one. Sends no conversation.",
        "active": not off,
        "reason": "Offline mode is on" if off else "Only when you start a download",
        "state": None,
    })

    rows.append({
        "id": "skill_download", "label": "skill downloads", "host": "the link you paste",
        "what": "Downloads one skill file when you add a skill from a link. Sends no conversation.",
        "active": not off,
        "reason": "Offline mode is on" if off else "Only when you add a skill from a link",
        "state": None,
    })

    rows.append({
        "id": "weather", "label": "weather", "host": "wttr.in",
        "what": "Looks up the weather for the location in your profile.",
        "active": weather_active, "reason": weather_reason, "state": None,
    })

    # Link previews: a reply with links in it asks those sites for their
    # title, description and image. It happens here rather than in the
    # browser so the sites never see the user's own address.
    counts = preview.summary()
    if off:
        preview_active, preview_reason = False, "Offline mode is on"
    else:
        preview_active = True
        preview_reason = (f"When a reply has links in it ({counts['fetched']} fetched so far, "
                          f"{counts['cached']} cached)")
    rows.append({
        "id": "link_preview", "label": "link previews", "host": "the sites you link to",
        "what": ("Asks each linked page for its title, description and image, and fetches that image "
                 "through Shadow so the site never sees your address."),
        "active": preview_active, "reason": preview_reason, "state": None,
    })

    # A BYOK model is the biggest exception there is: not a search term or a
    # location, but the conversation itself - files that were read, tool
    # results, images. Every configured endpoint is listed whether or not it
    # is the one in use, because any of them can be picked per message.
    import custom
    selected = profile.get("model")
    for endpoint in custom.byok_endpoints():
        in_use = endpoint["id"] == selected
        if off:
            active, reason = False, "Offline mode is on"
        elif in_use:
            active, reason = True, "Selected as this assistant's model"
        else:
            active, reason = True, "Configured; whenever you pick it for a message"
        rows.append({
            "id": endpoint["id"],
            "label": f"{endpoint['label']} (your own endpoint)",
            "host": endpoint["host"],
            "what": (f"Sends your whole conversation to this endpoint as {endpoint['model']} - "
                     "messages, files Shadow read, tool results and any images. "
                     "Shadow counts the tokens it reports back and keeps that count here."),
            "active": active, "reason": reason, "state": None,
        })
    return rows


def _custom_detail() -> str:
    """Says an API key is stored without ever showing it."""
    try:
        models = custom.public()
    except custom.CustomError:
        return "The file is there but can't be read."
    if not models:
        return "No models of your own yet."
    local = sum(1 for m in models if m["kind"] == "byom")
    remote = [m for m in models if m["kind"] == "byok"]
    bits = []
    if local:
        bits.append(f"{local} of your own Ollama models")
    if remote:
        bits.append(f"{len(remote)} endpoint(s) with an API key stored here, readable only by you")
    return ". ".join(bits) + "."


def _usage_detail() -> str:
    """What the token counts amount to. Tokens only - Shadow never guesses at
    a price, because rates differ per provider and a wrong number is worse
    than none."""
    counts = usage.all_summaries()
    if not counts:
        return "Nothing counted yet; this appears once you use an endpoint of your own."
    live = {mid: c for mid, c in counts.items() if c["total"] or c["calls"]}
    if not live:
        return "Nothing counted yet."
    total = sum(c["total"] for c in live.values())
    partial = any(c["partial"] for c in live.values())
    note = " Some calls reported no usage, so the real figure is higher." if partial else ""
    return (f"{total:,} tokens across {len(live)} endpoint(s). Counts only, never prices, "
            f"and nothing leaves this computer.{note}")


def _feedback_detail() -> str:
    counts = feedback.stats()
    if counts.get("unreadable"):
        return "The file is there but can't be read."
    if not counts["total"]:
        return "No replies rated yet."
    return (f"{counts['up']} liked, {counts['down']} disliked, "
            f"{counts['with_reason']} with a reason. Kept for tuning.")


def storage(log_path: str) -> list[dict]:
    """The files Shadow keeps, with their real sizes."""
    from memory import long_term

    from tools import files

    images_bytes, images_count = _dir_size(images_dir())
    backups_bytes, backups_count = _dir_size(files.BACKUP_DIR)
    import skills
    skills_bytes, _ = _dir_size(skills.ADDED_DIR)
    aid = active_id()
    rows = [
        {"id": "chats", "label": "Chats", "path": chats_db_path(),
         "bytes": _size(chats_db_path()), "detail": "Every conversation you've kept."},
        {"id": "memory", "label": "Long-term memory", "path": memory_db_path(),
         "bytes": _size(memory_db_path()),
         "detail": f"{long_term.count()} remembered fact(s), stored as embeddings."},
        {"id": "images", "label": "Images you sent", "path": images_dir(),
         "bytes": images_bytes, "detail": f"{images_count} file(s)."},
        {"id": "log", "label": "Training log", "path": log_path,
         "bytes": _size(log_path), "detail": f"{_lines(log_path)} turn(s), kept for tuning the router."},
        {"id": "custom_models", "label": "Your own models", "path": custom.PATH,
         "bytes": _size(custom.PATH), "detail": _custom_detail()},
        {"id": "byok_usage", "label": "Token counts for your endpoints", "path": usage.PATH,
         "bytes": usage.file_size(), "detail": _usage_detail()},
        {"id": "feedback", "label": "Ratings you gave", "path": feedback.PATH,
         "bytes": _size(feedback.PATH), "detail": _feedback_detail()},
        {"id": "profile", "label": "This assistant's profile", "path": os.path.join(ASSISTANTS_DIR, aid, "profile.json"),
         "bytes": _size(os.path.join(ASSISTANTS_DIR, aid, "profile.json")),
         "detail": "Name, model, tone, tools, location."},
        {"id": "backups", "label": "Backups of changed files", "path": files.BACKUP_DIR,
         "bytes": backups_bytes,
         "detail": f"{backups_count} earlier version(s) of workspace files Shadow overwrote or edited. "
                   f"The newest {files.MAX_BACKUPS} are kept."},
        {"id": "skills", "label": "Skills you added", "path": skills.ADDED_DIR,
         "bytes": skills_bytes,
         "detail": f"{sum(1 for s in skills.list_skills() if s['added'])} skill(s), each a markdown file. "
                   "Read only when you invoke one with a slash command."},
        {"id": "settings", "label": "Global settings", "path": SETTINGS_PATH,
         "bytes": _size(SETTINGS_PATH), "detail": "Workspace folder, router, privacy switches."},
    ]
    return rows


def report(log_path: str) -> dict:
    settings = get_settings()
    data_dir = os.path.dirname(STATE_PATH)
    total, files = _dir_size(data_dir)
    return {
        "offline": bool(settings.get("offline")),
        "log_turns": bool(settings.get("log_turns", True)),
        "location": (get_profile().get("location") or "").strip(),
        "outbound": outbound(log_path),
        "storage": storage(log_path),
        "data_dir": data_dir,
        "data_dir_bytes": total,
        "data_dir_files": files,
    }
