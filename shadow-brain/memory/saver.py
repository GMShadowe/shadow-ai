"""Saves facts to long-term memory after the reply instead of before it.

Extraction is a whole extra model call. Run before the reply's "done", it
kept the chat busy for it; run between two messages, it also pushed the
conversation out of Ollama's cache, so the next message was read from the
start. So a "remember…" is saved straight after the reply, and auto-memory
waits until the chat has been quiet for a while.
"""

import threading
from concurrent.futures import Future, ThreadPoolExecutor

from memory import extract, long_term

QUIET_SECONDS = 45

_worker = ThreadPoolExecutor(max_workers=1, thread_name_prefix="memory")
_lock = threading.Lock()
_waiting: list[tuple[str, str | None, str]] = []
_timer: threading.Timer | None = None


def remember(text: str, tier: str | None, aid: str) -> Future:
    return _worker.submit(_save_asked, text, tier, aid)


def later(text: str, tier: str | None, aid: str, quiet: float | None = None) -> None:
    global _timer
    with _lock:
        _waiting.append((text, tier, aid))
        if _timer is not None:
            _timer.cancel()
        if quiet is None:
            import cool
            quiet = cool.quiet_seconds(QUIET_SECONDS)
        _timer = threading.Timer(quiet, flush)
        _timer.daemon = True
        _timer.start()


def flush() -> Future:
    global _timer
    with _lock:
        batch = list(_waiting)
        _waiting.clear()
        if _timer is not None:
            _timer.cancel()
            _timer = None
    return _worker.submit(_save_auto, batch)


def settle() -> None:
    """Returns once everything already handed to the worker has run."""
    _worker.submit(lambda: None).result()


def waiting() -> int:
    with _lock:
        return len(_waiting)


def _save_asked(text: str, tier: str | None, aid: str) -> None:
    try:
        facts = extract.extract_facts(text, tier)
        if facts:
            saved = [long_term.add(f, source="asked", aid=aid) for f in facts]
            print(f"[memory] remember matched, saved {sum(saved)} of {len(facts)} facts")
        else:
            print("[memory] remember matched, but no fact could be extracted, so nothing was saved")
    except Exception as e:
        print(f"[memory] save failed: {e}")


def _save_auto(batch: list[tuple[str, str | None, str]]) -> None:
    for text, tier, aid in batch:
        try:
            for fact in extract.extract_facts(text, tier):
                long_term.add(fact, source="auto", aid=aid)
        except Exception as e:
            print(f"[memory] auto-memory save failed: {e}")
