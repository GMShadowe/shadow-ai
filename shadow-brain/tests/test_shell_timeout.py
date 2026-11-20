import os
import time

import pytest

import settings
from tools import shell


@pytest.fixture
def workspace(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    settings.update_settings({"workspace": str(ws)})
    return ws


@pytest.mark.skipif(os.name == "nt", reason="uses a POSIX shell")
def test_a_timeout_stops_what_the_command_started_in_the_background(workspace, monkeypatch):
    monkeypatch.setattr(shell, "TIMEOUT_S", 1)
    out = shell.run_command("(sleep 3; touch survived) & sleep 30")
    assert "timed out" in out
    time.sleep(3.5)
    assert not (workspace / "survived").exists()


def test_a_quick_command_still_reports_output_and_exit_code(workspace):
    out = shell.run_command("echo hello")
    assert out.startswith("hello") and "[exit code 0]" in out
