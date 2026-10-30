"""Small fakes shared by the tests: a scripted model stream, so a turn can
run without Ollama, and the chunk shapes model.py reads."""

from providers import Call, Chunk, Msg


def call(name: str, arguments) -> Call:
    return Call(function=Call.Function(name=name, arguments=arguments))


def scripted(*steps):
    """A stand-in for model._chat_stream. Each step is either a reply string
    or a list of tool calls; one step is consumed per request, and the
    messages each request saw are kept for the test to inspect."""
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
    """Run orchestrator turns with the model, embeddings and fact extraction
    faked out. Returns (model fake, list of memories saved)."""
    import model
    from memory import extract, long_term

    fake = scripted(*steps)
    saved = []
    monkeypatch.setattr(model, "_chat_stream", fake)
    monkeypatch.setattr(long_term, "search", lambda q, k=5: [])
    monkeypatch.setattr(long_term, "add", lambda text, source="user": saved.append((text, source)) or True)
    monkeypatch.setattr(extract, "extract_facts", lambda text, tier=None: list(facts or []))
    return fake, saved
