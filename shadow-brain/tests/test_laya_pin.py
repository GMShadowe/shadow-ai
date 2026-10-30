import re
import sys
import types

from router import laya_router


def test_load_pins_a_commit_and_verifies_every_file(monkeypatch):
    calls = []
    fake = types.ModuleType("laya")
    fake.load = lambda repo, **kw: calls.append((repo, kw)) or object()
    monkeypatch.setitem(sys.modules, "laya", fake)
    monkeypatch.setattr(laya_router, "_agent", None)

    laya_router.load()

    (repo, kw), = calls
    assert repo == "convaiinnovations/laya"
    assert re.fullmatch(r"[0-9a-f]{40}", kw["revision"])
    digests = kw["expected_sha256"]
    assert "model.safetensors" in digests
    assert all(re.fullmatch(r"[0-9a-f]{64}", d) for d in digests.values())
