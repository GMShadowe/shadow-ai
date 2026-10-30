"""Shared setup for the brain's tests.

Every test runs against a throwaway data folder. The real one holds the
user's chats, memory, API keys and auth token, and no test may read or write
it - so every module-level path that points into data/ is redirected here,
before each test, whether or not that test looks like it touches storage.
"""

import os
import sys

import pytest

BRAIN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BRAIN not in sys.path:
    sys.path.insert(0, BRAIN)


@pytest.fixture(autouse=True)
def data_dir(tmp_path, monkeypatch):
    import assistants
    import auth
    import custom
    import feedback
    import orchestrator
    import settings
    import usage

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
    # Keyword routing, so no test ever loads Laya from Hugging Face.
    settings.update_settings({"router": "keywords"})
    return data
