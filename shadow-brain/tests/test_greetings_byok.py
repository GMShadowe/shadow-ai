import pytest

import greetings
from memory import long_term


@pytest.fixture(autouse=True)
def fresh_greetings():
    greetings._made.clear()

BYOK = {"tier": "byok:test", "kind": "byok", "base_model": "gpt-test", "label": "Test"}


def _facts(monkeypatch):
    monkeypatch.setattr(long_term, "all_memories", lambda: [{"text": "Lives in Mumbai"}])


def test_byok_greetings_stay_local(data_dir, monkeypatch):
    _facts(monkeypatch)
    monkeypatch.setattr(greetings, "load_tier_config", lambda tier=None: dict(BYOK))

    def no_model(model, *args, **kwargs):
        raise AssertionError(f"asked a model for greetings: {model}")

    monkeypatch.setattr(greetings.providers, "ollama_chat", no_model)
    assert set(greetings.greetings()) <= set(greetings.GENERIC)


def test_local_models_still_personalize(data_dir, monkeypatch):
    _facts(monkeypatch)
    asked = []

    class Resp:
        class message:
            content = '["Hey, how is Mumbai?"]'

    monkeypatch.setattr(greetings.providers, "ollama_chat", lambda model, *a, **kw: asked.append(model) or Resp)
    out = [greetings.greetings() for _ in range(20)]
    assert asked and asked[0] == "qwen3.5:4b"
    assert any("Hey, how is Mumbai?" in g for g in out)


def test_a_missing_model_falls_back(data_dir, monkeypatch, capsys):
    _facts(monkeypatch)

    def gone(tier=None):
        raise ValueError("The model 'byok:x' isn't in your list any more.")

    monkeypatch.setattr(greetings, "load_tier_config", gone)
    assert set(greetings.greetings()) <= set(greetings.GENERIC)
    assert "isn't in your list" in capsys.readouterr().out


def test_greetings_are_made_once_until_the_memories_change(data_dir, monkeypatch):
    import greetings as g
    facts = [{"text": "Lives in Mumbai"}]
    monkeypatch.setattr(long_term, "all_memories", lambda: list(facts))
    asked = []

    class Resp:
        class message:
            content = '["Hey there"]'

    monkeypatch.setattr(g.providers, "ollama_chat", lambda model, *a, **kw: asked.append(model) or Resp)
    g.greetings()
    g.greetings()
    assert len(asked) == 1
    facts.append({"text": "Plays chess"})
    g.greetings()
    assert len(asked) == 2
