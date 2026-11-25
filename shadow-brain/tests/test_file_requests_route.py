"""Laya scored "read notes.md" under the confidence floor, so it reached the
model as plain chat with no file tools, and the model asked the user to say
it again as a direct instruction - which it already was."""
import pytest

from router import classifier


@pytest.fixture(autouse=True)
def unsure_router(monkeypatch):
    monkeypatch.setattr(classifier, "classify_keywords", lambda text: None)


@pytest.mark.parametrize("text", [
    "list the files in my workspace",
    "read notes.md and tell me what's in it",
    "delete junk.txt",
    "open data.csv",
    "create a folder called drafts",
    "write the summary to report.md",
    "add up the temp column in data.csv",
    "how many lines does app.py have?",
    "zip notes.md and data.csv into backup.zip",
])
def test_file_actions_load_the_file_tools(text):
    assert "files" in classifier.classify_detailed(text)["adapters"]


@pytest.mark.parametrize("text", [
    "hi lol",
    "what should I cook today?",
    "I read a great book on rust last week",
    "write a poem about the sea",
    "explain what a file system is",
    "what's new in node.js 22",
    "is next.js better than remix",
    "read https://example.com/notes.md for me",
])
def test_other_messages_do_not(text):
    assert "files" not in classifier.classify_detailed(text)["adapters"]


def test_remember_still_wins():
    assert classifier.classify_detailed("remember that my notes live in notes.md")["adapters"] == []


@pytest.mark.parametrize("text", [
    "how much free space is left on my disk?",
    "what's using my cpu",
    "which version of git is installed on this computer",
    "what processes are running",
])
def test_questions_about_the_machine_load_the_system_tools(text):
    assert "system" in classifier.classify_detailed(text)["adapters"]


@pytest.mark.parametrize("text", ["how much space does a whale need", "my computer science homework"])
def test_loose_machine_words_do_not(text):
    assert "system" not in classifier.classify_detailed(text)["adapters"]
