import pytest

import skills
import storage

BUILD_TASTE = "---\nname: build-taste\ndescription: Collect references on a canvas.\n---\nRun the canvas.\n"


@pytest.fixture
def build_taste(data_dir):
    skills.install(BUILD_TASTE, source="test")
    skills.approve("build-taste", skills.load("build-taste")["sha256"])


@pytest.mark.parametrize("text", ["yeah run the build-taste skill and open it", "use the build taste skill",
                                  "run the skill called build-taste", "ok now /build-taste please"])
def test_a_skill_named_in_words_is_found(build_taste, text):
    assert skills.named_in(text) == "build-taste"


@pytest.mark.parametrize("text", ["review my code", "summarize this article", "build taste for my app",
                                  "add the build-taste skill", "install skills from anthropics/skills",
                                  "look in data/skills/build-taste"])
def test_ordinary_words_and_skill_management_load_nothing(build_taste, text):
    assert skills.named_in(text) is None


def test_the_skill_means_the_one_just_used(build_taste):
    assert skills.named_in("use the skill and open the site for me", "build-taste") == "build-taste"
    assert skills.named_in("use the skill and open the site for me") is None
    assert skills.named_in("open the site for me", "build-taste") is None
    assert skills.named_in("use the skill", "deleted-since") is None


def test_the_last_skill_is_read_from_the_chat(data_dir):
    storage.init()
    storage.ensure_conversation("c1", "use this")
    storage.add_message("c1", "user", "/build-taste")
    storage.add_message("c1", "assistant", "Started.", {"skill": "build-taste"})
    storage.add_message("c1", "user", "thanks")
    storage.add_message("c1", "assistant", "Sure.", {"skill": None})
    assert storage.last_skill("c1") == "build-taste"
    assert storage.last_skill("c1", within=2) is None


def test_a_message_naming_a_skill_runs_with_it(build_taste, client, monkeypatch):
    import server
    seen = []
    monkeypatch.setattr(server, "_stream_turn_response",
                        lambda cid, text, memory, model, effort, images, skill, *a: seen.append(skill) or {"ok": True})
    r = client.post("/chat/stream", json={"conversation_id": "c2", "message": "run the build-taste skill"})
    assert r.status_code == 200 and seen == ["build-taste"]


def test_a_named_skill_still_needs_its_review(data_dir, client):
    skills.install(BUILD_TASTE, source="https://example.com/SKILL.md")
    r = client.post("/chat/stream", json={"conversation_id": "c3", "message": "run the build-taste skill"})
    assert r.status_code == 403 and "hasn't been reviewed" in r.json()["detail"]
