"""#25: "remember" anywhere in a message disabled tools for that turn, and
when no fact could be extracted the whole sentence was saved to memory."""

from memory.short_term import ShortTermMemory
from orchestrator import handle_turn
from router.classifier import classify_detailed, is_remember
from tests.helpers import quiet_turn


def test_only_a_leading_request_counts_as_remember():
    assert is_remember("remember that I use vim")
    assert is_remember("Please remember my name is Ayaan")
    assert is_remember("  don't forget I prefer tabs")
    assert not is_remember("I don't remember the filename, find it")
    assert not is_remember("do you remember what we did yesterday?")
    assert not is_remember("find the file called remember.txt")


def test_a_sentence_mentioning_remember_still_gets_tools():
    decision = classify_detailed("I don't remember the filename, find all python files in my folder")
    assert decision["method"] != "remember"
    assert decision["adapters"], "file request lost its adapter"


def test_a_remember_request_routes_to_plain_chat():
    assert classify_detailed("remember that I use vim")["method"] == "remember"


def test_raw_text_is_not_saved_when_extraction_finds_nothing(monkeypatch):
    _, saved = quiet_turn(monkeypatch, "Okay.", facts=[])
    handle_turn("remember the thing from before", ShortTermMemory())
    assert saved == []


def test_extracted_facts_are_saved(monkeypatch):
    _, saved = quiet_turn(monkeypatch, "Got it.", facts=["Uses vim"])
    handle_turn("remember that I use vim", ShortTermMemory())
    assert saved == [("Uses vim", "asked")]


def test_a_non_request_saves_nothing(monkeypatch):
    _, saved = quiet_turn(monkeypatch, "Here you go.", facts=["Should not be saved"])
    handle_turn("I don't remember the filename", ShortTermMemory())
    assert saved == []
