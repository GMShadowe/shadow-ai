"""File tools. Everything is locked inside WORKSPACE so the model
can't touch the rest of your computer."""

import fnmatch
import os
from config import get_workspace

SKIP_DIRS = {".git", ".venv", "venv", "node_modules", "__pycache__"}


def _safe_path(path: str) -> str:
    root = get_workspace()
    full = os.path.realpath(os.path.join(root, path))
    if full != root and not full.startswith(root + os.sep):
        raise ValueError(f"Path escapes the workspace: {path}")
    return full


def _walk(start: str):
    for dirpath, dirnames, filenames in os.walk(start):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in filenames:
            yield os.path.join(dirpath, name)


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
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    return f"Wrote {len(content)} characters to {path}."


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

    with open(full, "w", encoding="utf-8") as f:
        f.write(content.replace(find, replace, 1))
    return f"Edited {path}: replaced 1 occurrence."


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
