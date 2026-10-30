"""#4: clicking a file chip ran `open` / `xdg-open` / `cmd /c start` on any
workspace file, and the model can write .command, .bat or .desktop files,
which those handlers execute."""

import os
import subprocess

import pytest

import settings


@pytest.fixture
def workspace(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    settings.update_settings({"workspace": str(ws)})
    return ws


@pytest.fixture
def ran(monkeypatch):
    calls = []

    class Done:
        returncode, stderr = 0, ""

    monkeypatch.setattr(subprocess, "run", lambda cmd, **k: calls.append(cmd) or Done)
    return calls


def _server():
    import server
    return server


@pytest.mark.parametrize("name", ["run.command", "setup.bat", "x.desktop", "deploy.sh", "tool", "a.py"])
def test_anything_runnable_is_revealed_not_opened(client, workspace, ran, monkeypatch, name):
    monkeypatch.setattr(_server().platform, "system", lambda: "Darwin")
    (workspace / name).write_text("echo pwned")
    r = client.post("/open-file", json={"path": name})
    assert r.status_code == 200 and r.json()["revealed"] is True
    assert ran == [["open", "-R", str(workspace / name)]]


def test_documents_still_open(client, workspace, ran, monkeypatch):
    monkeypatch.setattr(_server().platform, "system", lambda: "Darwin")
    (workspace / "index.html").write_text("<p>hi</p>")
    r = client.post("/open-file", json={"path": "index.html"})
    assert r.json()["revealed"] is False and ran == [["open", str(workspace / "index.html")]]


def test_an_app_bundle_is_revealed(client, workspace, ran, monkeypatch):
    monkeypatch.setattr(_server().platform, "system", lambda: "Darwin")
    (workspace / "Evil.app").mkdir()
    assert client.post("/open-file", json={"path": "Evil.app"}).json()["revealed"] is True


def test_windows_never_uses_cmd(client, workspace, ran, monkeypatch):
    server = _server()
    monkeypatch.setattr(server.platform, "system", lambda: "Windows")
    started = []
    monkeypatch.setattr(server.os, "startfile", started.append, raising=False)
    (workspace / "notes & calc.txt").write_text("x")
    (workspace / "evil.bat").write_text("x")
    client.post("/open-file", json={"path": "notes & calc.txt"})
    client.post("/open-file", json={"path": "evil.bat"})
    assert started == [str(workspace / "notes & calc.txt")]
    assert ran == [["explorer", f"/select,{workspace / 'evil.bat'}"]]
    assert not any("cmd" in c for c in ran)
