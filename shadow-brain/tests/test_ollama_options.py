import greetings
import providers
from memory import extract, long_term


class FakeClient:
    def __init__(self):
        self.calls = []

    def chat(self, **kwargs):
        self.calls.append(kwargs)

        class Resp:
            class message:
                content = '["Hello there"]'
        return Resp


def test_every_chat_call_sends_the_same_context_and_keep_alive(data_dir, monkeypatch):
    client = FakeClient()
    monkeypatch.setattr(providers, "_ollama_client", client)
    monkeypatch.setattr(long_term, "all_memories", lambda: [{"text": "Lives in Pune"}])

    providers.ollama_stream("qwen3.5:4b", [{"role": "user", "content": "hi"}], None, None)
    extract.extract_facts("remember that I use vim", "default")
    greetings.greetings()

    assert len(client.calls) == 3
    assert {c["options"]["num_ctx"] for c in client.calls} == {providers.NUM_CTX}
    assert {c["keep_alive"] for c in client.calls} == {providers.KEEP_ALIVE}
