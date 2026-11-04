"""Text to speech, entirely on this computer.

Piper turns a sentence of the reply into a WAV the voice screen plays. The
voice is loaded once and kept resident: loading takes ~0.6s, a sentence
then takes ~0.1-0.3s for several seconds of audio on an M-series Mac, so
the UI can ask for one sentence at a time while the model is still writing
the next.

Nothing is sent anywhere. The one exception is the first run, when the
voice is downloaded from Hugging Face, pinned to one revision and checked
against its sha256 like Laya. Offline mode blocks that, and says so.
"""

import hashlib
import io
import os
import re
import threading
import time
import wave

VOICE_REPO = "rhasspy/piper-voices"
VOICE_REVISION = "e7229f7d33a10e145e109b886d661984201ac3c4"
VOICE_NAME = "en_US-lessac-medium"
VOICE_FILES = {
    "en/en_US/lessac/medium/en_US-lessac-medium.onnx":
        "5efe09e69902187827af646e1a6e9d269dee769f9877d17b16b1b46eeaaf019f",
    "en/en_US/lessac/medium/en_US-lessac-medium.onnx.json":
        "efe19c417bed055f2d69908248c6ba650fa135bc868b0e6abb3da181dab690a0",
}
MAX_CHARS = 600

_voice = None
_lock = threading.Lock()


class TtsError(Exception):
    """Something the user needs to read. The message is shown as-is."""


def _install_hint() -> str:
    return "Text to speech isn't installed. In shadow-brain, run: pip install piper-tts"


def available() -> bool:
    try:
        import piper  # noqa: F401
        return True
    except ImportError:
        return False


def _cached_path(filename: str) -> str | None:
    from huggingface_hub import hf_hub_download
    try:
        return hf_hub_download(VOICE_REPO, filename, revision=VOICE_REVISION, local_files_only=True)
    except Exception:
        return None


def model_cached() -> bool:
    return all(_cached_path(f) for f in VOICE_FILES)


def loaded() -> bool:
    return _voice is not None


def _sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            digest.update(block)
    return digest.hexdigest()


def _fetch() -> str:
    """Downloads the voice if it isn't here yet, checks every file, and
    returns the model's path."""
    from huggingface_hub import hf_hub_download
    paths = {}
    for filename, expected in VOICE_FILES.items():
        try:
            path = hf_hub_download(VOICE_REPO, filename, revision=VOICE_REVISION)
        except Exception as e:
            raise TtsError(f"Couldn't download the voice ({VOICE_NAME}): {e}")
        if _sha256(path) != expected:
            raise TtsError(
                f"The downloaded voice file {os.path.basename(path)} doesn't match the one "
                "Shadow was built with, so it won't be used. Delete it from "
                "~/.cache/huggingface and try again.")
        paths[filename] = path
    return next(p for f, p in paths.items() if f.endswith(".onnx"))


def load():
    """Loads the voice once and keeps it. Raises TtsError with something
    worth reading if it can't."""
    global _voice
    if _voice is not None:
        return _voice

    try:
        from piper import PiperVoice
    except ImportError:
        raise TtsError(_install_hint())

    from settings import get_settings
    if get_settings().get("offline") and not model_cached():
        raise TtsError(
            f"Offline mode is on, and the voice ({VOICE_NAME}) hasn't been downloaded "
            "yet. Turn offline mode off in Settings - Privacy for the first run, then "
            "turn it back on.")

    with _lock:
        if _voice is not None:
            return _voice
        started = time.time()
        if not model_cached():
            print(f"[tts] downloading the {VOICE_NAME} voice (one time, ~60MB)…")
        path = _fetch()
        try:
            _voice = PiperVoice.load(path)
        except Exception as e:
            raise TtsError(f"Couldn't load the voice ({VOICE_NAME}): {e}")
        print(f"[tts] {VOICE_NAME} ready in {time.time() - started:.1f}s")
    return _voice


def speakable(text: str) -> str:
    """What a reply sounds like read aloud: no markdown, no raw links.
    Voice replies are asked for plain sentences, but a small model still
    slips in a bullet or a URL now and then."""
    text = re.sub(r"```.*?```", " ", text, flags=re.S)
    text = re.sub(r"!?\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"https?://\S+", "a link", text)
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"^\s{0,3}(#{1,6}|[-*+]|\d+[.)])\s+", "", text, flags=re.M)
    text = re.sub(r"(\*\*|__|\*|_|~~)(\S.*?\S|\S)\1", r"\2", text)
    return re.sub(r"\s+", " ", text).strip()


def speak(text: str) -> bytes:
    """Text in, a 16-bit mono WAV out. Raises TtsError with a sentence the
    user can act on."""
    text = speakable(text)
    if not re.search(r"\w", text):
        raise TtsError("There was nothing to say.")
    if len(text) > MAX_CHARS:
        raise TtsError(f"That is {len(text)} characters; Shadow speaks at most {MAX_CHARS} at a time.")

    voice = load()
    started = time.time()
    with _lock:
        chunks = list(voice.synthesize(text))
    if not chunks:
        raise TtsError("The voice produced no audio for that text.")

    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(chunks[0].sample_rate)
        for c in chunks:
            w.writeframes(c.audio_int16_bytes)
    seconds = sum(c.audio_float_array.size for c in chunks) / chunks[0].sample_rate
    print(f"[tts] {len(text)} chars -> {seconds:.1f}s of audio in {int((time.time() - started) * 1000)}ms")
    return out.getvalue()


def status() -> dict:
    """What the UI and the privacy report need to know, without loading anything."""
    ready = available()
    return {
        "available": ready,
        "voice": VOICE_NAME,
        "cached": model_cached() if ready else False,
        "loaded": loaded(),
        "hint": None if ready else _install_hint(),
    }
