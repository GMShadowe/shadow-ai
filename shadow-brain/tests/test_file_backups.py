"""#14: write_file and edit_file default to on but can destroy content as
surely as delete_file, which asks - write_file with empty content is a
delete. The version they replace is now kept as a backup."""

import os

import pytest

import settings
from tools import files


@pytest.fixture
def workspace(tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    settings.update_settings({"workspace": str(ws)})
    return ws


def _backups():
    return sorted(os.listdir(files.BACKUP_DIR)) if os.path.isdir(files.BACKUP_DIR) else []


def test_overwriting_keeps_the_old_version(workspace):
    (workspace / "notes.txt").write_text("precious")
    result = files.write_file("notes.txt", "")
    assert (workspace / "notes.txt").read_text() == ""
    (backup,) = _backups()
    assert backup in result and backup.endswith("notes.txt")
    path = os.path.join(files.BACKUP_DIR, backup)
    assert open(path).read() == "precious"
    assert os.stat(path).st_mode & 0o777 == 0o600


def test_editing_keeps_the_old_version(workspace):
    (workspace / "a.py").write_text("x = 1\n")
    result = files.edit_file("a.py", "x = 1", "x = 2")
    assert "previous version was kept" in result
    (backup,) = _backups()
    assert open(os.path.join(files.BACKUP_DIR, backup)).read() == "x = 1\n"


def test_a_new_file_or_identical_content_makes_no_backup(workspace):
    files.write_file("new.txt", "hello")
    assert "nothing was changed" in files.write_file("new.txt", "hello")
    assert _backups() == []


def test_backups_are_pruned(workspace, monkeypatch):
    monkeypatch.setattr(files, "MAX_BACKUPS", 3)
    for i in range(6):
        files.write_file("f.txt", f"version {i}")
    assert len(_backups()) == 3


def test_backups_are_outside_the_workspace(workspace):
    (workspace / "a.txt").write_text("old")
    files.write_file("a.txt", "new")
    assert not os.path.realpath(files.BACKUP_DIR).startswith(os.path.realpath(workspace))


def test_backups_are_listed_in_the_privacy_report(client, workspace):
    (workspace / "a.txt").write_text("old")
    files.write_file("a.txt", "new")
    rows = {r["id"]: r for r in client.get("/privacy").json()["storage"]}
    assert "1 earlier version" in rows["backups"]["detail"] and rows["backups"]["bytes"] == 3
