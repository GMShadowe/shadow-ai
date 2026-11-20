import webbrowser

import pytest

import orchestrator
import settings
import skills
from router.classifier import display_tools
from tools import desktop, registry, skill_tools


@pytest.fixture
def browser(monkeypatch):
    opened = []
    monkeypatch.setattr(webbrowser, "open", lambda url: opened.append(url) or True)
    return opened


def test_a_link_opens_in_the_browser(data_dir, browser):
    assert desktop.open_url("http://localhost:5173/?token=abc") == "Opened http://localhost:5173/?token=abc in the browser."
    assert browser == ["http://localhost:5173/?token=abc"]


@pytest.mark.parametrize("url", ["file:///etc/passwd", "javascript:alert(1)", "/Applications/Calculator.app", ""])
def test_only_web_links_open(data_dir, browser, url):
    assert desktop.open_url(url).startswith("Error:")
    assert browser == []


def test_offline_mode_opens_only_local_links(data_dir, browser):
    settings.update_settings({"offline": True})
    assert desktop.open_url("https://example.com").startswith("Blocked: offline mode is on")
    assert desktop.open_url("http://127.0.0.1:3000").startswith("Opened")
    assert browser == ["http://127.0.0.1:3000"]


def test_a_page_cannot_make_shadow_open_links_without_asking():
    allowed, ask = ["web_search", "open_url"], []
    orchestrator.gate_for_web(allowed, ask)
    assert "open_url" in ask


@pytest.mark.parametrize("text", ["add the build-taste skill", "can you find me a skill for writing tests",
                                  "search up a pdf skill and install it", "install skills from anthropics/skills"])
def test_asking_for_a_skill_grants_search_and_add(text):
    assert {"web_search", "add_skill"} <= set(display_tools(text))


@pytest.mark.parametrize("text", ["what skills do I need for a job in data", "explain my coding skill level"])
def test_talking_about_skills_grants_nothing(text):
    assert "add_skill" not in display_tools(text)


def test_add_skill_asks_first_by_default(data_dir):
    allowed, ask, blocked = [], [], []
    orchestrator.add_display_tools(allowed, blocked, ["web_search", "add_skill"], ask=ask)
    assert "add_skill" in allowed and ask == ["add_skill"]


def test_add_skill_installs_unreviewed_and_says_so(data_dir, monkeypatch):
    def add(source, name=None, replace=False):
        return skills.install("---\nname: tdd\ndescription: Test first.\n---\nWrite the test first.\n",
                              source="https://raw.githubusercontent.com/o/r/HEAD/skills/tdd/SKILL.md")
    monkeypatch.setattr(skills, "add_from_link", add)
    out = skill_tools.add_skill("o/r", "tdd")
    assert "Added the 'tdd' skill" in out and "type /tdd" in out
    assert not skills.load("tdd")["trusted"]


def test_add_skill_reports_errors_plainly(data_dir):
    settings.update_settings({"offline": True})
    out = registry.call_tool("add_skill", {"source": "o/r"})
    assert out.startswith("Error: Offline mode is on")
