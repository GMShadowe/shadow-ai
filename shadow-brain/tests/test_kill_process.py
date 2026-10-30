import os

import psutil
import pytest

from tools import desktop, registry


class FakeProc:
    def __init__(self, pid, name):
        self.info = {"pid": pid, "name": name}
        self.signals = []

    def send_signal(self, sig):
        self.signals.append(sig)


@pytest.fixture
def procs(monkeypatch):
    table = [FakeProc(1, "launchd"), FakeProc(os.getpid(), "python3.14"),
             FakeProc(os.getppid(), "zsh"), FakeProc(500, "ollama"),
             FakeProc(600, "Safari"), FakeProc(601, "SafariBookmarksSyncAgent"),
             FakeProc(700, "node"), FakeProc(701, "node")]
    monkeypatch.setattr(psutil, "process_iter", lambda attrs=None: iter(table))
    return {p.info["pid"]: p for p in table}


def _stopped(procs):
    return sorted(pid for pid, p in procs.items() if p.signals)


@pytest.mark.parametrize("target", ["", "   ", "a", None])
def test_empty_and_one_letter_targets_stop_nothing(procs, target):
    assert desktop.kill_process(target).startswith("Error")
    assert _stopped(procs) == []


def test_names_must_match_exactly(procs):
    desktop.kill_process("safari")
    assert _stopped(procs) == [600]  # not SafariBookmarksSyncAgent
    assert "exactly" in desktop.kill_process("Saf")


def test_every_process_with_the_exact_name_is_stopped(procs):
    assert "node (pid 700), node (pid 701)" in desktop.kill_process("node")


def test_shadow_its_parent_the_system_and_ollama_are_refused(procs):
    for target in (str(os.getpid()), str(os.getppid()), "1", "ollama", "launchd"):
        result = desktop.kill_process(target)
        assert "refusing" in result, target
    assert _stopped(procs) == []


def test_the_approval_card_lists_what_allow_would_stop(procs):
    text = registry.preview("kill_process", {"target": "node"})
    assert text == "Will stop 2 process(es): node (pid 700), node (pid 701)"
    assert _stopped(procs) == []  # previewing kills nothing
    assert "too short" in registry.preview("kill_process", {"target": "x"})
