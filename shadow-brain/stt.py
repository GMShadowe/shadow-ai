"""Speech to text, entirely on this computer.

Whisper (faster-whisper) turns an utterance into text. The model is loaded
once and kept resident — loading per utterance would add half a second to
every turn for nothing.

Nothing is sent anywhere. The one exception is the first run, when the
model weights are downloaded from Hugging Face, the same way Ollama pulls
a model. Offline mode blocks that, and says so.

The browser decides when the user stopped talking, because only it can do
that without a round trip per 30ms of audio. Silero runs here as the
second opinion: whisper invents text when given silence ("Thank you." is
its favourite), so an utterance with no speech in it is rejected before
it ever reaches whisper.

Audio arrives as a plain 16-bit WAV, decoded here with the standard
library. faster-whisper's own decoder is bypassed on purpose: it needs
PyAV, and PyAV 19 removed a keyword it still passes.
"""

import io
import os
import re
import threading
import time
import wave

import numpy as np

SAMPLE_RATE = 16000
# Measured on Indian-English speech (three en_IN voices, ten Shadow-style
# requests, background noise added), word error rate and time per clip:
#   tiny.en          9.4%   6.7s  - loops on noisy audio until it hits the cap
#   base.en          6.4%   0.30s
#   base.en, beam 5 + VOCABULARY prompt   4.7%   0.33s   <- this
#   small.en, same   5.4%   1.1s
#   large-v3-turbo, same   3.4%   5.7s  - too slow on CPU for a voice turn
# The prompt did more than a bigger model: it is what turned "a him about"
# into "Ahmedabad" and "Kune" into "Pune". SHADOW_WHISPER overrides the size.
MODEL_SIZE = os.environ.get("SHADOW_WHISPER", "base.en")
BEAM_SIZE = 5
# Words whisper should expect. Everything here is already on this computer;
# the prompt is never sent anywhere.
BASE_VOCABULARY = ["Shadow", "workspace", "Python", "JavaScript", "React", "folder", "file"]
MAX_VOCABULARY = 40
MAX_SECONDS = 60
MIN_SECONDS = 0.2
# Silero keeps a little air around each phrase so whisper hears the edges.
SPEECH_PAD = 0.2

_model = None
_vad = None
_vad_tried = False
_lock = threading.Lock()  # one utterance at a time, so timings stay honest


class SttError(Exception):
    """Something the user needs to read. The message is shown as-is."""


class NoSpeech(SttError):
    """The recording held no speech — silence, or a knocked microphone."""


def _install_hint() -> str:
    return ("Speech to text isn't installed. In shadow-brain, run: "
            "pip install faster-whisper silero-vad")


def available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False


def model_cached() -> bool:
    """True when the weights are already on disk, so no download is needed."""
    from huggingface_hub.constants import HF_HUB_CACHE
    name = MODEL_SIZE if "/" in MODEL_SIZE else f"Systran/faster-whisper-{MODEL_SIZE}"
    folder = "models--" + name.replace("/", "--")
    return os.path.isdir(os.path.join(HF_HUB_CACHE, folder))


def loaded() -> bool:
    return _model is not None


def load():
    """Loads the model once and keeps it. Raises SttError with something
    worth reading if it can't."""
    global _model
    if _model is not None:
        return _model

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        raise SttError(_install_hint())

    from settings import get_settings
    if get_settings().get("offline") and not model_cached():
        raise SttError(
            f"Offline mode is on, and the speech model ({MODEL_SIZE}) hasn't been "
            "downloaded yet. Turn offline mode off in Settings - Privacy for the "
            "first run, then turn it back on.")

    started = time.time()
    first_run = not model_cached()
    if first_run:
        print(f"[stt] downloading the {MODEL_SIZE} model (one time, ~150MB)…")
    try:
        # int8 on CPU: the whole model is ~40MB in memory and fast enough that
        # transcription is never the thing a user waits for.
        _model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    except Exception as e:
        raise SttError(f"Couldn't load the speech model ({MODEL_SIZE}): {e}")
    print(f"[stt] {MODEL_SIZE} ready in {time.time() - started:.1f}s")
    return _model


def _vad_model():
    """Silero, if it's installed. Missing is survivable — say so once and
    carry on with an energy check instead of failing the feature."""
    global _vad, _vad_tried
    if _vad_tried:
        return _vad
    _vad_tried = True
    try:
        from silero_vad import load_silero_vad
        _vad = load_silero_vad()
        print("[stt] silero-vad ready")
    except Exception as e:
        print(f"[stt] silero-vad unavailable ({e}); falling back to a loudness check")
        _vad = None
    return _vad


def decode_wav(data: bytes) -> tuple[np.ndarray, int]:
    """16-bit PCM WAV bytes to mono float32. Raises SttError on anything else."""
    if not data:
        # Nothing captured belongs with the other "say it again" cases, not with
        # the "something is broken" ones.
        raise NoSpeech("No audio arrived. Tap the mic and speak, then wait for it to stop.")
    try:
        with wave.open(io.BytesIO(data)) as w:
            channels, width, rate = w.getnchannels(), w.getsampwidth(), w.getframerate()
            frames = w.readframes(w.getnframes())
    except wave.Error as e:
        raise SttError(f"That audio isn't a WAV file Shadow can read: {e}")

    if width != 2:
        raise SttError(f"Shadow expects 16-bit audio, got {width * 8}-bit.")
    audio = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)
    return audio, rate


def resample(audio: np.ndarray, rate: int) -> np.ndarray:
    """Linear resample to 16kHz. Plenty for speech, and no new dependency."""
    if rate == SAMPLE_RATE or audio.size == 0:
        return audio
    count = int(round(audio.size * SAMPLE_RATE / rate))
    if count <= 1:
        return np.zeros(0, dtype=np.float32)
    source = np.linspace(0, audio.size - 1, count, dtype=np.float32)
    return np.interp(source, np.arange(audio.size, dtype=np.float32), audio).astype(np.float32)


def trim_to_speech(audio: np.ndarray) -> np.ndarray:
    """Cuts the recording down to the parts with speech in them, and raises
    NoSpeech if there are none."""
    vad = _vad_model()
    if vad is None:
        # No silero: a plain loudness check. Crude, but it still stops whisper
        # being handed two seconds of room tone.
        if float(np.sqrt(np.mean(np.square(audio)))) < 0.004:
            raise NoSpeech("I didn't hear anything. Tap the mic and speak a little louder.")
        return audio

    import torch
    from silero_vad import get_speech_timestamps
    stamps = get_speech_timestamps(torch.from_numpy(audio), vad, sampling_rate=SAMPLE_RATE)
    if not stamps:
        raise NoSpeech("I didn't catch any speech in that. Tap the mic and try again.")

    pad = int(SPEECH_PAD * SAMPLE_RATE)
    start = max(0, stamps[0]["start"] - pad)
    end = min(audio.size, stamps[-1]["end"] + pad)
    return audio[start:end]


def _proper_nouns(text: str) -> list[str]:
    """Capitalised words that aren't just starting the sentence: the names
    of people and places, which is what an accent most often trips on."""
    words = re.findall(r"[A-Za-z][A-Za-z'-]+", text)
    return [w for i, w in enumerate(words) if i > 0 and w[0].isupper() and w.lower() not in ("i", "user")]


def vocabulary(aid: str | None = None) -> str:
    """The prompt whisper is primed with: the assistant's name, the user's
    location, and the names in what it remembers. Failing to build it is
    survivable - transcription just loses the hint - so it says why and
    carries on."""
    words = list(BASE_VOCABULARY)
    try:
        from assistants import get_profile
        from memory import long_term
        profile = get_profile(aid)
        words[:0] = [profile.get("name") or "Shadow"]
        if profile.get("location"):
            words.append(profile["location"].strip().title())
        for memory in long_term.all_memories():
            words.extend(_proper_nouns(memory["text"]))
    except Exception as e:
        print(f"[stt] couldn't build the vocabulary hint, transcribing without it: {e}")
    seen, out = set(), []
    for w in words:
        if w and w.lower() not in seen:
            seen.add(w.lower())
            out.append(w)
    return ", ".join(out[:MAX_VOCABULARY]) + "."


def transcribe(data: bytes) -> dict:
    """WAV bytes in, text out. Everything that can go wrong raises SttError
    with a sentence the user can act on."""
    audio, rate = decode_wav(data)
    seconds = audio.size / rate if rate else 0.0
    if seconds < MIN_SECONDS:
        raise NoSpeech("That was too short to hear. Hold on a moment longer before you stop.")
    if seconds > MAX_SECONDS:
        raise SttError(f"That recording is {seconds:.0f} seconds long; the limit is {MAX_SECONDS}.")

    audio = resample(audio, rate)
    speech = trim_to_speech(audio)

    model = load()
    prompt = vocabulary()
    started = time.time()
    with _lock:
        segments, _info = model.transcribe(
            speech,
            beam_size=BEAM_SIZE,    # beam 5 cost ~10% more time than greedy here
            language="en",
            vad_filter=False,       # silero already did it, above
            condition_on_previous_text=False,
            initial_prompt=prompt,
        )
        text = " ".join(s.text.strip() for s in segments).strip()
    took = int((time.time() - started) * 1000)

    if not text:
        raise NoSpeech("I heard something but couldn't make out any words. Try again?")
    print(f"[stt] {seconds:.1f}s of audio -> {took}ms -> {text!r}")
    return {
        "text": text,
        "seconds": round(seconds, 2),
        "ms": took,
        "model": MODEL_SIZE,
    }


def status() -> dict:
    """What the UI and the privacy report need to know, without loading anything."""
    return {
        "available": available(),
        "model": MODEL_SIZE,
        "cached": model_cached() if available() else False,
        "loaded": loaded(),
        "hint": None if available() else _install_hint(),
    }
