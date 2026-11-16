import threading

import model
import orchestrator
import permissions
from memory.short_term import ShortTermMemory
from model import stream_model
from tests.helpers import call, scripted


def test_a_turn_with_no_one_to_ask_skips_the_tool_at_once(monkeypatch):
    def turn(*args, **kwargs):
        pid = permissions.create()
        yield {"type": "permission", "id": pid, "name": "delete_file", "args": {}}
        yield {"type": "done", "decision": permissions.wait(pid)}

    monkeypatch.setattr(orchestrator, "stream_turn", turn)
    finished = []
    worker = threading.Thread(target=lambda: finished.append(
        orchestrator.handle_turn("delete junk.txt", ShortTermMemory())))
    worker.start()
    worker.join(timeout=5)
    assert finished and finished[0]["decision"] == "unattended"


def test_the_model_is_told_why_the_tool_was_skipped(monkeypatch):
    ran = []
    monkeypatch.setattr(model, "call_tool", lambda name, args: ran.append(name) or "deleted")
    fake = scripted([call("delete_file", {"path": "junk.txt"})], "I couldn't delete it.")
    monkeypatch.setattr(model, "_chat_stream", fake)

    events = stream_model([{"role": "user", "content": "delete junk.txt"}],
                          ["delete_file"], ask_tools=["delete_file"])
    for event in events:
        if event["type"] == "permission":
            permissions.resolve(event["id"], "unattended")

    assert ran == []
    assert "approving it needs the Shadow app" in fake.seen[-1][-1]["content"]
