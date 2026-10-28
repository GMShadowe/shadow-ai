"""Web tools: search the web, and read a page as plain text."""

import re
import urllib.request

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


def fetch_url(url: str) -> str:
    if offline():
        return OFFLINE
    if not url.startswith(("http://", "https://")):
        return "Error: URL must start with http:// or https://"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Shadow/0.1"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        return f"Error fetching {url}: {e}"

    html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:3000] if text else "(page had no readable text)"

def http_request(url: str, method: str = "GET", body: str = "") -> str:
    if offline():
        return OFFLINE
    method = method.upper()
    if method not in ("GET", "POST", "PUT", "DELETE", "PATCH"):
        return f"Error: unsupported method '{method}'."
    if not url.startswith(("http://", "https://")):
        return "Error: URL must start with http:// or https://"

    data = body.encode("utf-8") if body else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"User-Agent": "Shadow/0.1",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            text = resp.read().decode("utf-8", errors="replace")
            status = resp.status
    except urllib.error.HTTPError as e:
        text = e.read().decode("utf-8", errors="replace")[:2000]
        return f"HTTP {e.code} {e.reason}\n{text}"
    except Exception as e:
        return f"Error making request: {e}"

    return f"HTTP {status}\n{text[:4000]}"
