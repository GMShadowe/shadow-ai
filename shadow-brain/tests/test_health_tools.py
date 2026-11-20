import json
import types

import settings
from adapters.registry import get_adapter
from router.classifier import _explicit_routes
from router.keywords import classify_keywords
from tools import health
from tools.registry import TOOLS, call_tool


def make_lib(monkeypatch):
    class HealthError(Exception):
        pass

    calls = []
    lib = types.SimpleNamespace(
        HealthError=HealthError,
        today=lambda: calls.append("today") or {"date": "2026-11-20", "today": {"steps": 1024}},
        hourly=lambda hours, errors: calls.append(("hourly", hours)) or [{"hour": "11:00", "steps": 649, "hr_avg": None}],
        _clean=lambda rows: [{k: v for k, v in r.items() if v is not None} for r in rows],
    )
    monkeypatch.setattr(health, "_fh", lib)
    return lib, calls


def test_every_health_tool_is_registered_and_in_the_adapter():
    adapter = get_adapter("health")
    assert adapter is not None
    for name in adapter["tools"]:
        assert name in TOOLS


def test_today_returns_compact_json(monkeypatch):
    _, calls = make_lib(monkeypatch)
    out = call_tool("health_today", {})
    assert json.loads(out)["today"]["steps"] == 1024
    assert calls == ["today"]


def test_hours_are_clamped_and_empty_fields_dropped(monkeypatch):
    _, calls = make_lib(monkeypatch)
    out = json.loads(call_tool("health_hourly", {"hours": "9999"}))
    assert calls == [("hourly", 168)]
    assert out["hours"] == [{"hour": "11:00", "steps": 649}]


def test_api_errors_reach_the_model_in_plain_words(monkeypatch):
    lib, _ = make_lib(monkeypatch)

    def boom():
        raise lib.HealthError("Not signed in to Google Health.")
    lib.today = boom
    assert call_tool("health_today", {}) == "Error: Not signed in to Google Health."


def test_offline_mode_blocks_health_calls(monkeypatch):
    _, calls = make_lib(monkeypatch)
    settings.update_settings({"offline": True})
    assert call_tool("health_today", {}) == health.OFFLINE
    assert calls == []


def test_missing_health_project_is_reported(monkeypatch, tmp_path):
    monkeypatch.setattr(health, "_fh", None)
    monkeypatch.setattr(health, "HEALTH_DIR", str(tmp_path / "nowhere"))
    assert "aren't set up" in call_tool("health_today", {})


def test_health_questions_route_to_the_health_adapter():
    assert "health" in _explicit_routes("How did I sleep last night?")
    assert "health" in _explicit_routes("what's my resting HR and heart rate today")
    assert classify_keywords("how many steps did i do") == "health"
    assert "health" not in _explicit_routes("search the web for python news")
