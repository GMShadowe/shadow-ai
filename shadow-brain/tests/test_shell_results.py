"""Shell results point at the next step, so a 4B that hits a wall turns
instead of stopping. A long run's error is at the end, and used to be cut."""
from tools import shell


def test_a_long_run_keeps_its_error():
    out = shell.format_result("python3 long.py", "line\n" * 5000,
                              "Traceback...\nValueError: bad config value", 1)
    assert "ValueError: bad config value" in out
    assert "characters cut from the middle" in out
    assert out.startswith("line")


def test_a_short_run_is_left_alone():
    assert shell.format_result("ls", "a\nb", "", 0) == "a\nb\n[exit code 0]"


def test_a_missing_command_says_to_try_another():
    out = shell.format_result("free -h", "", "/bin/sh: free: command not found", 127)
    assert "free isn't installed" in out and "try another command" in out


def test_a_failure_says_to_fix_it():
    assert "fix the cause" in shell.format_result("python3 x.py", "", "boom", 1)


def test_a_blocked_command_names_the_way_around():
    assert "delete_dir" in shell.run_command("rm -rf build")
    assert "run it themselves" in shell.run_command("sudo ls")


def test_a_real_missing_command(tmp_path, monkeypatch):
    monkeypatch.setattr(shell, "get_workspace", lambda: str(tmp_path))
    out = shell.run_command("definitely-not-a-command-xyz")
    assert "[exit code 127]" in out and "isn't installed" in out
