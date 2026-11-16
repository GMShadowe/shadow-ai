import sys
import types

from router import laya_router


def test_laya_device_reaches_the_loader(monkeypatch):
    calls = []
    fake = types.ModuleType("laya")
    fake.load = lambda repo, **kw: calls.append(kw) or object()
    monkeypatch.setitem(sys.modules, "laya", fake)
    monkeypatch.setattr(laya_router, "_agent", None)
    monkeypatch.setattr(laya_router, "cached_snapshot", lambda: None)
    monkeypatch.setenv("LAYA_DEVICE", "cpu")

    laya_router.load()

    assert calls[0]["device"] == "cpu"
