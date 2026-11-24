import providers
import settings
from memory.short_term import ShortTermMemory
from tests.helpers import call, quiet_turn


def _events(text):
    from orchestrator import stream_turn
    return list(stream_turn(text, ShortTermMemory()))


def test_a_model_that_isnt_loaded_says_so_before_the_wait(monkeypatch):
    quiet_turn(monkeypatch, "Hi!")
    monkeypatch.setattr(providers, "is_loaded", lambda name: False)
    events = _events("hello")
    kinds = [e["type"] for e in events]
    assert {"type": "status", "text": "Loading the model"} in events
    assert kinds.index("status") < kinds.index("token")


def test_a_loaded_model_says_nothing(monkeypatch):
    quiet_turn(monkeypatch, "Hi!")
    assert not [e for e in _events("hello") if e["type"] == "status"]


def test_the_turn_carries_its_step_budget_and_cool_mode(monkeypatch):
    import model
    monkeypatch.setattr(model.time, "sleep", lambda s: None)
    settings.update_settings({"cool_mode": True})
    quiet_turn(monkeypatch, [call("about_me", {})], "Done.")
    events = _events("tell me about yourself")
    route = next(e for e in events if e["type"] == "route")
    assert route["cool"] is True and route["steps"] <= 12
    assert {"type": "status", "text": "Resting a moment to stay cool"} in events
    done = events[-1]
    assert done["cool"] is True and done["timing"]["steps"] >= 0
