import threading

from memory import long_term
from memory.short_term import ShortTermMemory
from tests.helpers import quiet_turn


def test_memory_search_runs_while_the_message_is_routed(monkeypatch):
    import orchestrator
    fake, _ = quiet_turn(monkeypatch, "Noted.")
    searching = threading.Event()
    overlapped = []

    def search(q, k=5, aid=None):
        searching.set()
        return ["Likes filter coffee"]

    def classify(*args, **kwargs):
        overlapped.append(searching.wait(timeout=2))
        return {"adapters": [], "method": "test", "probabilities": None, "ms": 0}

    monkeypatch.setattr(long_term, "search", search)
    monkeypatch.setattr(orchestrator, "classify_detailed", classify)

    orchestrator.handle_turn("what kind of coffee do i like best?", ShortTermMemory())

    assert overlapped == [True]
    assert "Likes filter coffee" in fake.seen[0][-2]["content"]
