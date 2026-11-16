"""Long-term memory: facts stored as embeddings in the active
assistant's memory.db, searched by meaning. Local embeddings via Ollama."""

import json
import sqlite3
import struct
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

import numpy as np
import ollama

from assistants import memory_db_path

EMBED_MODEL = "nomic-embed-text"
TOP_K = 5                # how many memories to pull per query
MIN_SCORE = 0.35         # ignore weak matches


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def _db(aid: str | None = None):
    conn = sqlite3.connect(memory_db_path(aid))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init() -> None:
    with _db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                text TEXT NOT NULL,
                embedding BLOB NOT NULL,
                source TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)


def _embed(text: str) -> list[float] | None:
    try:
        resp = ollama.embed(model=EMBED_MODEL, input=text)
        vec = resp["embeddings"][0]
        if not vec:
            print(f"[memory] embed returned empty for: {text[:40]}")
            return None
        return vec
    except Exception as e:
        print(f"[memory] embed failed: {e}")
        return None


def _pack(vec: list[float]) -> bytes:
    return struct.pack(f"{len(vec)}f", *vec)


def _similarities(vec: list[float], blobs: list[bytes]) -> np.ndarray:
    query = np.asarray(vec, dtype=np.float32)
    if not blobs:
        return np.zeros(0, dtype=np.float32)
    # A memory embedded by a different model has a different size; it scores 0
    # rather than being dropped, so scores stay aligned with the rows.
    empty = np.zeros(query.size, dtype=np.float32)
    stored = np.stack([np.frombuffer(b, dtype=np.float32) if len(b) == query.size * 4 else empty
                       for b in blobs])
    norms = np.linalg.norm(stored, axis=1) * np.linalg.norm(query)
    with np.errstate(divide="ignore", invalid="ignore"):
        return np.where(norms > 0, stored @ query / norms, 0.0)


def add(text: str, source: str = "user", aid: str | None = None) -> bool:
    text = text.strip()
    if not text:
        return False
    vec = _embed(text)
    if vec is None:
        return False
    with _db(aid) as conn:
        # Skip near-duplicates so memory doesn't fill with the same fact.
        blobs = [row["embedding"] for row in conn.execute("SELECT embedding FROM memories")]
        if (_similarities(vec, blobs) > 0.95).any():
            return False
        conn.execute(
            "INSERT INTO memories (id, text, embedding, source, created_at) VALUES (?, ?, ?, ?, ?)",
            (uuid.uuid4().hex, text, _pack(vec), source, _now()),
        )
    return True


def search(query: str, k: int = TOP_K, aid: str | None = None) -> list[str]:
    with _db(aid) as conn:
        rows = conn.execute("SELECT text, embedding FROM memories").fetchall()
    if not rows:
        return []
    vec = _embed(query)
    if vec is None:
        return []
    scores = _similarities(vec, [row["embedding"] for row in rows])
    best = [i for i in np.argsort(-scores)[:k] if scores[i] >= MIN_SCORE]
    return [rows[i]["text"] for i in best]


def all_memories() -> list[dict]:
    with _db() as conn:
        rows = conn.execute(
            "SELECT id, text, source, created_at FROM memories ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


def delete(mid: str) -> None:
    with _db() as conn:
        conn.execute("DELETE FROM memories WHERE id = ?", (mid,))


def clear() -> None:
    with _db() as conn:
        conn.execute("DELETE FROM memories")


def count() -> int:
    with _db() as conn:
        return conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]
