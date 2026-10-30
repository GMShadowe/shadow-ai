"""#27: fact extraction always asked Ollama for the profile's model, which
for a BYOK model doesn't exist there, and swallowed the error - so
"remember" and auto-memory did nothing for BYOK users."""

import pytest

import usage
from memory import extract
from providers import Chunk, Msg

BYOK = {"tier": "byok:test", "kind": "byok", "custom": True, "label": "Test",
        "base_model": "gpt-test", "base_url": "https://api.example.com/v1",
        "host": "api.example.com", "key": "sk-test", "tools": True}


@pytest.fixture
def byok(monkeypatch):
    monkeypatch.setattr(extract, "load_tier_config", lambda tier=None: dict(BYOK))

    def no_ollama(**kwargs):
        raise AssertionError(f"asked Ollama for {kwargs.get('model')}")

    monkeypatch.setattr(extract.ollama, "chat", no_ollama)


def test_byok_extraction_goes_to_the_provider(byok, monkeypatch):
    sent = []

    def fake_stream(cfg, messages, schemas, temperature):
        sent.append(cfg["base_model"])
        yield Chunk(Msg(content='["Uses vim"]'))
        yield Chunk(Msg(), usage={"prompt": 40, "completion": 5})

    monkeypatch.setattr(extract.providers, "openai_stream", fake_stream)

    assert extract.extract_facts("remember that I use vim", "byok:test") == ["Uses vim"]
    assert sent == ["gpt-test"]
    # The extra call is billed to the user, so it is counted like any other.
    assert usage.today_total("byok:test") == 45


def test_a_failed_extraction_says_why(byok, monkeypatch, capsys):
    def broken(cfg, messages, schemas, temperature):
        raise RuntimeError("401 bad key")
        yield  # pragma: no cover

    monkeypatch.setattr(extract.providers, "openai_stream", broken)

    assert extract.extract_facts("remember that I use vim") == []
    assert "401 bad key" in capsys.readouterr().out


def test_local_models_still_use_ollama(monkeypatch):
    asked = []

    class Resp:
        class message:
            content = '["Prefers tabs"]'

    monkeypatch.setattr(extract.ollama, "chat", lambda **kw: asked.append(kw["model"]) or Resp)
    facts = extract.extract_facts("remember I prefer tabs", "default")
    assert facts == ["Prefers tabs"] and asked == ["qwen3.5:4b"]
