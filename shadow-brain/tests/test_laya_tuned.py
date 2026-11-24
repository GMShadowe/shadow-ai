"""A Laya fine-tuned with laya-train/ is used when installed, and only while
its files match the digests install.py recorded."""
import hashlib
import json
import sys
import types

from router import laya_router


def fake_laya(monkeypatch):
    calls = []
    fake = types.ModuleType("laya")
    fake.load = lambda source, **kw: calls.append((source, kw)) or object()
    monkeypatch.setitem(sys.modules, "laya", fake)
    monkeypatch.setattr(laya_router, "_agent", None)
    monkeypatch.setattr(laya_router, "cached_snapshot", lambda: "/pinned")
    return calls


def install(folder, content=b"weights"):
    folder.mkdir()
    (folder / "model.safetensors").write_bytes(content)
    (folder / "installed.json").write_text(json.dumps(
        {"sha256": {"model.safetensors": hashlib.sha256(b"weights").hexdigest()}}))


def test_the_pinned_laya_without_a_tuned_one(monkeypatch):
    calls = fake_laya(monkeypatch)
    laya_router.load()
    assert calls[0][0] == "/pinned"


def test_an_installed_tuned_laya_is_preferred(monkeypatch, data_dir):
    calls = fake_laya(monkeypatch)
    install(data_dir / "laya")
    laya_router.load()
    assert calls[0][0] == str(data_dir / "laya")


def test_a_changed_tuned_laya_falls_back_to_the_pinned_one(monkeypatch, data_dir, capsys):
    calls = fake_laya(monkeypatch)
    install(data_dir / "laya", content=b"something else")
    laya_router.load()
    assert calls[0][0] == "/pinned"
    assert "changed since it was installed" in capsys.readouterr().out
