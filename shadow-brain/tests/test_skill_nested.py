import json

import pytest

import netguard
import skills

SKILL = b"---\nname: wait-what\ndescription: Pause and ask.\n---\nStop and ask what the user means.\n"
TREE = {"truncated": False, "tree": [
    {"type": "blob", "path": "README.md"},
    {"type": "blob", "path": "skills/productivity/wait-what/SKILL.md"},
    {"type": "blob", "path": "skills/engineering/tdd/SKILL.md"},
    {"type": "blob", "path": "docs/productivity/wait-what.md"},
]}


@pytest.fixture
def github(monkeypatch):
    tried = []

    def request(method, url, **kw):
        tried.append(url)
        if url.startswith("https://api.github.com/"):
            return netguard.Response(200, url, {"content-type": "application/json"}, json.dumps(TREE).encode())
        if url.endswith("skills/productivity/wait-what/SKILL.md"):
            return netguard.Response(200, url, {"content-type": "text/plain"}, SKILL)
        return netguard.Response(404, url, {}, b"")

    monkeypatch.setattr(netguard, "request", request)
    return tried


def test_a_skill_nested_in_a_category_folder_is_found(github):
    text, url = skills.fetch("npx skills add mattpocock/skills --skill wait-what")
    assert url == "https://raw.githubusercontent.com/mattpocock/skills/HEAD/skills/productivity/wait-what/SKILL.md"
    assert "Stop and ask" in text
    assert sum(u.startswith("https://api.github.com/") for u in github) == 1


def test_a_missing_skill_lists_what_the_repo_has(github):
    with pytest.raises(skills.SkillError, match="It has: tdd, wait-what"):
        skills.fetch("npx skills add mattpocock/skills --skill nope")


def test_a_repo_of_many_skills_asks_which_one(github):
    with pytest.raises(skills.SkillError, match="--skill <name>. It has: tdd, wait-what"):
        skills.fetch("mattpocock/skills")


def test_the_file_list_goes_through_netguard_too(monkeypatch):
    def request(method, url, **kw):
        if url.startswith("https://api.github.com/"):
            raise netguard.Blocked("not a public address")
        return netguard.Response(404, url, {}, b"")

    monkeypatch.setattr(netguard, "request", request)
    with pytest.raises(skills.SkillError, match="won't fetch"):
        skills.fetch("npx skills add a/b --skill x")
