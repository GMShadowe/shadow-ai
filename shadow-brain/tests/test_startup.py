import os
import stat

import pytest

import settings


@pytest.mark.skipif(os.name == "nt", reason="POSIX permissions")
def test_the_data_folder_is_made_private(data_dir):
    os.chmod(data_dir, 0o755)
    settings.secure_data_dir()
    assert stat.S_IMODE(os.stat(data_dir).st_mode) == 0o700


def test_importing_the_server_touches_nothing(data_dir, monkeypatch):
    import sys
    sys.modules.pop("server", None)
    import auth
    monkeypatch.setattr(auth, "_cached", None)
    import server  # noqa: F401
    assert not (data_dir / "auth_token").exists()
    assert not (data_dir / "assistants").exists()


def test_startup_runs_when_the_app_starts(client, data_dir):
    assert (data_dir / "auth_token").exists()
    assert client.get("/health").json()["ok"]
