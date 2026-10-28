"""Saved conversations, in a SQLite file inside the active assistant's folder."""

import base64
import json
import os
import re
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

from assistants import chats_db_path, images_dir

IMAGE_NAME = re.compile(r"^[0-9a-f]{32}\.(jpg|png|webp|gif)$")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def _db():
    conn = sqlite3.connect(chats_db_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init() -> None:
    with _db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS messages (
                seq INTEGER PRIMARY KEY AUTOINCREMENT,
                id TEXT UNIQUE NOT NULL,
                conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                meta TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, seq);
        """)


def image_ext(data: bytes) -> str | None:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def save_image(b64: str) -> str:
    data = base64.b64decode(b64)
    ext = image_ext(data) or "jpg"
    name = f"{uuid.uuid4().hex}.{ext}"
    folder = images_dir()
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, name), "wb") as f:
        f.write(data)
    return name


def image_path(name: str) -> str | None:
    if not IMAGE_NAME.match(name):
        return None
    path = os.path.join(images_dir(), name)
    return path if os.path.isfile(path) else None


def list_conversations() -> list[dict]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT id, title, updated_at FROM conversations ORDER BY updated_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def get_conversation(cid: str) -> dict | None:
    with _db() as conn:
        conv = conn.execute(
            "SELECT id, title, created_at, updated_at FROM conversations WHERE id = ?", (cid,)
        ).fetchone()
        if conv is None:
            return None
        rows = conn.execute(
            "SELECT id, role, content, meta FROM messages WHERE conversation_id = ? ORDER BY seq", (cid,)
        ).fetchall()

    messages = []
    for r in rows:
        meta = json.loads(r["meta"] or "{}")
        messages.append({"id": r["id"], "role": r["role"], "content": r["content"], **meta})
    return {**dict(conv), "messages": messages}


def ensure_conversation(cid: str, first_message: str) -> None:
    now = _now()
    title = " ".join(first_message.split())[:60] or "New chat"
    with _db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (cid, title, now, now),
        )


def add_message(cid: str, role: str, content: str, meta: dict | None = None) -> str:
    mid = uuid.uuid4().hex
    now = _now()
    with _db() as conn:
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (mid, cid, role, content, json.dumps(meta or {}), now),
        )
        conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, cid))
    return mid


def rename_conversation(cid: str, title: str) -> bool:
    with _db() as conn:
        cur = conn.execute("UPDATE conversations SET title = ? WHERE id = ?", (title, cid))
        return cur.rowcount > 0


def delete_conversation(cid: str) -> None:
    with _db() as conn:
        rows = conn.execute("SELECT meta FROM messages WHERE conversation_id = ?", (cid,)).fetchall()
        conn.execute("DELETE FROM conversations WHERE id = ?", (cid,))
    for r in rows:
        for name in json.loads(r["meta"] or "{}").get("images", []):
            path = image_path(name)
            if path:
                os.remove(path)


def delete_all_conversations() -> int:
    """Deletes every conversation and the images that belonged to them."""
    with _db() as conn:
        rows = conn.execute("SELECT meta FROM messages").fetchall()
        removed = conn.execute("SELECT COUNT(*) FROM conversations").fetchone()[0]
        conn.execute("DELETE FROM conversations")
        conn.execute("DELETE FROM messages")
    for r in rows:
        for name in json.loads(r["meta"] or "{}").get("images", []):
            path = image_path(name)
            if path:
                try:
                    os.remove(path)
                except OSError as e:
                    print(f"[storage] couldn't delete image {name}: {e}")
    return removed


def recent_history(cid: str, limit: int = 20) -> list[dict]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? "
            "AND role IN ('user', 'assistant') ORDER BY seq DESC LIMIT ?",
            (cid, limit),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]

def get_message(mid: str) -> dict | None:
    with _db() as conn:
        row = conn.execute(
            "SELECT id, seq, conversation_id, role, content, meta, created_at FROM messages WHERE id = ?",
            (mid,),
        ).fetchone()
    if row is None:
        return None
    out = dict(row)
    out["meta"] = json.loads(out["meta"] or "{}")
    return out


def last_user_message(cid: str) -> dict | None:
    """The message a regenerate or an edit re-runs."""
    with _db() as conn:
        row = conn.execute(
            "SELECT id, seq, conversation_id, role, content, meta, created_at FROM messages "
            "WHERE conversation_id = ? AND role = 'user' ORDER BY seq DESC LIMIT 1",
            (cid,),
        ).fetchone()
    if row is None:
        return None
    out = dict(row)
    out["meta"] = json.loads(out["meta"] or "{}")
    return out


def user_before(cid: str, seq: int) -> dict | None:
    """The question a reply was answering, for the feedback record."""
    with _db() as conn:
        row = conn.execute(
            "SELECT id, seq, content, meta FROM messages WHERE conversation_id = ? AND seq < ? "
            "AND role = 'user' ORDER BY seq DESC LIMIT 1",
            (cid, seq),
        ).fetchone()
    if row is None:
        return None
    out = dict(row)
    out["meta"] = json.loads(out["meta"] or "{}")
    return out


def first_message_id(cid: str) -> str | None:
    with _db() as conn:
        row = conn.execute(
            "SELECT id FROM messages WHERE conversation_id = ? ORDER BY seq LIMIT 1", (cid,)
        ).fetchone()
    return row["id"] if row else None


def conversation_title(cid: str) -> str | None:
    with _db() as conn:
        row = conn.execute("SELECT title FROM conversations WHERE id = ?", (cid,)).fetchone()
    return row["title"] if row else None


def message_after(cid: str, seq: int) -> dict | None:
    """The first message following `seq` - the reply a re-run replaces."""
    with _db() as conn:
        row = conn.execute(
            "SELECT id, seq, role, content, meta FROM messages WHERE conversation_id = ? AND seq > ? "
            "ORDER BY seq LIMIT 1",
            (cid, seq),
        ).fetchone()
    if row is None:
        return None
    out = dict(row)
    out["meta"] = json.loads(out["meta"] or "{}")
    return out


def update_message(mid: str, content: str | None = None, meta_patch: dict | None = None) -> bool:
    """Edit one message in place. meta_patch merges, and a None value removes
    the key, so clearing a rating leaves no empty field behind."""
    with _db() as conn:
        row = conn.execute("SELECT meta, conversation_id FROM messages WHERE id = ?", (mid,)).fetchone()
        if row is None:
            return False
        meta = json.loads(row["meta"] or "{}")
        if meta_patch:
            for key, value in meta_patch.items():
                if value is None:
                    meta.pop(key, None)
                else:
                    meta[key] = value
        if content is None:
            conn.execute("UPDATE messages SET meta = ? WHERE id = ?", (json.dumps(meta), mid))
        else:
            conn.execute("UPDATE messages SET content = ?, meta = ? WHERE id = ?",
                         (content, json.dumps(meta), mid))
        conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (_now(), row["conversation_id"]))
    return True


def delete_after(cid: str, seq: int) -> int:
    """Drop every message after `seq`, images included. This is what keeps a
    regenerate from leaving the old reply behind as an orphan."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT meta FROM messages WHERE conversation_id = ? AND seq > ?", (cid, seq)
        ).fetchall()
        cur = conn.execute("DELETE FROM messages WHERE conversation_id = ? AND seq > ?", (cid, seq))
        removed = cur.rowcount
    for r in rows:
        for name in json.loads(r["meta"] or "{}").get("images", []):
            path = image_path(name)
            if path:
                try:
                    os.remove(path)
                except OSError as e:
                    print(f"[storage] couldn't delete image {name}: {e}")
    return removed


def history_before(cid: str, seq: int, limit: int = 20) -> list[dict]:
    """The turns before a message, for rebuilding short-term memory when a
    turn is re-run: the message being re-run must not appear twice."""
    with _db() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE conversation_id = ? AND seq < ? "
            "AND role IN ('user', 'assistant') ORDER BY seq DESC LIMIT ?",
            (cid, seq, limit),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]


def image_b64(name: str) -> str | None:
    """A stored image, back as base64, so a re-run sees what the first run saw."""
    path = image_path(name)
    if not path:
        return None
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


SNIPPET_PAD = 70


def _snippet(text: str, needle: str) -> str:
    """Enough of the line around the match to recognise the chat by."""
    flat = " ".join(text.split())
    at = flat.lower().find(needle.lower())
    if at == -1:
        return flat[: SNIPPET_PAD * 2] + ("…" if len(flat) > SNIPPET_PAD * 2 else "")
    start = max(0, at - SNIPPET_PAD)
    end = min(len(flat), at + len(needle) + SNIPPET_PAD)
    return ("…" if start else "") + flat[start:end] + ("…" if end < len(flat) else "")


def search(query: str, limit: int = 30) -> list[dict]:
    """Titles and message text. LIKE rather than FTS: these databases hold
    hundreds of messages, not millions, and this needs no migration."""
    q = query.strip()
    if not q:
        return []
    like = f"%{q}%"
    with _db() as conn:
        rows = conn.execute(
            "SELECT c.id, c.title, c.updated_at, "
            "       (SELECT COUNT(*) FROM messages m2 WHERE m2.conversation_id = c.id "
            "        AND m2.content LIKE ? AND m2.role IN ('user','assistant')) AS hits, "
            "       (SELECT m3.content FROM messages m3 WHERE m3.conversation_id = c.id "
            "        AND m3.content LIKE ? AND m3.role IN ('user','assistant') ORDER BY m3.seq LIMIT 1) AS first_hit, "
            "       (SELECT m4.role FROM messages m4 WHERE m4.conversation_id = c.id "
            "        AND m4.content LIKE ? AND m4.role IN ('user','assistant') ORDER BY m4.seq LIMIT 1) AS first_role "
            "FROM conversations c "
            "WHERE c.title LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id "
            "      AND m.content LIKE ? AND m.role IN ('user','assistant')) "
            "ORDER BY c.updated_at DESC LIMIT ?",
            (like, like, like, like, like, limit),
        ).fetchall()

    out = []
    for r in rows:
        in_title = q.lower() in (r["title"] or "").lower()
        out.append({
            "id": r["id"],
            "title": r["title"],
            "updated_at": r["updated_at"],
            "hits": r["hits"] or 0,
            "in_title": in_title,
            "role": r["first_role"],
            "snippet": _snippet(r["first_hit"], q) if r["first_hit"] else "",
        })
    return out
