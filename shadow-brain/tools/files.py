"""File tools. Everything is locked inside WORKSPACE so the model
can't touch the rest of your computer."""

import fnmatch
import os
import shutil
import time
import uuid
from config import get_workspace

SKIP_DIRS = {".git", ".venv", "venv", "node_modules", "__pycache__"}

# write_file with empty content is a delete, so the old version is copied here first.
BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "backups")
MAX_BACKUPS = 100
MAX_BACKUP_BYTES = 20 * 1024 * 1024


DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


class PathRefused(ValueError):
    pass


def _inside(full: str, folder: str) -> bool:
    folder = os.path.realpath(folder)
    return full == folder or full.startswith(folder + os.sep)


def _safe_path(path: str) -> str:
    root = get_workspace()
    full = os.path.realpath(os.path.join(root, path))
    if full != root and not full.startswith(root + os.sep):
        raise PathRefused(f"Path escapes the workspace: {path}")
    # Holds the API key and access token; refused even inside the workspace.
    if _inside(full, DATA_DIR):
        raise PathRefused(f"{path} is inside Shadow's own data folder, which the file tools never touch.")
    return full


def _walk(start: str):
    for dirpath, dirnames, filenames in os.walk(start):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in filenames:
            yield os.path.join(dirpath, name)


def _backup(full: str) -> str:
    rel = os.path.relpath(full, get_workspace())
    try:
        size = os.path.getsize(full)
        if size > MAX_BACKUP_BYTES:
            return f" No backup of the old version was kept: it is over {MAX_BACKUP_BYTES // (1024 * 1024)}MB."
        os.makedirs(BACKUP_DIR, mode=0o700, exist_ok=True)
        flat = rel.replace(os.sep, "__")[-120:]
        name = f"{time.strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}-{flat}"
        dest = os.path.join(BACKUP_DIR, name)
        shutil.copyfile(full, dest)
        os.chmod(dest, 0o600)
        _prune_backups()
    except OSError as e:
        print(f"[files] couldn't back up {rel}: {e}")
        return f" Warning: the old version could not be backed up ({e})."
    return f" The previous version was kept in Shadow's backups as {name}."


def _prune_backups() -> None:
    names = sorted(os.listdir(BACKUP_DIR))
    for old in names[:-MAX_BACKUPS]:
        try:
            os.remove(os.path.join(BACKUP_DIR, old))
        except OSError as e:
            print(f"[files] couldn't prune backup {old}: {e}")


def read_file(path: str) -> str:
    full = _safe_path(path)
    if not os.path.isfile(full):
        return f"Error: file '{path}' does not exist."
    with open(full, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    if len(content) > 8000:
        return content[:8000] + "\n...[truncated]"
    return content


def write_file(path: str, content: str) -> str:
    full = _safe_path(path)
    if os.path.isdir(full):
        return f"Error: '{path}' is a folder, not a file."
    note = ""
    if os.path.isfile(full):
        unchanged = False
        if os.path.getsize(full) == len(content.encode("utf-8")):
            with open(full, "r", encoding="utf-8", errors="replace") as f:
                unchanged = f.read() == content
        if unchanged:
            return f"{path} already has exactly this content, so nothing was changed."
        note = _backup(full)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    return f"Wrote {len(content)} characters to {path}.{note}"


def edit_file(path: str, find: str, replace: str) -> str:
    full = _safe_path(path)
    if not os.path.isfile(full):
        return f"Error: file '{path}' does not exist."
    with open(full, "r", encoding="utf-8") as f:
        content = f.read()

    count = content.count(find)
    if count == 0:
        return "Error: the text to find was not in the file. Read the file first and copy the exact text."
    if count > 1:
        return f"Error: that text appears {count} times. Include more surrounding text so it matches only once."

    note = _backup(full)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content.replace(find, replace, 1))
    return f"Edited {path}: replaced 1 occurrence.{note}"


def list_dir(path: str = ".") -> str:
    full = _safe_path(path)
    if not os.path.isdir(full):
        return f"Error: folder '{path}' does not exist."
    entries = sorted(os.listdir(full))
    if not entries:
        return "(empty folder)"
    lines = []
    for name in entries:
        kind = "dir " if os.path.isdir(os.path.join(full, name)) else "file"
        lines.append(f"[{kind}] {name}")
    return "\n".join(lines)


def find_files(pattern: str) -> str:
    root = get_workspace()
    matches = []
    for full in _walk(root):
        if fnmatch.fnmatch(os.path.basename(full).lower(), pattern.lower()):
            matches.append(os.path.relpath(full, root))
            if len(matches) >= 100:
                matches.append("...[more results cut off]")
                break
    return "\n".join(matches) if matches else f"No files matched '{pattern}'."


def search_text(query: str, path: str = ".") -> str:
    root = get_workspace()
    start = _safe_path(path)
    needle = query.lower()
    hits = []
    for full in _walk(start):
        try:
            if os.path.getsize(full) > 1_000_000:
                continue
            with open(full, "r", encoding="utf-8", errors="ignore") as f:
                for i, line in enumerate(f, start=1):
                    if needle in line.lower():
                        rel = os.path.relpath(full, root)
                        hits.append(f"{rel}:{i}: {line.strip()[:200]}")
                        if len(hits) >= 50:
                            return "\n".join(hits) + "\n...[more results cut off]"
        except OSError:
            continue
    return "\n".join(hits) if hits else f"No files contain '{query}'."


def move_file(source: str, dest: str) -> str:
    src = _safe_path(source)
    dst = _safe_path(dest)
    if not os.path.exists(src):
        return f"Error: '{source}' does not exist."
    if os.path.exists(dst):
        return f"Error: '{dest}' already exists. Pick a different name."
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    os.rename(src, dst)
    return f"Moved {source} to {dest}."


def delete_file(path: str) -> str:
    full = _safe_path(path)
    if not os.path.isfile(full):
        return f"Error: '{path}' is not a file that exists."
    os.remove(full)
    return f"Deleted {path}."


def delete_dir(path: str) -> str:
    import shutil
    full = _safe_path(path)
    if full == get_workspace():
        return "Error: refusing to delete the whole workspace folder."
    if not os.path.isdir(full):
        return f"Error: '{path}' is not a folder that exists."
