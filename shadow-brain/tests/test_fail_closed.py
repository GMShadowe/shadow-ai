import json
import os

import pytest

import assistants
import settings
from tools.state import offline, tool_state


def _profile_path(aid):
    return os.path.join(assistants.ASSISTANTS_DIR, aid, "profile.json")


def test_run_command_asks_when_the_profile_does_not_say():
    assert tool_state("run_command", {"tools": {}}) == "ask"
    assert tool_state("run_command", {"tools": {"run_command": "on"}}) == "on"


def test_a_damaged_profile_is_an_error_not_the_defaults():
    aid = assistants.active_id()
    assistants.update_profile({"tools": {"write_file": "off"}})
    with open(_profile_path(aid), "w") as f:
        f.write('{"tools": {"write_file": "of')  # a write cut off part-way
    with pytest.raises(assistants.ProfileError, match="damaged"):
        assistants.get_profile(aid)
    with pytest.raises(assistants.ProfileError):
        tool_state("write_file")


def test_damaged_settings_never_mean_offline_is_off():
    settings.update_settings({"offline": True})
    with open(settings.SETTINGS_PATH, "w") as f:
        f.write("{not json")
    with pytest.raises(settings.SettingsError, match="damaged"):
        offline()


def test_profile_writes_are_atomic(monkeypatch):
    aid = assistants.active_id()
    assistants.update_profile({"name": "Before"})

    def crash(*args, **kwargs):
        raise OSError("disk full")

    # Scoped: undo() would also undo conftest's data folder redirect.
    with monkeypatch.context() as m:
        m.setattr(assistants.json, "dump", crash)
        with pytest.raises(OSError):
            assistants.update_profile({"name": "After"})
    with open(_profile_path(aid)) as f:
        assert json.load(f)["name"] == "Before"
    assert sorted(os.listdir(os.path.dirname(_profile_path(aid)))) == ["images", "profile.json"]


def test_the_api_says_which_file_is_damaged(client):
    aid = assistants.active_id()
    with open(_profile_path(aid), "w") as f:
        f.write("{")
    r = client.get("/settings")
    assert r.status_code == 500 and "damaged" in r.json()["detail"]
