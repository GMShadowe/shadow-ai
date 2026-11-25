"""delete_dir returned None without deleting anything from the first release
on, and the model read the empty result as success: "Done. The build folder
has been deleted." with the folder still there."""
import os

import pytest

from tools import files


@pytest.fixture
def workspace(tmp_path, monkeypatch):
    monkeypatch.setattr(files, "get_workspace", lambda: str(tmp_path))
    monkeypatch.setattr(files, "DATA_DIR", str(tmp_path / "elsewhere" / "data"))
    return tmp_path


def test_it_deletes_the_folder_and_says_so(workspace):
    (workspace / "build" / "out").mkdir(parents=True)
    (workspace / "build" / "out" / "a.o").write_text("x")
    result = files.delete_dir("build")
    assert result == "Deleted the folder build and everything in it."
    assert not (workspace / "build").exists()


def test_it_refuses_the_workspace_itself(workspace):
    assert files.delete_dir(".").startswith("Error: refusing")
    assert workspace.exists()


def test_it_refuses_a_folder_that_holds_shadows_data(workspace, monkeypatch):
    data = workspace / "project" / "shadow-brain" / "data"
    data.mkdir(parents=True)
    monkeypatch.setattr(files, "DATA_DIR", str(data))
    assert "Shadow's own data folder" in files.delete_dir("project")
    assert data.exists()


def test_a_missing_folder_is_an_error(workspace):
    assert files.delete_dir("nope").startswith("Error:")


def test_a_path_outside_is_refused(workspace):
    with pytest.raises(files.PathRefused):
        files.delete_dir("../x")


def test_a_tool_that_returns_nothing_is_reported_as_broken(monkeypatch):
    from tools import registry
    monkeypatch.setitem(registry.TOOLS["delete_dir"], "fn", lambda path: None)
    result = registry.call_tool("delete_dir", {"path": "build"})
    assert result.startswith("Internal error in Shadow's delete_dir tool: it returned nothing")
