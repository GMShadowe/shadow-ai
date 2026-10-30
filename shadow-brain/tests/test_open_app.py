import os

import pytest

from tools import desktop
from tools.registry import TOOLS
from tools.state import tool_state


def test_open_app_asks_by_default():
    assert TOOLS["open_app"]["danger"] == "caution"
    assert tool_state("open_app", {"tools": {}}) == "ask"


@pytest.mark.parametrize("name", ["/tmp/evil.sh", "..\\\\evil.bat", "./run", "-e", "", "Notes\nrm"])
def test_paths_and_options_are_not_app_names(monkeypatch, name):
    launched = []
    monkeypatch.setattr(desktop.subprocess, "run", lambda *a, **k: launched.append(a))
    monkeypatch.setattr(desktop.subprocess, "Popen", lambda *a, **k: launched.append(a))
    assert desktop.open_app(name).startswith("Error")
    assert launched == []


def test_windows_never_goes_through_cmd(monkeypatch, tmp_path):
    programs = tmp_path / "Microsoft" / "Windows" / "Start Menu" / "Programs" / "Accessories"
    programs.mkdir(parents=True)
    (programs / "Notepad.lnk").write_text("")
    monkeypatch.setattr(desktop.platform, "system", lambda: "Windows")
    monkeypatch.setenv("APPDATA", str(tmp_path))
    monkeypatch.delenv("PROGRAMDATA", raising=False)
    started, popen = [], []
    monkeypatch.setattr(desktop.os, "startfile", started.append, raising=False)
    monkeypatch.setattr(desktop.subprocess, "Popen", lambda *a, **k: popen.append(a))

    assert desktop.open_app("notepad") == "Opened notepad."
    assert started == [str(programs / "Notepad.lnk")]
    assert desktop.open_app("calc & del C:\\\\x").startswith("Error")  # no such shortcut
    assert popen == []


def test_linux_only_launches_programs_found_by_name(monkeypatch):
    monkeypatch.setattr(desktop.platform, "system", lambda: "Linux")
    launched = []
    monkeypatch.setattr(desktop.subprocess, "Popen", lambda args, **k: launched.append(args))
    monkeypatch.setattr(desktop.shutil, "which", lambda n: f"/usr/bin/{n}" if n == "gedit" else None)
    assert desktop.open_app("gedit") == "Opened gedit."
    assert desktop.open_app("/home/me/workspace/evil").startswith("Error")
    assert launched == [["gedit"]]


def test_the_ui_is_told_each_tools_default(client):
    tools = {t["name"]: t for t in client.get("/settings").json()["tools"]}
    assert tools["open_app"]["default"] == "ask" and tools["read_file"]["default"] == "on"
