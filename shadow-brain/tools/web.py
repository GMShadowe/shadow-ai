"""Web tools: search the web, and read a page as plain text."""

import re

import netguard
from tools.state import offline

OFFLINE = ("Blocked: offline mode is on, so nothing may leave this computer. "
           "Tell the user they can turn it off in Settings - Privacy.")


def web_search(query: str) -> str:
    if offline():
        return OFFLINE
    try:
        from ddgs import DDGS
    except ImportError:
        return "Error: web search needs the 'ddgs' package. Run: pip install ddgs"
    try:
        results = DDGS().text(query, max_results=5)
    except Exception as e:
        return f"Error searching the web: {e}"
    if not results:
        return f"No results for '{query}'."

    lines = []
    for i, r in enumerate(results, start=1):
        lines.append(f"{i}. {r.get('title', '')}\n   {r.get('href', '')}\n   {r.get('body', '')}")
    return "\n".join(lines)


MAX_PAGE_BYTES = 2_000_000
MAX_RESPONSE_BYTES = 1_000_000


def fetch_url(url: str) -> str:
    if offline():
        return OFFLINE
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        return "Error: URL must start with http:// or https://"
    try:
        resp = netguard.request("GET", url, headers={"User-Agent": "Shadow/0.1"},
                                max_bytes=MAX_PAGE_BYTES, timeout=15)
    except netguard.Blocked as e:
        return f"Blocked: {e}. fetch_url only reads public web pages."
    except Exception as e:
        return f"Error fetching {url}: {e}"
    if resp.status >= 400:
        return f"Error fetching {url}: the site answered HTTP {resp.status}."

    html = resp.text()
    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:3000] if text else "(page had no readable text)"


def http_request(url: str, method: str = "GET", body: str = "") -> str:
    if offline():
        return OFFLINE
    method = str(method or "GET").upper()
    if method not in ("GET", "POST", "PUT", "DELETE", "PATCH"):
        return f"Error: unsupported method '{method}'."
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        return "Error: URL must start with http:// or https://"

    data = str(body).encode("utf-8") if body else None
    try:
        resp = netguard.request(method, url, body=data, max_bytes=MAX_RESPONSE_BYTES, timeout=20,
                                headers={"User-Agent": "Shadow/0.1",
                                         "Content-Type": "application/json"})
    except netguard.Blocked as e:
        return f"Blocked: {e}. http_request only reaches public internet addresses."
    except Exception as e:
        return f"Error making request: {e}"
    limit = 2000 if resp.status >= 400 else 4000
    return f"HTTP {resp.status}\n{resp.text()[:limit]}"
