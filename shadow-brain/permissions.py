"""Tool permission requests. When a tool is set to Ask, the brain pauses
that tool call until the user answers in the UI (or the terminal)."""

import threading
import uuid

TIMEOUT_SECONDS = 300

_pending: dict[str, dict] = {}
_lock = threading.Lock()


def create() -> str:
    pid = uuid.uuid4().hex
    with _lock:
        _pending[pid] = {"event": threading.Event(), "decision": None}
    return pid


def wait(pid: str) -> str:
    """Blocks until answered. Returns 'allow', 'deny', 'always' or 'timeout'."""
    with _lock:
        entry = _pending.get(pid)
    if entry is None:
        return "deny"
    answered = entry["event"].wait(TIMEOUT_SECONDS)
    with _lock:
        _pending.pop(pid, None)
    return entry["decision"] if answered else "timeout"


def resolve(pid: str, decision: str) -> bool:
    with _lock:
        entry = _pending.get(pid)
    if entry is None or entry["event"].is_set():
        return False
    entry["decision"] = decision
    entry["event"].set()
    return True
