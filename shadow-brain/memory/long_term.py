"""Long-term memory: facts stored as embeddings in the active
assistant's memory.db, searched by meaning. Local embeddings via Ollama."""

import json
import sqlite3
import struct
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

import ollama

from assistants import memory_db_path

EMBED_MODEL = "nomic-embed-text"
TOP_K = 5                # how many memories to pull per query
MIN_SCORE = 0.35         # ignore weak matches


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def _db():
    conn = sqlite3.connect(memory_db_path())
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


def _unpack(blob: bytes) -> list[float]:
    return list(struct.unpack(f"{len(blob) // 4}f", blob))


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = sum(x * x for x in a) ** 0.5
    nb = sum(y * y for y in b) ** 0.5
    return dot / (na * nb) if na and nb else 0.0


def add(text: str, source: str = "user") -> bool:
    text = text.strip()
    if not text:
        return False
    vec = _embed(text)
    if vec is None:
        return False
    with _db() as conn:
        # Skip near-duplicates so memory doesn't fill with the same fact.
        for row in conn.execute("SELECT embedding FROM memories"):
            if _cosine(vec, _unpack(row["embedding"])) > 0.95:
                return False
        conn.execute(
            "INSERT INTO memories (id, text, embedding, source, created_at) VALUES (?, ?, ?, ?, ?)",
            (uuid.uuid4().hex, text, _pack(vec), source, _now()),
        )
    return True


def search(query: str, k: int = TOP_K) -> list[str]:
    vec = _embed(query)
    if vec is None:
        return []
    scored = []
    with _db() as conn:
        for row in conn.execute("SELECT text, embedding FROM memories"):
            score = _cosine(vec, _unpack(row["embedding"]))
            if score >= MIN_SCORE:
                scored.append((score, row["text"]))
    scored.sort(reverse=True)
    return [text for _, text in scored[:k]]


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
