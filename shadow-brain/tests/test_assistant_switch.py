"""#15: storage and memory re-read the active assistant on every call, so a
turn still streaming when the user switched assistants saved its reply and
memories into the new assistant."""

import sqlite3

import assistants
from tests.helpers import quiet_turn


def _messages(aid):
    conn = sqlite3.connect(assistants.chats_db_path(aid))
    try:
        return [tuple(r) for r in conn.execute("SELECT role, content FROM messages ORDER BY seq")]
    finally:
        conn.close()


def test_switching_mid_turn_keeps_the_reply_with_the_asking_assistant(client, monkeypatch):
    first = assistants.active_id()
    other = assistants.create("Nova")["id"]
    fake, saved = quiet_turn(monkeypatch, "The answer.", facts=["Uses vim"])

    def switch_then_answer(*args, **kwargs):
        # The user opens the dashboard and switches while the reply streams.
        client.post(f"/assistants/{other}/activate").raise_for_status()
        return fake(*args, **kwargs)

    import model
    monkeypatch.setattr(model, "_chat_stream", switch_then_answer)

    r = client.post("/chat/stream", json={"conversation_id": "c1", "message": "remember that I use vim"})
    assert r.status_code == 200 and '"type": "done"' in r.text

    assert assistants.active_id() == other  # the switch really happened
    assert _messages(first) == [("user", "remember that I use vim"), ("assistant", "The answer.")]
    assert _messages(other) == []


def test_memories_go_to_the_pinned_assistant(monkeypatch):
    from memory import long_term
    from memory.short_term import ShortTermMemory
    from orchestrator import handle_turn

    first = assistants.active_id()
    other = assistants.create("Nova")["id"]
    _, _ = quiet_turn(monkeypatch, "Noted.", facts=["Uses vim"])
    added = []
    monkeypatch.setattr(long_term, "add", lambda text, source="user", aid=None: added.append(aid) or True)

    import model
    real = model._chat_stream

    def switch(*a, **k):
        assistants.set_active(other)
        return real(*a, **k)

    monkeypatch.setattr(model, "_chat_stream", switch)
    handle_turn("remember that I use vim", ShortTermMemory(), aid=first)
    assert added == [first]
