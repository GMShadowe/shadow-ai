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

