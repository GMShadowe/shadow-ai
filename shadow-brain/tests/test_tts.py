import io
import wave

import numpy as np
import pytest

import tts


class FakeChunk:
    sample_rate = 22050

    def __init__(self, seconds):
        self.audio_float_array = np.zeros(int(self.sample_rate * seconds), dtype=np.float32)
        self.audio_int16_bytes = b"\x00\x00" * self.audio_float_array.size


class FakeVoice:
    def __init__(self):
        self.said = []

    def synthesize(self, text):
        self.said.append(text)
        return [FakeChunk(0.5), FakeChunk(0.25)]


@pytest.fixture
def voice(monkeypatch):
    fake = FakeVoice()
    monkeypatch.setattr(tts, "_voice", fake)
    return fake


def test_markdown_and_links_are_not_read_aloud():
    said = tts.speakable("## Steps\n- Open **Settings**\n- See [the docs](https://x.dev/a) or https://y.dev/b\n`ls -la`")
    assert said == "Steps Open Settings See the docs or a link ls -la"


def test_a_sentence_becomes_one_wav(voice):
    data = tts.speak("Hang on, let me look that up.")
    with wave.open(io.BytesIO(data)) as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, 22050)
        assert w.getnframes() == int(22050 * 0.5) + int(22050 * 0.25)
    assert voice.said == ["Hang on, let me look that up."]


def test_nothing_to_say_is_an_error_not_silence(voice):
    with pytest.raises(tts.TtsError, match="nothing to say"):
        tts.speak("**  **")


def test_too_long_is_refused(voice):
    with pytest.raises(tts.TtsError, match="at most"):
        tts.speak("word " * 200)


def test_offline_mode_blocks_the_first_download(data_dir, monkeypatch):
    import settings
    monkeypatch.setattr(tts, "_voice", None)
    monkeypatch.setattr(tts, "model_cached", lambda: False)
    monkeypatch.setattr(tts, "_fetch", lambda: pytest.fail("must not download while offline"))
    settings.update_settings({"offline": True})
    with pytest.raises(tts.TtsError, match="Offline mode is on"):
        tts.load()


def test_a_voice_file_that_does_not_match_is_refused(monkeypatch, tmp_path):
    bad = tmp_path / "voice.onnx"
    bad.write_bytes(b"not the voice")
    import huggingface_hub
    monkeypatch.setattr(huggingface_hub, "hf_hub_download", lambda *a, **k: str(bad))
    with pytest.raises(tts.TtsError, match="doesn't match"):
        tts._fetch()


def test_the_endpoint_returns_audio(client, voice):
    r = client.post("/tts", json={"text": "Done."})
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/wav"
    assert r.content[:4] == b"RIFF"


def test_the_endpoint_explains_a_failure(client, voice):
    r = client.post("/tts", json={"text": ""})
    assert r.status_code == 503
    assert "nothing to say" in r.json()["detail"]


def test_the_voice_download_is_on_the_privacy_list(client):
    rows = client.get("/privacy").json()["outbound"]
    row = next(r for r in rows if r["id"] == "voice_model")
    assert row["host"] == "huggingface.co"
