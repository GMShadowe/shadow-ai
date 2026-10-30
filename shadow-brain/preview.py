"""Link previews: the little bit of metadata behind a card.

Three things shape this file:

1. **The fetch happens here, not in the browser.** A card needs a title,
   a description and often an image, and all of it lives on someone else's
   server. If the page were fetched from the UI, every link in a reply
   would hand the user's IP and user agent to that site. So the brain
   fetches, and the image comes back through `/preview/image` too - the
   browser only ever talks to 127.0.0.1.
2. **Most sites will say no**, and that is fine. A block, a timeout, a
   login wall or a page with no tags at all returns `ok: false` with a
   reason, and the UI falls back to a plain styled link. A broken card is
   worse than no card.
3. **Offline mode means no fetching at all.** Not a cached guess, not a
   favicon: plain links.

The parsing is deliberately regex over the <head>, not a DOM library. It
only needs a handful of tags, the input is untrusted, and adding a parser
dependency to read six meta tags is a bad trade.
"""

import asyncio
import json
import re
import time
from urllib.parse import urljoin, urlparse

import httpx

import netguard
from tools.state import offline

TIMEOUT = httpx.Timeout(connect=4.0, read=6.0, write=4.0, pool=4.0)
MAX_URLS = 12
MAX_HTML_BYTES = 400_000      # enough for any <head>; most pages are smaller
MAX_IMAGE_BYTES = 3_000_000
CACHE_TTL = 24 * 3600
CACHE_MAX = 300
IMAGE_CACHE_MAX = 60
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36 Shadow/0.1 (local link preview)")

_cache: dict[str, tuple[float, dict]] = {}
_images: dict[str, tuple[float, bytes, str]] = {}

# Counted so the privacy report can say whether this has actually happened.
stats = {"fetched": 0, "blocked": 0, "failed": 0, "images": 0}


class PreviewError(Exception):
    pass


def _meta(html: str) -> dict[str, str]:
    """Every meta tag, keyed by property or name, lowercased."""
    out = {}
    for tag in re.findall(r"<meta\s[^>]*>", html, flags=re.I):
        key = re.search(r'(?:property|name|itemprop)\s*=\s*["\']([^"\']+)["\']', tag, flags=re.I)
        value = re.search(r'content\s*=\s*["\']([^"\']*)["\']', tag, flags=re.I)
        if key and value:
            out.setdefault(key.group(1).strip().lower(), value.group(1).strip())
    return out


def _title(html: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", html, flags=re.I | re.S)
    return _clean(match.group(1)) if match else ""


def _clean(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    for entity, char in (("&amp;", "&"), ("&quot;", '"'), ("&#39;", "'"), ("&apos;", "'"),
                         ("&lt;", "<"), ("&gt;", ">"), ("&nbsp;", " "), ("&mdash;", "—"),
                         ("&ndash;", "–"), ("&rsquo;", "’"), ("&#x27;", "'")):
        text = text.replace(entity, char)
    return text.strip()


def _icon(html: str, base: str) -> str:
    for rel in ("apple-touch-icon", "icon", "shortcut icon"):
        for tag in re.findall(r"<link\s[^>]*>", html, flags=re.I):
            if not re.search(rf'rel\s*=\s*["\'][^"\']*{rel}[^"\']*["\']', tag, flags=re.I):
                continue
            href = re.search(r'href\s*=\s*["\']([^"\']+)["\']', tag, flags=re.I)
            if href:
                return urljoin(base, _clean(href.group(1)))
    return urljoin(base, "/favicon.ico")


def _ld_products(html: str) -> list[dict]:
    """JSON-LD blocks that describe a Product. This is where a real price
    usually is, when there is one at all."""
    found = []
    for block in re.findall(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', html, flags=re.I | re.S):
        try:
            data = json.loads(block.strip())
        except ValueError:
            continue
        queue = data if isinstance(data, list) else [data]
        while queue:
            node = queue.pop(0)
            if not isinstance(node, dict):
                continue
            if "@graph" in node and isinstance(node["@graph"], list):
                queue.extend(node["@graph"])
            types = node.get("@type") or ""
            types = [types] if isinstance(types, str) else types
            if any(str(t).lower() == "product" for t in types):
                found.append(node)
    return found


def _price_from_ld(node: dict) -> tuple[str, str, str]:
    offers = node.get("offers") or {}
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    if not isinstance(offers, dict):
        offers = {}
    price = offers.get("price") or offers.get("lowPrice") or ""
    currency = offers.get("priceCurrency") or ""
    availability = str(offers.get("availability") or "").rsplit("/", 1)[-1]
    return str(price).strip(), str(currency).strip(), availability


def _parse(url: str, final_url: str, html: str) -> dict:
    meta = _meta(html)
    site = urlparse(final_url).hostname or ""

    title = (meta.get("og:title") or meta.get("twitter:title") or _title(html) or site)
    description = (meta.get("og:description") or meta.get("twitter:description")
                   or meta.get("description") or "")
    image = (meta.get("og:image:secure_url") or meta.get("og:image")
             or meta.get("twitter:image") or meta.get("twitter:image:src") or "")

    card = {
        "ok": True,
        "url": url,
        "final_url": final_url,
        "site": site.removeprefix("www."),
        "title": _clean(title)[:160],
        "description": _clean(description)[:300],
        "image": urljoin(final_url, image) if image else "",
        "icon": _icon(html, final_url),
        "kind": "link",
    }

    # A product card only when there is real structured data behind it.
    # Prices are very often drawn by JavaScript and simply aren't in the
    # HTML; in that case this stays a link card rather than inventing one.
    products = _ld_products(html)
    price, currency, availability = ("", "", "")
    name = ""
    if products:
        node = products[0]
        price, currency, availability = _price_from_ld(node)
        name = _clean(str(node.get("name") or ""))
        if not card["image"]:
            img = node.get("image")
            if isinstance(img, list):
                img = img[0] if img else ""
            if isinstance(img, dict):
                img = img.get("url", "")
            if img:
                card["image"] = urljoin(final_url, str(img))
    if not price:
        price = meta.get("product:price:amount") or meta.get("og:price:amount") or ""
        currency = currency or meta.get("product:price:currency") or meta.get("og:price:currency") or ""
    if not price:
        price = meta.get("twitter:data1") if "price" in (meta.get("twitter:label1") or "").lower() else ""

    is_product = bool(products) or meta.get("og:type", "").startswith("product")
    if is_product:
        card["kind"] = "product"
        card["product"] = {
            "name": name or card["title"],
            # No price found means no price shown. Never a guess.
            "price": str(price).strip(),
            "currency": currency,
            "availability": availability,
        }
    return card


async def _fetch_one(client: httpx.AsyncClient, url: str) -> dict:
    try:
        response = await netguard.arequest("GET", url, client=client, max_bytes=MAX_HTML_BYTES,
                                           stop_at=b"</head>", headers={
                                               "User-Agent": UA,
                                               "Accept": "text/html,application/xhtml+xml",
                                               "Accept-Language": "en",
                                           })
    except netguard.Blocked as e:
        stats["blocked"] += 1
        return {"ok": False, "url": url, "reason": str(e)}
    except httpx.HTTPError as e:
        stats["failed"] += 1
        return {"ok": False, "url": url, "reason": f"couldn't reach it ({type(e).__name__})"}
    except Exception as e:  # a malformed response shouldn't take the turn down
        stats["failed"] += 1
        print(f"[preview] {url}: {e}")
        return {"ok": False, "url": url, "reason": "that page couldn't be read"}

    if response.status >= 400:
        stats["failed"] += 1
        return {"ok": False, "url": url, "reason": f"the site answered {response.status}"}
    if "html" not in response.content_type:
        stats["failed"] += 1
        return {"ok": False, "url": url, "reason": "that link isn't a web page"}

    stats["fetched"] += 1
    return _parse(url, response.url, response.text())


def _remember(url: str, card: dict) -> None:
    if len(_cache) >= CACHE_MAX:
        for key in sorted(_cache, key=lambda k: _cache[k][0])[: CACHE_MAX // 4]:
            _cache.pop(key, None)
    _cache[url] = (time.time() + CACHE_TTL, card)


async def previews(urls: list[str]) -> dict:
    """Metadata for several links at once. Cached, parallel, and silent
    about nothing: every failure comes back with its reason."""
    urls = [u for u in dict.fromkeys(urls) if isinstance(u, str) and u.strip()][:MAX_URLS]
    if offline():
        return {"offline": True,
                "cards": [{"ok": False, "url": u, "reason": "offline mode is on"} for u in urls]}

    now = time.time()
    out: dict[str, dict] = {}
    todo = []
    for url in urls:
        hit = _cache.get(url)
        if hit and hit[0] > now:
            out[url] = {**hit[1], "cached": True}
        else:
            todo.append(url)

    if todo:
        limits = httpx.Limits(max_connections=6)
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=False, trust_env=False,
                                     limits=limits) as client:
            results = await asyncio.gather(*(_fetch_one(client, u) for u in todo))
        for url, card in zip(todo, results):
            _remember(url, card)
            out[url] = card

    return {"offline": False, "cards": [out[u] for u in urls]}


async def image(url: str) -> tuple[bytes, str]:
    """An image for a card, fetched here so the browser never asks the site
    for it. Images are the usual way a page learns who is reading it."""
    if offline():
        raise PreviewError("offline mode is on")

    hit = _images.get(url)
    if hit and hit[0] > time.time():
        return hit[1], hit[2]

    try:
        response = await netguard.arequest("GET", url, timeout=TIMEOUT, max_bytes=MAX_IMAGE_BYTES + 1,
                                           headers={"User-Agent": UA, "Accept": "image/*"})
    except netguard.Blocked as e:
        stats["blocked"] += 1
        raise PreviewError(str(e)) from e
    if response.status >= 400:
        raise PreviewError(f"the image answered {response.status}")
    content_type = response.content_type
    if not content_type.startswith("image/"):
        raise PreviewError("that isn't an image")
    data = response.body
    if len(data) > MAX_IMAGE_BYTES:
        raise PreviewError("that image is too big to pass through")

    if len(_images) >= IMAGE_CACHE_MAX:
        for key in sorted(_images, key=lambda k: _images[k][0])[: IMAGE_CACHE_MAX // 4]:
            _images.pop(key, None)
    _images[url] = (time.time() + CACHE_TTL, data, content_type)
    stats["images"] += 1
    return data, content_type


def summary() -> dict:
    """For the privacy report."""
    return {**stats, "cached": len(_cache), "cached_images": len(_images)}
