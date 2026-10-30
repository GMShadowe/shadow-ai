"""#10: run_command inherited the brain's whole environment (provider keys
included) and could read Shadow's data folder - the BYOK key and the auth
token - with ../shadow-brain/data/. The file tools could too, whenever the
workspace contained the Shadow checkout."""

import platform

import pytest

import settings
from tools import files, registry, shell


@pytest.fixture
def workspace(tmp_path, data_dir):
    ws = tmp_path / "ws"
    ws.mkdir()
    settings.update_settings({"workspace": str(ws)})
    (data_dir / "custom_models.json").write_text('{"key": "sk-secret"}')
    return ws


def test_commands_do_not_inherit_the_brains_environment(workspace, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-leak")
    monkeypatch.setenv("SHADOW_UI_ORIGIN", "x")
    out = shell.run_command("env")
    assert "sk-leak" not in out and "SHADOW_UI_ORIGIN" not in out
    assert "PATH=" in out  # but a command can still find programs


@pytest.mark.skipif(platform.system() != "Darwin", reason="sandbox-exec is macOS only")
def test_commands_cannot_read_or_write_the_data_folder(workspace, data_dir):
    out = shell.run_command(f"cat {data_dir}/custom_models.json; echo x > {data_dir}/planted")
    assert "sk-secret" not in out and "Operation not permitted" in out
    assert not (data_dir / "planted").exists()
    # Ordinary work in the workspace is unaffected.
    assert "hello" in shell.run_command("echo hello > a.txt && cat a.txt")


def test_file_tools_refuse_the_data_folder_even_inside_the_workspace(tmp_path, data_dir):
    # A workspace that contains the Shadow checkout, data folder included.
    settings.update_settings({"workspace": str(tmp_path)})
    with pytest.raises(ValueError, match="data folder"):
        files.read_file("data/custom_models.json")
    result = registry.call_tool("read_file", {"path": "data/custom_models.json"})
    assert result.startswith("Error:") and "data folder" in result and "bug" not in result


def test_the_approval_card_says_the_shell_is_unrestricted():
    text = registry.preview("run_command", {"command": "ls"})
    assert "full access" in text and "not a sandbox" in text
