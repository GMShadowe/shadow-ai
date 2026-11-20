import struct

import pytest

from memory import long_term

VECTORS = {
    "I live in Pune": [1.0, 0.0, 0.0],
    "My dog is called Bruno": [0.0, 1.0, 0.0],
    "I prefer tea": [0.6, 0.8, 0.0],
    "where do I live?": [0.9, 0.1, 0.0],
    "I live in Pune, India": [0.99, 0.01, 0.0],
}


@pytest.fixture
def memory(monkeypatch):
    calls = []
    monkeypatch.setattr(long_term, "_embed", lambda text: calls.append(text) or VECTORS[text])
    long_term.init()
    return calls


def test_search_ranks_by_meaning_and_drops_weak_matches(memory):
    for fact in ("I live in Pune", "My dog is called Bruno", "I prefer tea"):
        assert long_term.add(fact)
    assert long_term.search("where do I live?") == ["I live in Pune", "I prefer tea"]


def test_a_near_duplicate_is_not_stored_twice(memory):
    assert long_term.add("I live in Pune")
    assert not long_term.add("I live in Pune, India")
    assert long_term.count() == 1


def test_no_memories_means_no_embedding_call(memory):
    assert long_term.search("where do I live?") == []
    assert memory == []


def test_a_memory_from_another_embedder_does_not_break_search(memory):
    long_term.add("I live in Pune")
    with long_term._db() as conn:
        conn.execute("INSERT INTO memories VALUES ('old', 'old fact', ?, 'user', 'then')",
                     (struct.pack("2f", 1.0, 0.0),))
    assert long_term.search("where do I live?") == ["I live in Pune"]
