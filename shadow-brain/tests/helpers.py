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
