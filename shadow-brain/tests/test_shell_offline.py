import platform

import pytest

import settings
from tools import shell


@pytest.fixture
def workspace(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    settings.update_settings({"workspace": str(ws), "offline": True})
    return ws


@pytest.mark.skipif(platform.system() != "Darwin", reason="sandbox-exec is macOS only")
def test_offline_commands_cannot_reach_the_network(workspace):
    out = shell.run_command(
        "python3 -c \"import socket; s=socket.socket(); s.settimeout(3); s.connect(('1.1.1.1', 443))\"")
    assert "Operation not permitted" in out
    assert "hello" in shell.run_command("echo hello")


def test_offline_commands_are_refused_where_nothing_can_block_the_network(workspace, monkeypatch):
    monkeypatch.setattr(shell, "_can_sandbox", lambda: False)
    assert shell.run_command("echo hi") == shell.OFFLINE_BLOCKED


def test_the_approval_card_says_offline_keeps_commands_local(workspace, monkeypatch):
    monkeypatch.setattr(shell, "_can_sandbox", lambda: True)
    assert "only this computer" in shell.describe()
