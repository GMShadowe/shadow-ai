import assistants
import awareness
from memory import long_term


def test_the_memory_count_is_the_pinned_assistants(data_dir, monkeypatch):
    first = assistants.active_id()
    other = assistants.create("Nova")["id"]
    stored = {first: 0, other: 7}
    monkeypatch.setattr(long_term, "count", lambda aid=None: stored[aid or assistants.active_id()])

    assistants.set_active(other)
    block = awareness.compact(profile=assistants.get_profile(first))

    assert "remember 7" not in block
