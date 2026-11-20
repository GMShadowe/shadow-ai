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
    monkeypatch.setattr(server, "_TurnResponse", lambda stream, **kwargs: stream)
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
    monkeypatch.setattr(server, "_TurnResponse", lambda stream, **kwargs: stream)

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


def test_stopping_before_anything_was_written_still_says_stopped(client, monkeypatch):
    server = _server()
    monkeypatch.setattr(server, "_TurnResponse", lambda stream, **kwargs: stream)
    def fake(*args, **kwargs):
        yield {"type": "route", "route": "coding"}
        yield {"type": "token", "text": "x"}

    monkeypatch.setattr(server, "stream_turn", fake)
    storage.ensure_conversation("c4", "hi", aid="default")
    stream = server._stream_turn_response("c4", "hi", None, None, None, [], None, "default",
                                          server._claim("c4"))
    next(stream)
    stream.close()
    [reply] = _assistant_messages("c4")
    assert reply["content"] == "" and reply["stopped"] is True
    assert reply["route"] == "coding" and reply["tools"] == []


def test_a_browser_that_leaves_mid_approval_ends_the_turn_and_frees_the_chat(client, monkeypatch):
    import permissions
    server = _server()
    left = {}
    monkeypatch.setattr(server, "_TurnResponse",
                        lambda stream, on_gone: left.update(on_gone=on_gone) or stream)

    def fake(*args, **kwargs):
        yield {"type": "route", "route": "coding"}
        pid = permissions.create()
        yield {"type": "permission", "id": pid, "name": "write_file", "args": {"path": "snake.py"}}
        decision = permissions.wait(pid)
        yield {"type": "permission_result", "id": pid, "decision": decision}
        yield {"type": "token", "text": "never reached"}

    monkeypatch.setattr(server, "stream_turn", fake)
    storage.ensure_conversation("c5", "yes", aid="default")
    stream = server._stream_turn_response("c5", "yes", None, None, None, [], None, "default",
                                          server._claim("c5"))
    next(stream)
    next(stream)

    left["on_gone"]()

    deadline = time.monotonic() + 10
    while "c5" in server._busy:
        assert time.monotonic() < deadline, "the abandoned turn never let go of the chat"
        time.sleep(0.01)
    [reply] = _assistant_messages("c5")
    assert reply["stopped"] is True
    assert reply["tools"][0]["name"] == "write_file" and reply["tools"][0]["decision"] == "deny"


def test_leaving_after_the_turn_ended_changes_nothing(client):
    server = _server()
    stop = threading.Event()
    server._abandon("c6", stop, server._Partial(), iter([]))
    assert not stop.is_set()


def test_the_response_reports_a_browser_that_went_away():
    import asyncio
    server = _server()
    gone = []

    async def receive():
        return {"type": "http.disconnect"}

    async def send(message):
        if message["type"] == "http.response.body":
            raise OSError("the browser went away")

    response = server._TurnResponse(iter(["data: x\n\n"]), on_gone=lambda: gone.append(True))
    scope = {"type": "http", "asgi": {"spec_version": "2.4"}}
    try:
        asyncio.run(response(scope, receive, send))
    except Exception:
        pass
    assert gone == [True]


def test_a_chat_says_when_a_reply_is_still_running(client):
    server = _server()
    storage.ensure_conversation("c7", "hi", aid="default")
    assert client.get("/conversations/c7").json()["running"] is False
    claim = server._claim("c7")
    assert client.get("/conversations/c7").json()["running"] is True
    server._release("c7", claim)
    assert client.get("/conversations/c7").json()["running"] is False


def test_stop_with_no_turn_running(client):
    assert client.post("/chat/stop", json={"conversation_id": "nope"}).json() == {"stopped": False}
