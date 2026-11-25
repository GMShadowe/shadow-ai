"""Read-only commands run without asking, so a model can look around the
workspace without an approval card per try. Everything else still asks."""
import os

import pytest

from tools import read_only


@pytest.fixture(autouse=True)
def workspace(tmp_path, monkeypatch):
    (tmp_path / "notes.md").write_text("hi\n")
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.py").write_text("print(1)\n")
    outside = tmp_path.parent / "outside-secret.txt"
    outside.write_text("secret\n")
    os.symlink(outside, tmp_path / "link.txt")
    monkeypatch.setattr(read_only, "get_workspace", lambda: str(tmp_path))
    return tmp_path


@pytest.mark.parametrize("command", [
    "ls -la", "ls src", "cat notes.md", "wc -l src/app.py", "wc -l *.py", "du -sh .", "df -h",
    "uptime", "uname -a", "sw_vers", "vm_stat", "ps aux", "ps aux | grep python", "lsof -i :59999",
    "file notes.md", "which python3", "python3 --version", "git --version", "find . -name '*.py'",
    "grep -rn hello .", "tree", "head -n 5 notes.md", "tail -n 20 notes.md", "sort notes.md | uniq",
    "ipconfig getifaddr en0", "ifconfig en0", "pmset -g batt", "unzip -l archive.zip",
    "tar -tzf a.tar.gz", "date", "date +%Y", "hostname", "sysctl hw.memsize", "top -l 1",
    "diskutil list", "find . -type f | wc -l",
])
def test_looking_runs_without_asking(command):
    assert read_only.is_read_only(command)


@pytest.mark.parametrize("command", [
    "rm notes.md", "touch x", "mkdir y", "cp notes.md b", "mv notes.md b", "python3 script.py",
    "node app.js", "git status", "git log", "sed -i '' s/a/b/ notes.md", "awk '{print}' notes.md",
    "ls; rm notes.md", "ls && rm notes.md", "ls || rm notes.md", "cat notes.md > copy.md",
    "cat < notes.md", "echo $(rm notes.md)", "echo `rm notes.md`", "ls &", "cat notes.md\nrm notes.md",
    "cat /etc/passwd", "cat ~/.ssh/id_rsa", "cat ../outside-secret.txt", "cat link.txt",
    "cat {notes.md,/etc/passwd}", "ls .*", "ls src/.*", "grep --file=/etc/passwd x", "grep -f/etc/passwd x",
    "find . -delete", "find . -exec rm {} ;", "find -L .", "sort -o out notes.md", "sort --output=o notes.md",
    "tail -f notes.md", "grep -R x .", "sysctl -w kern.x=1", "sysctl kern.x=1", "date 0101000026",
    "hostname evil", "ifconfig en0 down", "ipconfig set en0 DHCP", "pmset sleep 1", "tar -xzf a.tar.gz",
    "unzip archive.zip", "uniq notes.md out.md", "diskutil eraseDisk", "top", "tree -o out.txt", "file -C -m magic",
    "/bin/ls", "./script.sh", "X=1 ls", "env rm notes.md", "xargs rm", "ls | xargs rm", "ls |",
    "python3 -c 'print(1)'", "npm install", "brew install x", "ls 'unclosed", "", "   ",
])
def test_anything_else_still_asks(command):
    assert not read_only.is_read_only(command)


def test_only_run_command_on_a_turn_without_web_tools_skips_asking():
    from model import looks_only
    local = {"run_command", "read_file"}
    assert looks_only("run_command", {"command": "ls"}, local)
    assert not looks_only("run_command", {"command": "ls"}, local | {"web_search"})
    assert not looks_only("run_command", {"command": "ls", "background": True}, local)
    assert not looks_only("run_command", {"command": "ls", "background": "true"}, local)
    assert not looks_only("run_command", {"command": "rm notes.md"}, local)
    assert not looks_only("delete_file", {"command": "ls"}, local)


def _run(monkeypatch, command, tools):
    import model
    from tests.helpers import call, scripted
    ran, asked = [], []
    monkeypatch.setattr(model, "call_tool", lambda name, args: ran.append(args["command"]) or "ok\n[exit code 0]")
    monkeypatch.setattr(model, "_chat_stream", scripted([call("run_command", {"command": command})], "Done."))
    for event in model.stream_model([{"role": "user", "content": "look"}], tools, ask_tools=["run_command"]):
        if event["type"] == "permission":
            asked.append(event["args"]["command"])
            import permissions
            permissions.resolve(event["id"], "unattended")
    return ran, asked


def test_a_look_around_runs_with_no_approval_card(monkeypatch):
    assert _run(monkeypatch, "wc -l notes.md", ["run_command"]) == (["wc -l notes.md"], [])


def test_a_change_still_asks(monkeypatch):
    assert _run(monkeypatch, "rm notes.md", ["run_command"]) == ([], ["rm notes.md"])


def test_a_look_around_still_asks_when_the_web_is_in_reach(monkeypatch):
    assert _run(monkeypatch, "cat notes.md", ["run_command", "fetch_url"]) == ([], ["cat notes.md"])
