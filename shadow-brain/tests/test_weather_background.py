import threading
import time

import pytest

import awareness


@pytest.fixture
def lookups(monkeypatch):
    monkeypatch.setattr(awareness, "_weather_cache", {})
    monkeypatch.setattr(awareness, "_weather_fetching", set())
    calls, release = [], threading.Event()

    def fake_fetch(location):
        calls.append(location)
        release.wait(5)
        with awareness._weather_lock:
            awareness._weather_cache[location] = {"at": time.time(), "text": f"Sunny in {location}"}
            awareness._weather_fetching.discard(location)

    monkeypatch.setattr(awareness, "_fetch_weather", fake_fetch)
    yield calls, release
    release.set()


def _settle():
    for _ in range(100):
        if not awareness._weather_fetching:
            return
        time.sleep(0.01)


def test_a_slow_lookup_does_not_hold_up_the_prompt(lookups):
    calls, release = lookups
    started = time.time()
    assert awareness._weather("Pune") is None
    assert time.time() - started < 0.5
    release.set()
    _settle()
    assert awareness._weather("Pune") == "Sunny in Pune"
    assert calls == ["Pune"]


def test_a_new_location_gets_its_own_weather(lookups):
    calls, release = lookups
    release.set()
    awareness._weather("Pune")
    _settle()
    awareness._weather("Delhi")
    _settle()
    assert awareness._weather("Delhi") == "Sunny in Delhi"


def test_a_failed_lookup_is_not_retried_every_turn(monkeypatch):
    monkeypatch.setattr(awareness, "_weather_cache", {"Pune": {"at": time.time(), "text": None}})
    monkeypatch.setattr(awareness, "_weather_fetching", set())
    started = []
    monkeypatch.setattr(awareness, "_fetch_weather", lambda loc: started.append(loc))
    assert awareness._weather("Pune") is None
    assert started == []
