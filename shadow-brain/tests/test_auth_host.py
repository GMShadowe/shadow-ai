"""#22: the brain never checked Host, so a DNS-rebinding page - whose
requests look same-origin in every other way - relied entirely on Vite's
host check."""

import auth


def headers(**extra):
    h = {"host": "127.0.0.1:8765", auth.HEADER: auth.token(), "sec-fetch-site": "same-origin"}
    h.update(extra)
    return h


def test_the_ui_through_the_proxy_is_allowed():
    assert auth.check("GET", "/conversations", headers()) is None
    assert auth.check("GET", "/conversations", headers(host="localhost:8765")) is None


def test_a_rebound_hostname_is_refused_even_with_the_token():
    status, reason = auth.check("GET", "/conversations", headers(host="evil.example:8765"))
    assert status == 403 and "evil.example" in reason


def test_a_missing_host_is_refused():
    h = headers()
    del h["host"]
    assert auth.check("GET", "/memory", h)[0] == 403


def test_the_dev_servers_own_host_is_not_accepted():
    # The proxy rewrites Host to the brain's; one that arrives unrewritten
    # didn't come through it.
    assert auth.check("GET", "/memory", headers(host="localhost:5173"))[0] == 403


def test_health_still_needs_a_local_host():
    assert auth.check("GET", "/health", {"host": "127.0.0.1:8765"}) is None
    assert auth.check("GET", "/health", {"host": "evil.example:8765"})[0] == 403
