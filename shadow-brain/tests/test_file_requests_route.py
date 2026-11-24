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
])
def test_file_actions_load_the_file_tools(text):
    assert "files" in classifier.classify_detailed(text)["adapters"]


@pytest.mark.parametrize("text", [
    "hi lol",
    "what should I cook today?",
    "I read a great book on rust last week",
    "write a poem about the sea",
    "explain what a file system is",
])
def test_other_messages_do_not(text):
    assert "files" not in classifier.classify_detailed(text)["adapters"]


def test_remember_still_wins():
    assert classifier.classify_detailed("remember that my notes live in notes.md")["adapters"] == []
