
import os

import pytest

import netguard
import settings
import skills

GOOD = """---
name: Tidy Notes
description: Turns rough notes into a clean list.
tools: read_file
---
Read the file, then group the notes by topic.
"""


def test_install_from_text_uses_the_skills_own_name(data_dir):
    skill = skills.install(GOOD, filename="whatever.md", source="file: whatever.md")
    assert skill["name"] == "tidy-notes"
    assert skill["added"] is True and skill["source"] == "file: whatever.md"
    assert os.path.isfile(data_dir / "skills" / "tidy-notes" / "SKILL.md")
    assert skills.load("tidy-notes")["tools"] == ["read_file"]


def test_name_falls_back_to_the_file_name_but_not_to_SKILL():
    assert skills.install("Just do it well.", filename="My Helper.md", source="x")["name"] == "my-helper"
    with pytest.raises(skills.SkillError, match="doesn't say what it's called"):
        skills.install("Just do it well.", filename="SKILL.md", source="x")


@pytest.mark.parametrize("text, problem", [
    ("", "empty"),
    ("a\x00b", "isn't a text file"),
    ("x" * (skills.MAX_CHARS + 1), "over the"),
    ("---\nname: bad\ntools: launch_rockets\n---\nGo.", "don't exist"),
])
def test_bad_skills_are_refused_before_anything_is_written(data_dir, text, problem):
    with pytest.raises(skills.SkillError, match=problem):
        skills.install(text, name="bad", source="x")
    assert not os.path.exists(data_dir / "skills" / "bad")


def test_existing_name_needs_replace(data_dir):
    skills.install(GOOD, source="x")
    with pytest.raises(skills.SkillExists):
        skills.install(GOOD.replace("group", "sort"), source="x")
    skills.install(GOOD.replace("group", "sort"), source="y", replace=True)
    assert "sort the notes" in skills.load("tidy-notes")["content"]


def test_shipped_skills_cant_be_shadowed_or_removed():
    with pytest.raises(skills.SkillError, match="Shadow's own"):
        skills.install("Summarize differently.", name="summarize", source="x")
    with pytest.raises(skills.SkillError, match="Shadow's own"):
        skills.remove("summarize")


def test_remove_an_added_skill(data_dir):
    skills.install(GOOD, source="x")
    skills.remove("tidy-notes")
    assert not os.path.exists(data_dir / "skills" / "tidy-notes")
    assert all(s["name"] != "tidy-notes" for s in skills.list_skills())


@pytest.mark.parametrize("link, raw", [
    ("anishfn/build-taste", "https://raw.githubusercontent.com/anishfn/build-taste/HEAD/SKILL.md"),
    ("https://github.com/a/b", "https://raw.githubusercontent.com/a/b/HEAD/SKILL.md"),
    ("https://github.com/a/b/tree/main/skills/x", "https://raw.githubusercontent.com/a/b/main/skills/x/SKILL.md"),
    ("https://github.com/a/b/blob/main/x/SKILL.md", "https://raw.githubusercontent.com/a/b/main/x/SKILL.md"),
    ("https://example.com/skill.md", "https://example.com/skill.md"),
])
def test_github_page_links_become_raw_files(link, raw):
    assert skills.raw_url(link) == raw


def test_link_is_refused_in_offline_mode(monkeypatch):
    settings.update_settings({"offline": True})

    def never(*a, **k):
        raise AssertionError("offline mode let a request through")

    monkeypatch.setattr(netguard, "request", never)
    with pytest.raises(skills.SkillError, match="Offline mode"):
        skills.fetch("anishfn/build-taste")


def _fake(monkeypatch, **kw):
    seen = {}

    def request(method, url, **k):
        seen["url"] = url
        seen["max_bytes"] = k["max_bytes"]
        return netguard.Response(status=kw.get("status", 200), url=url,
                                 headers={"content-type": kw.get("ctype", "text/plain")},
                                 body=kw.get("body", GOOD.encode()), truncated=kw.get("truncated", False))

    monkeypatch.setattr(netguard, "request", request)
    return seen


def test_link_goes_through_netguard_with_a_cap(monkeypatch):
    seen = _fake(monkeypatch)
    text, url = skills.fetch("https://github.com/a/b")
    assert text == GOOD and seen["url"] == url == "https://raw.githubusercontent.com/a/b/HEAD/SKILL.md"
    assert seen["max_bytes"] <= skills.MAX_CHARS * 4 + 1


@pytest.mark.parametrize("kw, problem", [
    ({"status": 404}, "404"),
    ({"status": 500}, "answered 500"),
    ({"truncated": True}, "bigger than"),
    ({"ctype": "text/html", "body": b"<!doctype html><html></html>"}, "web page"),
])
def test_bad_downloads_say_why(monkeypatch, kw, problem):
    _fake(monkeypatch, **kw)
    with pytest.raises(skills.SkillError, match=problem):
        skills.fetch("https://example.com/s.md")


def test_blocked_addresses_are_reported(monkeypatch):
    def blocked(*a, **k):
        raise netguard.Blocked("127.0.0.1 is an address on this computer")

    monkeypatch.setattr(netguard, "request", blocked)
    with pytest.raises(skills.SkillError, match="won't fetch"):
        skills.fetch("http://127.0.0.1/skill.md")


def test_endpoints(client, monkeypatch):
    r = client.post("/skills", json={"content": GOOD, "filename": "notes.md"})
    assert r.status_code == 200 and r.json()["skill"]["name"] == "tidy-notes"
    assert client.post("/skills", json={"content": GOOD}).status_code == 409
    assert client.post("/skills", json={"content": GOOD, "url": "a/b"}).status_code == 400

    _fake(monkeypatch, body=GOOD.replace("Tidy Notes", "From Link").encode())
    r = client.post("/skills", json={"url": "a/b"})
    assert r.status_code == 200 and r.json()["skill"]["source"].startswith("https://raw.githubusercontent.com")

    names = {s["name"]: s for s in client.get("/skills").json()["skills"]}
    assert names["from-link"]["added"] and not names["summarize"]["added"]
    assert client.delete("/skills/from-link").status_code == 200
    assert client.delete("/skills/summarize").status_code == 400

    rows = {r["id"]: r for r in client.get("/privacy").json()["outbound"]}
    assert rows["skill_download"]["active"] is True


@pytest.mark.parametrize("pasted, first", [
    ("npx skills add anishfn/build-taste", "https://raw.githubusercontent.com/anishfn/build-taste/HEAD/SKILL.md"),
    ("npx -y skills@latest add https://github.com/a/b/tree/main/x", "https://raw.githubusercontent.com/a/b/main/x/SKILL.md"),
    ("pnpm dlx skills add a/b --skill pdf -a claude-code -y", "https://raw.githubusercontent.com/a/b/HEAD/skills/pdf/SKILL.md"),
    ("bunx skills add a/b -s=pdf", "https://raw.githubusercontent.com/a/b/HEAD/skills/pdf/SKILL.md"),
    ("skills add a/b/tools/x", "https://raw.githubusercontent.com/a/b/HEAD/tools/x/SKILL.md"),
])
def test_install_commands_are_read_not_run(pasted, first):
    assert skills.candidates(pasted)[0] == first


def test_command_without_a_source_is_refused():
    with pytest.raises(skills.SkillError, match="doesn't say where"):
        skills.candidates("npx skills add -y")


def test_skill_flag_tries_the_usual_folders_until_one_exists(monkeypatch):
    tried = []

    def request(method, url, **k):
        tried.append(url)
        found = url.endswith("/.claude/skills/pdf/SKILL.md")
        return netguard.Response(status=200 if found else 404, url=url,
                                 headers={"content-type": "text/plain"}, body=GOOD.encode() if found else b"")

    monkeypatch.setattr(netguard, "request", request)
    text, url = skills.fetch("npx skills add a/b --skill pdf")
    assert url.endswith("/.claude/skills/pdf/SKILL.md") and len(tried) == 2

    tried.clear()
    monkeypatch.setattr(netguard, "request", lambda m, u, **k: netguard.Response(404, u, {}, b""))
    with pytest.raises(skills.SkillError, match="Looked in"):
        skills.fetch("npx skills add a/b --skill nope")


def test_skill_flag_names_the_installed_skill(client, monkeypatch):
    _fake(monkeypatch)
    r = client.post("/skills", json={"url": "npx skills add a/b --skill pdf"})
    assert r.status_code == 200 and r.json()["skill"]["name"] == "pdf"
