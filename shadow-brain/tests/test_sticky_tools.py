"""A follow-up the router reads as chat ("yes, go ahead") keeps the tools the
task was using, for a few replies."""

import model
import orchestrator
from memory.short_term import ShortTermMemory
from orchestrator import STICKY_TURNS, carried_adapters, handle_turn
from tests.helpers import quiet_turn

def route_as(monkeypatch, adapters):
    monkeypatch.setattr(orchestrator, "classify_detailed",
                        lambda *a, **k: {"adapters": adapters, "method": "test",
                                         "probabilities": None, "ms": 0})

def granted_tools(monkeypatch):
    granted = []
    real = model.stream_model

    def spy(messages, tool_names=None, *rest, **kw):
        granted.append(set(tool_names or []))
        return real(messages, tool_names, *rest, **kw)

    monkeypatch.setattr(orchestrator, "stream_model", spy)
    return granted

def test_yes_after_a_coding_turn_still_has_the_coding_tools(monkeypatch):
    memory = ShortTermMemory()
    granted = granted_tools(monkeypatch)
    quiet_turn(monkeypatch, "Here's the plan. Shall I code it?", "Done.")

    route_as(monkeypatch, ["coding"])
    handle_turn("code me a game, plan it first", memory)
    route_as(monkeypatch, [])
    handle_turn("yes", memory)

    assert {"write_file", "run_command"} <= granted[1]

def test_kept_tools_fade_when_unused():
    memory = ShortTermMemory()
    memory.add("user", "write a script")
    memory.add("assistant", "Done.", adapters=["coding"])
    for i in range(STICKY_TURNS):
        assert memory.recent_adapters(STICKY_TURNS) == ["coding"]
        memory.add("user", f"chat {i}")
        memory.add("assistant", "ok", adapters=carried_adapters([], [{"name": "coding", "tools": ["write_file"]}], []))
    assert memory.recent_adapters(STICKY_TURNS) == []

def test_kept_tools_that_were_used_carry_on():
    coding = {"name": "coding", "tools": ["write_file", "run_command"]}
    assert carried_adapters([], [coding], [{"name": "run_command"}]) == ["coding"]
    assert carried_adapters([], [coding], [{"name": "web_search"}]) == []

def test_kept_tools_survive_a_restart(client):
    import server
    import storage

    cid = "sticky-restart"
    storage.ensure_conversation(cid, "write primes.py")
    storage.add_message(cid, "user", "write primes.py")
    storage.add_message(cid, "assistant", "Done.", {"route": "coding+research"})
    storage.add_message(cid, "user", "hi")
    storage.add_message(cid, "assistant", "Hello.", {"route": "chat"})
    server.sessions.pop(cid, None)

    assert server._memory_for(cid).recent_adapters(STICKY_TURNS) == ["coding", "research"]

def test_unreadable_meta_is_reported_not_fatal(capsys):
    import server

    memory = ShortTermMemory()
    server._remember(memory, {"role": "assistant", "content": "ok", "meta": "{not json"})
    assert memory.recent_adapters(STICKY_TURNS) == []
    assert "unreadable meta" in capsys.readouterr().out
