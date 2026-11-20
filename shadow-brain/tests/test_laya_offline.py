import sys
import types

import pytest

import settings
from router import laya_router


@pytest.fixture
def fake_laya(monkeypatch):
    calls = []
    fake = types.ModuleType("laya")
    fake.load = lambda source, **kw: calls.append(source) or object()
    monkeypatch.setitem(sys.modules, "laya", fake)
    monkeypatch.setattr(laya_router, "_agent", None)
    return calls


def test_offline_mode_refuses_to_download_laya(fake_laya, monkeypatch):
    monkeypatch.setattr(laya_router, "cached_snapshot", lambda: None)
    settings.update_settings({"offline": True})
    with pytest.raises(RuntimeError, match="offline mode is on"):
        laya_router.load()
    assert fake_laya == []


def test_a_downloaded_laya_loads_from_disk_even_offline(fake_laya, monkeypatch):
    monkeypatch.setattr(laya_router, "cached_snapshot", lambda: "/cache/laya")
    settings.update_settings({"offline": True})
    laya_router.load()
    assert fake_laya == ["/cache/laya"]


def test_the_privacy_report_lists_the_laya_download(monkeypatch):
    import privacy
    monkeypatch.setattr(laya_router, "model_cached", lambda: False)
    row = next(r for r in privacy.outbound("/nope") if r["id"] == "router_model")
    assert row["host"] == "huggingface.co" and row["active"]
