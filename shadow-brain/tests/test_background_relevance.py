"""Location, weather and memories went into every reply: "hi lol" was
answered with the weather in their city and an offer of their favourite drink."""
from memory import long_term
from memory.short_term import ShortTermMemory
from orchestrator import BACKGROUND_RULE, handle_turn, wants_memories
from tests.helpers import quiet_turn


def test_short_small_talk_gets_no_memories():
    assert not wants_memories("hi lol")
    assert not wants_memories("sup wsg")
    assert not wants_memories("its cold actually")


def test_messages_about_the_user_still_do():
    assert wants_memories("whats my name")
    assert wants_memories("do you know my name?")
    assert wants_memories("plan a dinner menu for friends this weekend")


def test_a_greeting_reaches_the_model_without_remembered_facts(monkeypatch):
    fake, _ = quiet_turn(monkeypatch, "hey!")
    searched = []
    monkeypatch.setattr(long_term, "search",
                        lambda q, k=5, aid=None: searched.append(q) or ["Likes filter coffee"])

    handle_turn("hi lol", ShortTermMemory())

    system = fake.seen[0][0]["content"]
    assert searched == []
    assert "Likes filter coffee" not in system
    assert BACKGROUND_RULE in system
