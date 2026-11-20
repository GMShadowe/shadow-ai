import os
import socket
import time

import pytest

import settings
from tools import desktop, registry, shell

pytestmark = pytest.mark.skipif(os.name == "nt", reason="uses a POSIX shell")


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    ws = tmp_path / "ws"
    ws.mkdir()
    settings.update_settings({"workspace": str(ws)})
    monkeypatch.setattr(shell, "STARTUP_S", 1)
    yield ws
    shell.stop_all()


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def test_a_server_keeps_running_and_says_where(workspace):
    port = _free_port()
    out = shell.run_command(f"python3 -u -m http.server {port} --bind 127.0.0.1", background=True)
    assert "still running in the background" in out
    assert f"port {port}" in out
    with socket.create_connection(("127.0.0.1", port), timeout=2):
        pass


def test_a_trailing_ampersand_means_background(workspace):
    out = shell.run_command("echo up; sleep 30 &")
    assert "still running in the background" in out
    assert "up" in out


def test_a_command_that_exits_at_once_says_so(workspace):
    out = shell.run_command("echo bye; exit 3", background="true")
    assert out.startswith("bye")
    assert "stopped within 1 seconds" in out and "exit code 3" in out
    assert not shell._background


def test_kill_process_stops_the_whole_group(workspace):
    out = shell.run_command("(sleep 2; touch survived) & sleep 30", background=True)
    pid = int(out.split("as process ")[1].split(".")[0])
    assert "Shadow started in the background" in desktop.describe_kill(str(pid))
    assert "Stopped" in desktop.kill_process(str(pid))
    time.sleep(2.5)
    assert not (workspace / "survived").exists()
    assert shell.started(pid) is None


def test_the_approval_card_says_it_keeps_running(workspace):
    assert "keeps running" in registry.preview("run_command", {"command": "npm run dev", "background": True})
    assert "keeps running" in registry.preview("run_command", {"command": "npm run dev &"})
    assert "keeps running" not in registry.preview("run_command", {"command": "ls"})


def test_a_command_never_waits_on_input(workspace):
    out = shell.run_command("read line; echo got:$line")
    assert "got:" in out and "[exit code 0]" in out


def test_background_commands_are_capped(workspace, monkeypatch):
    monkeypatch.setattr(shell, "MAX_BACKGROUND", 1)
    shell.run_command("sleep 30", background=True)
    assert "already running in the background" in shell.run_command("sleep 30", background=True)
