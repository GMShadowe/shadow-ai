import greetings
from memory import long_term

BYOK = {"tier": "byok:test", "kind": "byok", "base_model": "gpt-test", "label": "Test"}


def _facts(monkeypatch):
    monkeypatch.setattr(long_term, "all_memories", lambda: [{"text": "Lives in Mumbai"}])


def test_byok_greetings_stay_local(data_dir, monkeypatch):
    _facts(monkeypatch)
    monkeypatch.setattr(greetings, "load_tier_config", lambda tier=None: dict(BYOK))

    def no_model(**kwargs):
        raise AssertionError(f"asked a model for greetings: {kwargs.get('model')}")

    monkeypatch.setattr(greetings.ollama, "chat", no_model)
    assert set(greetings.greetings()) <= set(greetings.GENERIC)


def test_local_models_still_personalize(data_dir, monkeypatch):
    _facts(monkeypatch)
    asked = []

    class Resp:
        class message:
            content = '["Hey, how is Mumbai?"]'

    monkeypatch.setattr(greetings.ollama, "chat", lambda **kw: asked.append(kw["model"]) or Resp)
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
