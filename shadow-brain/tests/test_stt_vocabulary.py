import stt
from memory import long_term


def test_names_from_memory_and_profile_prime_whisper(data_dir, monkeypatch):
    import assistants
    assistants.update_profile({"name": "Nova", "location": "ahmedabad"})
    monkeypatch.setattr(long_term, "all_memories", lambda: [
        {"text": "User's cousin Priyanka lives in Bengaluru"},
        {"text": "Prefers tabs over spaces"},
    ])
    prompt = stt.vocabulary()
    assert prompt.startswith("Nova, Shadow,")
    for word in ("Ahmedabad", "Priyanka", "Bengaluru"):
        assert word in prompt
    assert "Prefers" not in prompt and "User's" not in prompt


def test_a_broken_memory_store_only_loses_the_hint(data_dir, monkeypatch, capsys):
    def broken():
        raise RuntimeError("memory.db is locked")

    monkeypatch.setattr(long_term, "all_memories", broken)
    prompt = stt.vocabulary()
    assert "Shadow" in prompt
    assert "memory.db is locked" in capsys.readouterr().out


def test_the_hint_is_capped(data_dir, monkeypatch):
    monkeypatch.setattr(long_term, "all_memories", lambda: [
        {"text": "Met " + " ".join(f"N{a}{b}" for a in "abcdefghij" for b in "abcdefghij")}])
    assert len(stt.vocabulary().split(", ")) == stt.MAX_VOCABULARY
