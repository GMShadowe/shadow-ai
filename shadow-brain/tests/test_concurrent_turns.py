"""#30: sync endpoints run on a threadpool and two requests on the same
conversation mutated the same ShortTermMemory at once, interleaving turns."""

import gc
import threading

import model
from tests.helpers import quiet_turn

# server.py does work at import (#33), so it is only ever imported after the
# data folder has been redirected - through the client fixture, or here.


def _server():
    import server
    return server


def test_a_second_turn_on_a_busy_chat_is_refused(client, monkeypatch):
    fake, _ = quiet_turn(monkeypatch, "other chat", "first", "after")  # c2 answers while c1 waits
    started, finish = threading.Event(), threading.Event()

    def slow(*args, **kwargs):
        if not started.is_set():
            started.set()
            assert finish.wait(10)
        return fake(*args, **kwargs)

    monkeypatch.setattr(model, "_chat_stream", slow)

    first = {}
    t = threading.Thread(target=lambda: first.update(
        r=client.post("/chat/stream", json={"conversation_id": "c1", "message": "hello"})))
    t.start()
    assert started.wait(10)

    busy = client.post("/chat/stream", json={"conversation_id": "c1", "message": "again"})
    assert busy.status_code == 409 and "still answering" in busy.json()["detail"]
    rerun = client.post("/chat/regenerate", json={"conversation_id": "c1"})
    assert rerun.status_code == 409
    # Another conversation is unaffected.
    assert client.post("/chat/stream", json={"conversation_id": "c2", "message": "hi"}).status_code == 200

    finish.set()
    t.join(10)
    assert first["r"].status_code == 200 and "first" in first["r"].text
    # Free again once the first turn is done.
    assert client.post("/chat/stream", json={"conversation_id": "c1", "message": "now"}).status_code == 200


def test_a_refused_request_does_not_leave_the_chat_busy(client):
    server = _server()
    assert client.post("/chat/stream", json={"conversation_id": "c1", "message": "  "}).status_code == 400
    assert "c1" not in server._busy


def test_a_stream_that_is_never_started_still_releases(client):
    server = _server()
    claim = server._claim("c9")
    response = server._stream_turn_response("c9", "hi", None, None, None, [], None, "default", claim)
    assert "c9" in server._busy
    del response
    gc.collect()
    assert "c9" not in server._busy


def test_a_late_release_cannot_free_a_newer_claim(client):
    server = _server()
    old = server._claim("c3")
    server._release("c3", old)
    new = server._claim("c3")
    server._release("c3", old)  # e.g. the old stream's finalizer, running late
    assert server._busy.get("c3") is new
    server._release("c3", new)
