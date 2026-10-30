"""#9: link previews checked only the first URL, then let httpx follow
redirects - so a public page redirecting to a private address was fetched -
and the host was resolved twice, once to check and once to connect."""

import asyncio
import socket

import httpx
import pytest

import netguard
import preview

ADDRESSES = {"public.example": "93.184.216.34", "evil.internal": "10.0.0.5"}


@pytest.fixture
def net(monkeypatch):
    lookups, sent, routes = [], [], {}

    def getaddrinfo(host, port, *a, **k):
        lookups.append(host)
        if host not in ADDRESSES:
            raise socket.gaierror("no such host")
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ADDRESSES[host], port))]

    def handler(request):
        sent.append(request)
        status, headers, body = routes.get(request.url.path, (404, {}, b""))
        return httpx.Response(status, headers=headers, content=body)

    real = httpx.AsyncClient
    monkeypatch.setattr(netguard.socket, "getaddrinfo", getaddrinfo)
    monkeypatch.setattr(preview.httpx, "AsyncClient",
                        lambda **kw: real(transport=httpx.MockTransport(handler),
                                          **{k: v for k, v in kw.items() if k not in ("trust_env", "limits")}))
    monkeypatch.setattr(netguard.httpx, "AsyncClient", preview.httpx.AsyncClient)
    preview._cache.clear()
    preview._images.clear()
    return {"lookups": lookups, "sent": sent, "routes": routes}


HTML = {"content-type": "text/html"}


def test_a_redirect_to_a_private_address_is_not_followed(net):
    net["routes"]["/go"] = (302, {"location": "http://evil.internal/admin"}, b"")
    net["routes"]["/admin"] = (200, HTML, b"<head><title>Router admin</title></head>")
    (card,) = asyncio.run(preview.previews(["http://public.example/go"]))["cards"]
    assert card["ok"] is False and "this network" in card["reason"]
    assert [r.url.path for r in net["sent"]] == ["/go"]


def test_each_host_is_resolved_once_and_connected_to_by_ip(net):
    net["routes"]["/"] = (200, HTML, b"<head><title>Hi</title></head>")
    (card,) = asyncio.run(preview.previews(["http://public.example/"]))["cards"]
    assert card["ok"] is True
    assert net["lookups"] == ["public.example"]
    assert net["sent"][0].url.host == "93.184.216.34"
    assert net["sent"][0].headers["host"] == "public.example"


def test_an_image_redirect_into_the_network_is_refused(net):
    net["routes"]["/logo.png"] = (302, {"location": "http://evil.internal/cam.jpg"}, b"")
    with pytest.raises(preview.PreviewError, match="this network"):
        asyncio.run(preview.image("http://public.example/logo.png"))


def test_an_oversized_image_is_refused(net, monkeypatch):
    monkeypatch.setattr(preview, "MAX_IMAGE_BYTES", 100)
    net["routes"]["/big.png"] = (200, {"content-type": "image/png"}, b"x" * 10_000)
    with pytest.raises(preview.PreviewError, match="too big"):
        asyncio.run(preview.image("http://public.example/big.png"))
