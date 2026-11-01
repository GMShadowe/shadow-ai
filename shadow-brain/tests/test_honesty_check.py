"""A reply that claims an action in a turn where no tool ran is asked again
once, instead of reaching the user as a lie."""
from memory.short_term import ShortTermMemory
from model import HONESTY_NUDGE, claims_action
from orchestrator import handle_turn
from tests.helpers import call, quiet_turn

import orchestrator


def route_coding(monkeypatch):
    monkeypatch.setattr(orchestrator, "classify_detailed",
                        lambda *a, **k: {"adapters": ["coding"], "method": "test",
                                         "probabilities": None, "ms": 0})


def test_a_claimed_write_with_no_tool_is_asked_again(monkeypatch):
    route_coding(monkeypatch)
    fake, _ = quiet_turn(monkeypatch, "I've created hello.py for you.", "I haven't created it yet, sorry.")

    result = handle_turn("make hello.py", ShortTermMemory())

    assert any(m["content"] == HONESTY_NUDGE for m in fake.seen[1])
    assert result["reply"] == "I haven't created it yet, sorry."
    assert any(t["name"] == "honesty_check" for t in result["tools"])


def test_only_once_per_turn(monkeypatch):
    route_coding(monkeypatch)
    fake, _ = quiet_turn(monkeypatch, "I've created it.", "I've created it, really.")

    result = handle_turn("make hello.py", ShortTermMemory())

    assert len(fake.seen) == 2
    assert result["reply"] == "I've created it, really."


def test_a_claim_after_a_real_tool_call_is_left_alone(monkeypatch, tmp_path):
    route_coding(monkeypatch)
    monkeypatch.setattr(orchestrator, "call_tool", lambda name, args: "ok")
    fake, _ = quiet_turn(monkeypatch, [call("list_dir", {"path": "."})], "I've created hello.py.")

    handle_turn("make hello.py", ShortTermMemory())

    assert not any(m.get("content") == HONESTY_NUDGE for step in fake.seen for m in step)


def test_what_counts_as_a_claim():
    assert claims_action("Done! I've saved the notes to notes.md.")
    assert claims_action("The Notes app is now open.")
    assert claims_action("junk.txt has been deleted.")
    assert not claims_action("I can create that file for you if you want.")
    assert not claims_action("Python is a programming language.")
