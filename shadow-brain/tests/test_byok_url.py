import pytest

import custom
import providers


def test_plain_http_is_refused_for_remote_hosts():
    with pytest.raises(custom.CustomError, match="unencrypted"):
        custom.add_byok("http://api.example.com/v1", "gpt-test", "sk-1")


def test_http_is_allowed_for_a_server_on_this_computer():
    for url in ("http://localhost:1234/v1", "http://127.0.0.1:8080/v1", "http://[::1]:8000/v1"):
        assert custom.add_byok(url, "local", "x")["kind"] == "byok"


def test_https_is_accepted():
    entry = custom.add_byok("https://api.example.com/v1", "gpt-test", "sk-abcd1234")
    assert entry["host"] == "api.example.com"


def test_changing_host_without_a_new_key_is_refused_and_key_unchanged():
    mid = custom.add_byok("https://api.example.com/v1", "gpt-test", "sk-original")["id"]
    with pytest.raises(custom.CustomError, match="new address"):
        custom.update(mid, {"base_url": "https://evil.example.net/v1"})
    stored = custom.get(mid)
    assert stored["base_url"] == "https://api.example.com/v1"
    assert stored["key"] == "sk-original"


def test_changing_host_with_a_new_key_works():
    mid = custom.add_byok("https://api.example.com/v1", "gpt-test", "sk-original")["id"]
    custom.update(mid, {"base_url": "https://other.example.net/v1", "key": "sk-other"})
    stored = custom.get(mid)
    assert stored["base_url"] == "https://other.example.net/v1" and stored["key"] == "sk-other"


def test_changing_only_the_path_keeps_the_key():
    mid = custom.add_byok("https://api.example.com/v1", "gpt-test", "sk-original")["id"]
    custom.update(mid, {"base_url": "https://api.example.com/v2"})
    assert custom.get(mid)["key"] == "sk-original"


def test_update_cannot_switch_to_plain_http():
    mid = custom.add_byok("https://api.example.com/v1", "gpt-test", "sk-original")["id"]
    with pytest.raises(custom.CustomError, match="unencrypted"):
        custom.update(mid, {"base_url": "http://api.example.com/v1", "key": "sk-x"})


def test_an_old_http_entry_is_refused_before_the_key_is_sent(monkeypatch):
    def no_network(*a, **k):
        raise AssertionError("tried to connect")

    monkeypatch.setattr(providers.httpx, "Client", no_network)
    cfg = {"base_url": "http://api.example.com/v1", "base_model": "m", "key": "sk-x", "host": "api.example.com"}
    with pytest.raises(providers.ProviderError, match="unencrypted"):
        list(providers.openai_stream(cfg, [{"role": "user", "content": "hi"}], None, None))
    assert providers.probe(cfg)["ok"] is False
