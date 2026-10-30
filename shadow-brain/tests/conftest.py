import os
import sys

import pytest

BRAIN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BRAIN not in sys.path:
    sys.path.insert(0, BRAIN)


def pytest_collection_finish(session):
    # Importing server touches the real data folder before the redirects run.
    if "server" in sys.modules:
        raise pytest.UsageError("A test module imports server at the top level. Import it inside "
                                "the test, or use the client fixture, so it sees the test data folder.")


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    import assistants
    import auth
    import custom
    import feedback
    import orchestrator
    import settings
    import usage
    from tools import files

    data = tmp_path / "data"
    data.mkdir()
    monkeypatch.setattr(assistants, "ASSISTANTS_DIR", str(data / "assistants"))
    monkeypatch.setattr(assistants, "STATE_PATH", str(data / "active_assistant.txt"))
    monkeypatch.setattr(auth, "TOKEN_PATH", str(data / "auth_token"))
    monkeypatch.setattr(custom, "PATH", str(data / "custom_models.json"))
    monkeypatch.setattr(feedback, "PATH", str(data / "feedback.json"))
    monkeypatch.setattr(orchestrator, "LOG_PATH", str(data / "turns.jsonl"))
    monkeypatch.setattr(settings, "SETTINGS_PATH", str(data / "settings.json"))
    monkeypatch.setattr(usage, "PATH", str(data / "byok_usage.json"))
    monkeypatch.setattr(files, "BACKUP_DIR", str(data / "backups"))
    monkeypatch.setattr(files, "DATA_DIR", str(data))
    from tools import shell
    monkeypatch.setattr(shell, "DATA_DIR", str(data))
    import skills
    monkeypatch.setattr(skills, "ADDED_DIR", str(data / "skills"))
    settings.update_settings({"router": "keywords"})
    return data


@pytest.fixture
def client(data_dir):
    from fastapi.testclient import TestClient

    import auth
    import server

    saved_token = auth._cached
    auth._cached = None
    server.sessions.clear()
    import storage
    from memory import long_term
    storage.init()
    long_term.init()
    with TestClient(server.app, base_url="http://127.0.0.1:8765",
                    headers={auth.HEADER: auth.token()}) as c:
        yield c
    auth._cached = saved_token
    server.sessions.clear()
