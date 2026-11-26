""""hows the weather" was answered with "I don't have access to current weather
data" twice over: with no location set nothing said why, and with one set the
first question after a restart arrived before the background lookup did."""
import threading
import time

import awareness
from assistants import update_profile


def test_no_location_says_to_ask_for_the_city():
    update_profile({"location": ""})
    assert awareness.NO_LOCATION in awareness.compact(message="hows the weather")
    assert awareness.NO_LOCATION not in awareness.compact(message="hi hru")


def test_the_first_weather_question_waits_for_the_lookup(monkeypatch):
    update_profile({"location": "Pune"})
    monkeypatch.setattr(awareness, "_weather_cache", {})
    monkeypatch.setattr(awareness, "_weather_fetching", set())

    def slow_fetch(location):
        time.sleep(0.3)
        with awareness._weather_lock:
            awareness._weather_cache[location] = {"at": time.time(), "text": "Sunny +31°C"}
            awareness._weather_fetching.discard(location)

    monkeypatch.setattr(awareness, "_fetch_weather", slow_fetch)
    assert "+31" in awareness.compact(message="hows the weather")


def test_other_messages_do_not_wait(monkeypatch):
    update_profile({"location": "Pune"})
    monkeypatch.setattr(awareness, "_weather_cache", {})
    monkeypatch.setattr(awareness, "_weather_fetching", set())
    release = threading.Event()
    monkeypatch.setattr(awareness, "_fetch_weather", lambda location: release.wait(5))
    started = time.time()
    awareness.compact(message="any restaurants near me?")
    release.set()
    assert time.time() - started < 0.5


def test_a_failed_lookup_is_said_plainly(monkeypatch):
    update_profile({"location": "Pune"})
    monkeypatch.setattr(awareness, "_weather_cache", {"Pune": {"at": time.time(), "text": None}})
    monkeypatch.setattr(awareness, "_weather_fetching", set())
    assert "couldn't get it" in awareness.compact(message="whats the weather")
