import json

import pytest

from router.classifier import display_tools
from tools import display
from tools.registry import call_tool


@pytest.mark.parametrize("text, wanted", [
    ("make a list for every major tech brand and what do they do", ["show_list"]),
    ("top 5 programming languages", ["show_list"]),
    ("Show me a chart of India's GDP growth over the last ten years", ["show_chart", "web_search"]),
    ("Show me pictures of the Taj Mahal", ["show_images"]),
    ("what does a capybara look like", ["show_images"]),
    ("list the files in my workspace", []),
    ("hello there", []),
])
def test_only_asked_for_tools_are_granted(text, wanted):
    assert display_tools(text) == wanted


def test_an_attached_picture_is_not_a_picture_search():
    assert display_tools("show me pictures of cats like this one", has_images=True) == []


def test_a_list_is_checked_and_not_echoed():
    out = call_tool("show_list", {"title": "Tech brands", "items": [
        {"title": "Apple", "detail": "Makes the iPhone"}, "Google", {"detail": "no title"}]})
    assert out.startswith('Shown: a list titled "Tech brands" with 2 items')
    assert "iPhone" not in out


def test_a_list_given_as_a_json_string_is_read():
    items = json.dumps([{"title": "Apple"}])
    assert "with 1 items" in call_tool("show_list", {"title": "x", "items": items})


def test_a_bad_list_is_an_error_the_model_can_fix():
    assert call_tool("show_list", {"title": "x", "items": []}).startswith("Error:")


def test_chart_numbers_are_checked():
    ok = call_tool("show_chart", {"title": "GDP", "labels": ["2023", "2024"], "values": ["7.2%", 8.2]})
    assert ok.startswith('Shown: a bar chart titled "GDP" with 2 points')
    assert display.chart_points(["a"], ["₹1,200"]) == [{"label": "a", "value": 1200.0}]
    mismatch = call_tool("show_chart", {"title": "x", "labels": ["a", "b"], "values": [1]})
    assert "must match" in mismatch
    words = call_tool("show_chart", {"title": "x", "labels": ["a"], "values": ["lots"]})
    assert words.startswith("Error:") and "isn't a number" in words


def test_picture_search_is_blocked_offline(data_dir):
    import settings
    settings.update_settings({"offline": True})
    assert call_tool("show_images", {"query": "Taj Mahal"}).startswith("Blocked: offline mode")


def test_pictures_carry_data_for_the_screen_and_a_note_for_the_model(data_dir, monkeypatch):
    class FakeDDGS:
        def images(self, query, max_results):
            return [
                {"thumbnail": "https://tse.example/1", "url": "https://site.example/a", "title": "One"},
                {"thumbnail": "http://insecure.example/2", "url": "https://site.example/b"},
                {"thumbnail": "https://tse.example/3", "url": "https://site.example/c", "title": "Three"},
            ]

    import ddgs
    monkeypatch.setattr(ddgs, "DDGS", FakeDDGS)
    out = call_tool("show_images", {"query": "Taj Mahal", "count": 4})
    images = display.images_from_result(out)
    assert [i["thumb"] for i in images] == ["https://tse.example/1", "https://tse.example/3"]
    assert "Shown: 2 pictures" in out


def test_a_display_tool_can_be_turned_off(data_dir):
    import assistants
    from orchestrator import add_display_tools
    assistants.update_profile({"tools": {"show_chart": "off"}})
    allowed, blocked = [], []
    granted = add_display_tools(allowed, blocked, ["show_list", "show_chart"])
    assert granted == ["show_list"] and blocked == ["show_chart"]
