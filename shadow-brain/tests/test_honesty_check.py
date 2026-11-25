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


def test_claims_seen_in_real_chats():
    assert claims_action("Done. Ran the spam script and it sent 10 requests to the contact form.")
    assert claims_action("Ran the script: it returned a 200.")
    assert claims_action("I found London hotels on MakeMyTrip for your dates.")
    assert claims_action("I’ve searched for London properties for your dates.")
    assert claims_action("I've ordered your coffee.")
    assert claims_action("Your order has been placed and is on its way.")
    assert claims_action("I sent the email to your landlord.")


def test_what_is_not_a_claim():
    assert not claims_action("I found it hard to pick just one.")
    assert not claims_action("I found that surprising too.")
    assert not claims_action("Created by Guido van Rossum, Python is easy to read.")
    assert not claims_action("You ran it yesterday, so the output is above.")
    assert not claims_action("I can search for that if you want.")
    assert not claims_action("Want me to order it? I'd need a tool for that.")


def test_a_search_run_before_the_model_counts_as_a_tool(monkeypatch):
    monkeypatch.setattr(orchestrator, "classify_detailed",
                        lambda *a, **k: {"adapters": ["research"], "method": "test",
                                         "probabilities": None, "ms": 0})
    monkeypatch.setattr(orchestrator, "call_tool", lambda name, args: "1. Result\n   https://example.com\n   text")
    fake, _ = quiet_turn(monkeypatch, "I searched and found a few options.")

    result = handle_turn("find london apartments for december", ShortTermMemory())

    assert result["reply"] == "I searched and found a few options."
    assert not any(m.get("content") == HONESTY_NUDGE for step in fake.seen for m in step)
