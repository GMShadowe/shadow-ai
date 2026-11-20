import pytest

from router import classifier


@pytest.mark.parametrize("text", [
    "what should I cook today?",
    "I feel tired right now",
    "my recent breakup has been hard",
    "summarise my goals for this year",
    "rewrite my latest draft",
])
def test_time_words_alone_do_not_force_a_web_search(text):
    assert "research" not in classifier._explicit_routes(text)


@pytest.mark.parametrize("text", [
    "look up the weather in Pune",
    "search the web for qwen benchmarks",
    "what is the latest version of node?",
    "what's the latest news on the election",
])
def test_explicit_search_requests_still_force_research(text):
    assert classifier._explicit_routes(text) == ["research"]
