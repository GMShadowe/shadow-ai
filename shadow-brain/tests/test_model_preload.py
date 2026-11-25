import threading

import providers


class FakeClient:
    def __init__(self, loaded):
        self.loaded = loaded
        self.chats = []
        self.done = threading.Event()

    def ps(self):
        class Model:
            def __init__(self, name):
                self.model = name

        class Listing:
            models = [Model(n) for n in self.loaded]
        return Listing

    def chat(self, **kwargs):
        self.chats.append(kwargs)
        self.done.set()


def test_a_loaded_model_is_left_alone(monkeypatch):
    client = FakeClient(["qwen3.5:4b"])
    monkeypatch.setattr(providers, "_ollama_client", client)
    assert providers.preload("qwen3.5:4b") == "loaded"
    assert client.chats == []


def test_an_unloaded_model_is_loaded_with_the_chat_options(monkeypatch):
    client = FakeClient([])
    monkeypatch.setattr(providers, "_ollama_client", client)
    assert providers.preload("qwen3.5:4b") == "loading"
    assert client.done.wait(2)
    call = client.chats[0]
    assert call["messages"] == [] and call["options"]["num_ctx"] == providers.NUM_CTX
    assert call["keep_alive"] == providers.KEEP_ALIVE


def test_byok_is_never_preloaded(client, monkeypatch):
    import server
    monkeypatch.setattr(server, "load_tier_config", lambda name=None: {"kind": "byok", "base_model": "gpt"})
    assert server._warm_model() == "not used"
