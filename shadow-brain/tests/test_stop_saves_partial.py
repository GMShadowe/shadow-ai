import threading
import time

import storage


def _server():
    import server
    return server


def _turn_until_stopped(server, cid):
    """A turn that writes half a reply, then keeps going until Stop is pressed."""

    def fake(text, memory, model, effort, images, skill, aid, voice=False):
        yield {"type": "route", "route": "chat", "router": {}, "model": "Default",
               "effort": "low", "skill": None}
        yield {"type": "token", "text": "Half an "}
        yield {"type": "token", "text": "answer"}
        deadline = time.monotonic() + 10
        while not server._stops[cid][0].is_set():
            assert time.monotonic() < deadline, "stop never arrived"
            time.sleep(0.01)
        yield {"type": "token", "text": " that should never be saved"}
        yield {"type": "done", "reply": "Half an answer that should never be saved",
               "route": "chat", "tools": []}

    return fake


def _assistant_messages(cid):
    return [m for m in storage.get_conversation(cid)["messages"] if m["role"] == "assistant"]


def test_stop_keeps_what_was_written(client, monkeypatch):
    server = _server()
    monkeypatch.setattr(server, "stream_turn", _turn_until_stopped(server, "c1"))

    result = {}
    t = threading.Thread(target=lambda: result.update(
        r=client.post("/chat/stream", json={"conversation_id": "c1", "message": "explain CRDTs"})))
    t.start()

    deadline = time.monotonic() + 10
    while "c1" not in server._stops or server._stops["c1"][1].text != "Half an answer":
        assert time.monotonic() < deadline
        time.sleep(0.01)

    assert client.post("/chat/stop", json={"conversation_id": "c1"}).json() == {"stopped": True}
    t.join(10)

    assert "never be saved" not in result["r"].text
    [reply] = _assistant_messages("c1")
    assert reply["content"] == "Half an answer"
    assert reply["stopped"] is True and reply["route"] == "chat"
    assert [m["role"] for m in server.sessions["c1"].get()] == ["user", "assistant"]
    assert "c1" not in server._busy


def test_a_dropped_connection_saves_it_too(client, monkeypatch):
    server = _server()
    monkeypatch.setattr(server, "stream_turn", _turn_until_stopped(server, "c2"))
    monkeypatch.setattr(server, "StreamingResponse", lambda stream, **kwargs: stream)
    storage.ensure_conversation("c2", "hi", aid="default")

    claim = server._claim("c2")
    stream = server._stream_turn_response("c2", "hi", None, None, None, [], None, "default", claim)
    for _ in range(3):
        next(stream)
    stream.close()

    [reply] = _assistant_messages("c2")
    assert reply["content"] == "Half an answer" and reply["stopped"] is True
    assert "c2" not in server._busy and "c2" not in server._stops


def test_a_tool_that_never_ran_says_so(client, monkeypatch):
    server = _server()
    monkeypatch.setattr(server, "StreamingResponse", lambda stream, **kwargs: stream)

    def fake(*args, **kwargs):
        yield {"type": "token", "text": "Let me look"}
        yield {"type": "tool_start", "name": "list_dir", "args": {"path": "."}}
        yield {"type": "tool_end", "name": "list_dir", "result": "a.txt"}
        yield {"type": "tool_start", "name": "read_file", "args": {"path": "a.txt"}}

    monkeypatch.setattr(server, "stream_turn", fake)
    storage.ensure_conversation("c3", "hi", aid="default")
    stream = server._stream_turn_response("c3", "hi", None, None, None, [], None, "default",
                                          server._claim("c3"))
    for _ in range(4):
        next(stream)
    stream.close()

    [reply] = _assistant_messages("c3")
    assert reply["content"] == ""
    assert reply["tools"][0]["result"] == "a.txt"
    assert reply["tools"][1]["result"].startswith("Not run")


def test_stopping_before_anything_was_written_saves_nothing(client, monkeypatch):
    server = _server()
    monkeypatch.setattr(server, "StreamingResponse", lambda stream, **kwargs: stream)
    def fake(*args, **kwargs):
        yield {"type": "route", "route": "chat"}
        yield {"type": "token", "text": "x"}

    monkeypatch.setattr(server, "stream_turn", fake)
    storage.ensure_conversation("c4", "hi", aid="default")
    stream = server._stream_turn_response("c4", "hi", None, None, None, [], None, "default",
                                          server._claim("c4"))
    next(stream)
    stream.close()
    assert _assistant_messages("c4") == []


def test_stop_with_no_turn_running(client):
    assert client.post("/chat/stop", json={"conversation_id": "nope"}).json() == {"stopped": False}
