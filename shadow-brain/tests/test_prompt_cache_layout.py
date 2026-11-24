from memory.short_term import ShortTermMemory
from orchestrator import handle_turn
from tests.helpers import quiet_turn


def test_the_next_turn_starts_with_what_the_last_one_sent(monkeypatch):
    fake, _ = quiet_turn(monkeypatch, "Hello!", "Sure.")
    memory = ShortTermMemory()

    handle_turn("hi there", memory)
    handle_turn("which city am i in, and what time is it?", memory)

    first, second = fake.seen[0], fake.seen[1]
    assert second[0] == first[0]
    assert [m["role"] for m in second] == ["system", "user", "assistant", "system", "user"]
    assert second[1:3] == [{"role": "user", "content": "hi there"}, {"role": "assistant", "content": "Hello!"}]


def test_the_turn_note_is_never_kept_in_the_history(monkeypatch):
    fake, _ = quiet_turn(monkeypatch, "Hello!")
    memory = ShortTermMemory()
    handle_turn("hi there", memory)
    assert all(m["role"] != "system" for m in memory.get())


def test_byok_keeps_a_single_system_prompt():
    from orchestrator import assemble
    question = {"role": "user", "content": "q"}
    out = assemble("stable", "turn", [], question, [], split=False)
    assert out == [{"role": "system", "content": "stable\n\nturn"}, question]


def test_short_term_memory_is_trimmed_a_few_turns_at_a_time():
    memory = ShortTermMemory(max_turns=10)
    starts = []
    for i in range(30):
        memory.add("user", f"q{i}")
        memory.add("assistant", f"a{i}")
        starts.append(memory.get()[0]["content"])
    changes = sum(1 for a, b in zip(starts, starts[1:]) if a != b)
    assert changes <= 30 // 3
    assert len(memory.get()) <= 24
