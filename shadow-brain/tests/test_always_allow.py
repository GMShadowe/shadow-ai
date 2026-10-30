import threading

import assistants
import model
import permissions
from model import stream_model
from tests.helpers import call, scripted
from tools.state import tool_state


def _answer_when_asked(decision):
    def answer():
        for _ in range(200):
            with permissions._lock:
                pending = list(permissions._pending)
            if pending:
                permissions.resolve(pending[0], decision)
                return
            threading.Event().wait(0.01)
    threading.Thread(target=answer, daemon=True).start()


def test_always_allow_runs_the_tool_and_saves_on_for_that_assistant(monkeypatch):
    aid = assistants.active_id()
    other = assistants.create("Nova")["id"]
    ran = []
    monkeypatch.setattr(model, "call_tool", lambda name, args: ran.append(name) or "deleted")
    monkeypatch.setattr(model, "_chat_stream",
                        scripted([call("delete_file", {"path": "junk.txt"})], "Deleted junk.txt."))
    assert tool_state("delete_file") == "ask"

    _answer_when_asked("always")
    events = list(stream_model([{"role": "user", "content": "delete junk.txt"}],
                               ["delete_file"], ask_tools=["delete_file"], aid=aid))

    assert ran == ["delete_file"]
    assert events[-1] == {"type": "final", "text": "Deleted junk.txt."}
    assert assistants.get_profile(aid)["tools"]["delete_file"] == "on"
    assert tool_state("delete_file", assistants.get_profile(other)) == "ask"
