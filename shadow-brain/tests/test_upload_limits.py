def test_an_oversized_body_is_refused_before_it_is_read(client, monkeypatch):
    import server
    monkeypatch.setattr(server, "MAX_BODY_BYTES", 1000)
    r = client.post("/chat/stream", content=b"x" * 2000, headers={"content-type": "application/json"})
    assert r.status_code == 413 and "too large" in r.json()["detail"]


def test_an_oversized_recording_is_refused(client, monkeypatch):
    import server
    import stt
    monkeypatch.setattr(server, "MAX_AUDIO_BYTES", 1000)
    monkeypatch.setattr(stt, "transcribe", lambda data: {"text": "should not run"})
    r = client.post("/stt", content=b"x" * 2000)
    assert r.status_code == 413


def test_a_streamed_recording_is_capped_without_a_length(client, monkeypatch):
    import server
    import stt
    monkeypatch.setattr(server, "MAX_AUDIO_BYTES", 1000)
    monkeypatch.setattr(stt, "transcribe", lambda data: {"text": "should not run"})
    r = client.post("/stt", content=(b"x" * 500 for _ in range(4)))
    assert r.status_code == 413


def test_a_normal_recording_reaches_whisper(client, monkeypatch):
    import stt
    monkeypatch.setattr(stt, "transcribe", lambda data: {"text": f"{len(data)} bytes"})
    r = client.post("/stt", content=b"x" * 100)
    assert r.json() == {"text": "100 bytes"}
