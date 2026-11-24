import os

from providers import Call, Chunk, Msg


def redirect_data(data: str, setattr=setattr) -> None:
    """Point every module-level data path at `data`. Shared by the test
    fixture and the eval runner, so neither can write into the real folder."""
    import assistants
    import auth
    import custom
    import feedback
    import orchestrator
    import settings
    import skills
    import usage
    from tools import files, shell

    setattr(assistants, "ASSISTANTS_DIR", os.path.join(data, "assistants"))
    setattr(assistants, "STATE_PATH", os.path.join(data, "active_assistant.txt"))
    setattr(auth, "TOKEN_PATH", os.path.join(data, "auth_token"))
    setattr(custom, "PATH", os.path.join(data, "custom_models.json"))
    setattr(feedback, "PATH", os.path.join(data, "feedback.json"))
    setattr(orchestrator, "LOG_PATH", os.path.join(data, "turns.jsonl"))
    setattr(settings, "SETTINGS_PATH", os.path.join(data, "settings.json"))
    setattr(usage, "PATH", os.path.join(data, "byok_usage.json"))
    setattr(files, "BACKUP_DIR", os.path.join(data, "backups"))
    setattr(files, "DATA_DIR", data)
    setattr(shell, "DATA_DIR", data)
    setattr(skills, "ADDED_DIR", os.path.join(data, "skills"))


def call(name: str, arguments) -> Call:
    return Call(function=Call.Function(name=name, arguments=arguments))


def scripted(*steps):
    queue = list(steps)
    seen = []

    def fake(model, messages, schemas, temperature, provider=None):
        seen.append([dict(m) for m in messages])
        step = queue.pop(0) if queue else "done"
        if isinstance(step, str):
            return iter([Chunk(Msg(content=step))])
        return iter([Chunk(Msg(tool_calls=step))])

    fake.seen = seen
    return fake


def quiet_turn(monkeypatch, *steps, facts=None):
    import model
    from memory import extract, long_term

    fake = scripted(*steps)
    saved = []
    monkeypatch.setattr(model, "_chat_stream", fake)
    monkeypatch.setattr(long_term, "search", lambda q, k=5, aid=None: [])
    monkeypatch.setattr(long_term, "add", lambda text, source="user", aid=None: saved.append((text, source)) or True)
    monkeypatch.setattr(extract, "extract_facts", lambda text, tier=None: list(facts or []))
    return fake, saved
