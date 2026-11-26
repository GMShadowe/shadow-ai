"""Asked which city, the user said "ahmedabad" and got "the weather isn't
available here": only the profile's location was ever looked up."""
import time

import awareness
from assistants import update_profile
from awareness import weather_place


def test_a_place_named_with_the_question():
    assert weather_place("whats the weather in Pune") == "Pune"
    assert weather_place("weather in new york today?") == "new york"
    assert weather_place("will it rain in Mumbai tomorrow") == "Mumbai"
    assert weather_place("weather for tomorrow") is None
    assert weather_place("whats the weather") is None


def test_a_city_given_as_the_answer():
    assert weather_place("ahmedabad", previous="whats the weather") == "ahmedabad"
    assert weather_place("yes", previous="whats the weather") is None
    assert weather_place("ahmedabad", previous="hi") is None
    assert weather_place("i was thinking about something else", previous="whats the weather") is None


def test_the_named_place_is_looked_up(monkeypatch):
    update_profile({"location": ""})
    monkeypatch.setattr(awareness, "_weather_cache", {"ahmedabad": {"at": time.time(), "text": "Haze +22°C"}})
    monkeypatch.setattr(awareness, "_weather_fetching", set())
    facts = awareness.turn_facts(message="ahmedabad", previous="whats the weather", profile=None)
    assert "Weather in ahmedabad: Haze +22°C." in facts
    assert awareness.NO_LOCATION not in facts
