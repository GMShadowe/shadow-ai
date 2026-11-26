"""web_search answered "No results found" for "weather Ahmedabad 2026" twice in
one chat, and the model told the user no forecast existed yet. DuckDuckGo was
rate-limiting (HTTP 202), which ddgs reports as no results."""
import pytest

import tools.web as web


@pytest.fixture(autouse=True)
def no_pause(monkeypatch):
    monkeypatch.setattr(web, "SEARCH_PAUSE", 0)


class Flaky:
    calls = 0

    def text(self, query, max_results=5):
        Flaky.calls += 1
        if Flaky.calls < 3:
            raise Exception("No results found.")
        return [{"title": "Weather", "href": "https://example.com", "body": "+26°C"}]


class Broken:
    def text(self, query, max_results=5):
        raise Exception("Connection reset")


def test_an_empty_search_is_tried_again():
    Flaky.calls = 0
    assert web._text_search(Flaky, "Ahmedabad weather")[0]["body"] == "+26°C"
    assert Flaky.calls == 3


def test_a_real_error_is_not_retried():
    try:
        web._text_search(Broken, "anything")
    except Exception as e:
        assert "Connection reset" in str(e)
    else:
        raise AssertionError("expected the error to come through")


def test_nothing_back_is_not_called_no_results(monkeypatch):
    import sys
    import types

    class Limited:
        def text(self, query, max_results=5):
            raise Exception("No results found.")

    monkeypatch.setitem(sys.modules, "ddgs", types.SimpleNamespace(DDGS=Limited))
    monkeypatch.setattr(web, "offline", lambda: False)
    reply = web.web_search("weather Ahmedabad 2026")
    assert reply == web.NOTHING_BACK
    assert "says nothing about whether the answer exists" in reply
