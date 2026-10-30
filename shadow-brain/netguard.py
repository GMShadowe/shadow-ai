import ipaddress
import socket
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

MAX_REDIRECTS = 5
REDIRECTS = {301, 302, 303, 307, 308}


class Blocked(Exception):
    pass


@dataclass
class Response:
    status: int
    url: str                      # the final URL, after redirects
    headers: dict = field(default_factory=dict)
    body: bytes = b""
    truncated: bool = False       # stopped at max_bytes

    @property
    def content_type(self) -> str:
        return self.headers.get("content-type", "").split(";")[0].strip().lower()

    def text(self) -> str:
        charset = "utf-8"
        for part in self.headers.get("content-type", "").split(";")[1:]:
            key, _, value = part.strip().partition("=")
            if key.lower() == "charset" and value:
                charset = value.strip('"')
        try:
            return self.body.decode(charset, errors="replace")
        except LookupError:
            return self.body.decode("utf-8", errors="replace")


def _is_public(ip: ipaddress._BaseAddress) -> bool:
    # An IPv4 address written as IPv6 (::ffff:127.0.0.1) is judged as itself.
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        ip = mapped
    return ip.is_global and not ip.is_multicast


def check(url: str) -> tuple[str, str, int, str]:
    try:
        parts = urlsplit(url)
        port = parts.port
    except ValueError:
        raise Blocked("that isn't a valid URL") from None
    if parts.scheme not in ("http", "https"):
        raise Blocked("only http:// and https:// addresses can be fetched")
    host = parts.hostname
    if not host:
        raise Blocked("that URL has no host in it")
    port = port or (443 if parts.scheme == "https" else 80)
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError):
        raise Blocked(f"{host} doesn't resolve to an address") from None
    ips = []
    for info in infos:
        ip = ipaddress.ip_address(info[4][0].split("%")[0])
        if not _is_public(ip):
            raise Blocked(f"{host} is an address on this computer or this network ({ip}), "
                          "so Shadow won't fetch it")
        ips.append(ip)
    if not ips:
        raise Blocked(f"{host} doesn't resolve to an address")
    return parts.scheme, host, port, str(ips[0])


def _pinned(url: str, scheme: str, host: str, port: int, ip: str) -> tuple[str, dict, dict]:
    parts = urlsplit(url)
    ip_host = f"[{ip}]" if ":" in ip else ip
    default = 443 if scheme == "https" else 80
    netloc = ip_host if port == default else f"{ip_host}:{port}"
    host_header = host if port == default else f"{host}:{port}"
    extensions = {"sni_hostname": host} if scheme == "https" else {}
    return urlunsplit((scheme, netloc, parts.path or "/", parts.query, "")), {"Host": host_header}, extensions


def _next(status: int, method: str, body):
    if status == 303 or (status in (301, 302) and method == "POST"):
        return "GET", None
    return method, body


def request(method: str, url: str, *, headers: dict | None = None, body: bytes | None = None,
            max_bytes: int, timeout: float | httpx.Timeout = 15.0,
            stop_at: bytes | None = None) -> Response:
    with httpx.Client(timeout=timeout, follow_redirects=False, trust_env=False) as client:
        for _ in range(MAX_REDIRECTS + 1):
            scheme, host, port, ip = check(url)
            target, host_header, extensions = _pinned(url, scheme, host, port, ip)
            req = client.build_request(method, target, headers={**(headers or {}), **host_header},
                                       content=body, extensions=extensions)
            resp = client.send(req, stream=True)
            try:
                location = resp.headers.get("location")
                if resp.status_code in REDIRECTS and location:
                    url = urljoin(url, location)
                    method, body = _next(resp.status_code, method, body)
                    continue
                data, truncated = bytearray(), False
                for chunk in resp.iter_bytes():
                    data.extend(chunk)
                    if len(data) >= max_bytes:
                        truncated = True
                        del data[max_bytes:]
                        break
                    if stop_at and stop_at in chunk:
                        break
                return Response(resp.status_code, url, dict(resp.headers), bytes(data), truncated)
            finally:
                resp.close()
    raise Blocked(f"gave up after {MAX_REDIRECTS} redirects")


async def arequest(method: str, url: str, *, headers: dict | None = None, max_bytes: int,
                   timeout: float | httpx.Timeout = 15.0, stop_at: bytes | None = None,
                   client: httpx.AsyncClient | None = None) -> Response:
    import asyncio

    own = client is None
    client = client or httpx.AsyncClient(timeout=timeout, follow_redirects=False, trust_env=False)
    try:
        for _ in range(MAX_REDIRECTS + 1):
            scheme, host, port, ip = await asyncio.to_thread(check, url)
            target, host_header, extensions = _pinned(url, scheme, host, port, ip)
            req = client.build_request(method, target, headers={**(headers or {}), **host_header},
                                       extensions=extensions)
            resp = await client.send(req, stream=True, follow_redirects=False)
            try:
                location = resp.headers.get("location")
                if resp.status_code in REDIRECTS and location:
                    url = urljoin(url, location)
                    method, _ = _next(resp.status_code, method, None)
                    continue
                data, truncated = bytearray(), False
                async for chunk in resp.aiter_bytes():
                    data.extend(chunk)
                    if len(data) >= max_bytes:
                        truncated = True
                        del data[max_bytes:]
                        break
                    if stop_at and stop_at in chunk:
                        break
                return Response(resp.status_code, url, dict(resp.headers), bytes(data), truncated)
            finally:
                await resp.aclose()
        raise Blocked(f"gave up after {MAX_REDIRECTS} redirects")
    finally:
        if own:
            await client.aclose()
