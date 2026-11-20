import os

import pytest

from settings import _check_workspace


@pytest.fixture
def home(tmp_path, monkeypatch):
    monkeypatch.setenv("HOME", str(tmp_path))
    return tmp_path


def _make(home, *parts):
    path = home.joinpath(*parts)
    path.mkdir(parents=True)
    return str(path)


def test_an_ordinary_folder_inside_home_is_accepted(home):
    path = _make(home, "projects", "site")
    assert _check_workspace(path) == os.path.realpath(path)


@pytest.mark.parametrize("parts", [(".ssh",), (".config", "app"), ("code", ".git"), ("Library", "Mail")])
def test_sensitive_folders_inside_home_are_refused(home, parts):
    with pytest.raises(ValueError):
        _check_workspace(_make(home, *parts))


def test_a_folder_outside_home_is_refused(home, tmp_path_factory):
    outside = tmp_path_factory.mktemp("elsewhere")
    with pytest.raises(ValueError, match="outside"):
        _check_workspace(str(outside))


def test_system_folders_are_refused(home):
    with pytest.raises(ValueError):
        _check_workspace("/etc")
