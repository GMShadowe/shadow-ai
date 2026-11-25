"""A news question searched the general index and came back with old
evergreen pages. It now asks for dated news first, in the same printed shape
the UI reads back into a result list."""
import ddgs

from tools import web


class FakeDDGS:
    calls: list[str] = []
    news_results: list[dict] | Exception = []

    def news(self, query, max_results=5):
        FakeDDGS.calls.append("news")
        if isinstance(FakeDDGS.news_results, Exception):
            raise FakeDDGS.news_results
        return FakeDDGS.news_results

    def text(self, query, max_results=5):
        FakeDDGS.calls.append("text")
        return [{"title": "Evergreen", "href": "https://example.com/a", "body": "old page"}]


def use_fake(monkeypatch, news_results):
    FakeDDGS.calls = []
    FakeDDGS.news_results = news_results
    monkeypatch.setattr(ddgs, "DDGS", FakeDDGS)


def test_news_queries_get_dated_articles(monkeypatch):
    use_fake(monkeypatch, [{"title": "Chip maker beats estimates", "url": "https://news.example/1",
                            "body": "Quarterly results.", "source": "Reuters", "date": "2026-11-20T10:00:00"}])

    out = web.web_search("news about nvidia")

    assert FakeDDGS.calls == ["news"]
    assert out == ("1. Chip maker beats estimates\n   https://news.example/1\n"
                   "   (Reuters, 2026-11-20) Quarterly results.")


def test_no_news_falls_back_to_a_normal_search(monkeypatch):
    use_fake(monkeypatch, RuntimeError("rate limited"))
    out = web.web_search("nvidia news")
    assert FakeDDGS.calls == ["news", "text"]
    assert "Evergreen" in out


def test_other_queries_skip_the_news_index(monkeypatch):
    use_fake(monkeypatch, [])
    web.web_search("what are CRDTs")
    assert FakeDDGS.calls == ["text"]
