import threading

from memory import extract, long_term, saver
from memory.short_term import ShortTermMemory
from tests.helpers import quiet_turn


def test_done_arrives_before_the_fact_is_saved(monkeypatch):
    from orchestrator import stream_turn
    quiet_turn(monkeypatch, "Got it.")
    release = threading.Event()
    saved = []
    monkeypatch.setattr(extract, "extract_facts", lambda text, tier=None: release.wait(2) and ["Uses vim"])
    monkeypatch.setattr(long_term, "add", lambda text, source="user", aid=None: saved.append(text) or True)

    events = [e["type"] for e in stream_turn("remember that I use vim", ShortTermMemory())]

    assert events[-1] == "done" and saved == []
    release.set()
    saver.settle()
    assert saved == ["Uses vim"]


def test_auto_memory_waits_for_a_quiet_chat_and_saves_everything(monkeypatch):
    seen = []
    monkeypatch.setattr(extract, "extract_facts", lambda text, tier=None: [text.upper()])
    monkeypatch.setattr(long_term, "add", lambda text, source="user", aid=None: seen.append((text, source)) or True)

    saver.later("i use vim", None, "a", quiet=60)
    saver.later("i live in pune", None, "a", quiet=60)
    assert saver.waiting() == 2 and seen == []

    saver.flush().result()
    assert seen == [("I USE VIM", "auto"), ("I LIVE IN PUNE", "auto")]
    assert saver.waiting() == 0
