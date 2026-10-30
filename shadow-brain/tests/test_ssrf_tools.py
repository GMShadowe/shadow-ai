"""#8: fetch_url and http_request accepted any http(s) URL - loopback, LAN,
link-local, cloud metadata - and urllib followed redirects anywhere."""

import socket

import httpx
import pytest

import netguard
from tools import web

ADDRESSES = {"public.example": ["93.184.216.34"], "evil.internal": ["10.0.0.5"],
             "rebind.example": ["93.184.216.34", "127.0.0.1"]}


@pytest.fixture
def net(monkeypatch):
    """Fake DNS and a fake network that records what was actually sent."""
    lookups, sent = [], []

    def getaddrinfo(host, port, *a, **k):
        lookups.append(host)
        if host in ADDRESSES:
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port)) for ip in ADDRESSES[host]]
        try:
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (str(__import__("ipaddress").ip_address(host)), port))]
        except ValueError:
            raise socket.gaierror("no such host")

    routes = {}

    def handler(request):
        sent.append(request)
        reply = routes.get(request.url.path, (200, {}, b"<p>hello</p>"))
        status, headers, body = reply
        return httpx.Response(status, headers=headers, content=body)

    real_client = httpx.Client
    monkeypatch.setattr(netguard.socket, "getaddrinfo", getaddrinfo)
    monkeypatch.setattr(netguard.httpx, "Client",
                        lambda **kw: real_client(transport=httpx.MockTransport(handler),
                                                 **{k: v for k, v in kw.items() if k != "trust_env"}))
    return {"lookups": lookups, "sent": sent, "routes": routes}


@pytest.mark.parametrize("url", [
    "http://127.0.0.1:11434/api/tags", "http://localhost:8765/", "http://169.254.169.254/latest/",
    "http://10.0.0.1/", "http://192.168.1.1/admin", "http://[::1]/", "http://[::ffff:127.0.0.1]/",
    "http://100.64.0.1/", "http://[fd00::1]/", "http://0.0.0.0/", "http://evil.internal/",
])
def test_non_public_addresses_are_refused(net, url):
    for result in (web.fetch_url(url), web.http_request(url, "POST", "{}")):
        assert result.startswith("Blocked:")
    assert net["sent"] == []


def test_the_connection_goes_to_the_checked_ip_with_the_real_host(net):
    assert "hello" in web.fetch_url("http://public.example/page")
    (req,) = net["sent"]
    assert req.url.host == "93.184.216.34"
    assert req.headers["host"] == "public.example"


def test_a_redirect_into_the_network_is_refused(net):
    net["routes"]["/go"] = (302, {"location": "http://evil.internal/secret"}, b"")
    assert web.fetch_url("http://public.example/go").startswith("Blocked:")
    assert [r.url.path for r in net["sent"]] == ["/go"]  # the private hop was never sent


def test_a_public_redirect_is_followed(net):
    net["routes"]["/old"] = (301, {"location": "/new"}, b"")
    net["routes"]["/new"] = (200, {}, b"<p>moved here</p>")
    assert "moved here" in web.fetch_url("http://public.example/old")


def test_a_name_that_also_resolves_privately_is_refused(net):
    # Any private answer is enough: the client could connect to any of them.
    assert web.fetch_url("http://rebind.example/").startswith("Blocked:")


def test_reads_are_capped(net, monkeypatch):
    monkeypatch.setattr(web, "MAX_RESPONSE_BYTES", 1000)
    net["routes"]["/big"] = (200, {}, b"x" * 50_000)
    resp = netguard.request("GET", "http://public.example/big", max_bytes=1000)
    assert len(resp.body) == 1000 and resp.truncated
