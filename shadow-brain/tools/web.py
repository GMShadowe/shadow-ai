"""Web tools: search the web, and read a page as plain text."""

import re
import time
from html.parser import HTMLParser

import netguard
from tools.state import offline

OFFLINE = ("Blocked: offline mode is on, so nothing may leave this computer. "
           "Tell the user they can turn it off in Settings - Privacy.")


NEWS_RE = re.compile(r"\b(news|headlines?)\b", re.I)


def _news(query: str) -> list[dict]:
    """Dated articles, in the same shape as a text result. Empty on failure,
    so a news search falls back to the ordinary one."""
    from ddgs import DDGS
    try:
        found = DDGS().news(query, max_results=5) or []
    except Exception as e:
        print(f"[web] news search failed, using a normal search: {e}")
        return []
    out = []
    for r in found:
        when = (r.get("date") or "")[:10]
        stamp = ", ".join(x for x in (r.get("source"), when) if x)
        out.append({"title": r.get("title", ""), "href": r.get("url", ""),
                    "body": (f"({stamp}) " if stamp else "") + (r.get("body") or "")})
    return out


SEARCH_TRIES = 3
SEARCH_PAUSE = 1.0
NOTHING_BACK = ("Error: the web search got nothing back. The search engines are probably limiting requests "
                "from this computer, so this says nothing about whether the answer exists online. Tell the "
                "user search isn't answering right now and to try again in a minute. Don't guess the answer.")


def _text_search(ddgs, query: str) -> list[dict]:
    """ddgs reports a rate-limited search (DuckDuckGo answers 202) as "No
    results found", and it often clears within a second or two."""
    for attempt in range(1, SEARCH_TRIES + 1):
        try:
            results = ddgs().text(query, max_results=5)
        except Exception as e:
            if attempt == SEARCH_TRIES or "no results" not in str(e).lower():
                raise
            print(f"[web] search for {query!r} came back empty, trying again ({attempt}/{SEARCH_TRIES})")
            time.sleep(SEARCH_PAUSE)
            continue
        if results or attempt == SEARCH_TRIES:
            return results
    return []


def web_search(query: str) -> str:
    if offline():
        return OFFLINE
    try:
        from ddgs import DDGS
    except ImportError:
        return "Error: web search needs the 'ddgs' package. Run: pip install ddgs"
    results = _news(query) if NEWS_RE.search(query or "") else []
    if not results:
        try:
            results = _text_search(DDGS, query)
        except Exception as e:
            if "no results" in str(e).lower():
                return NOTHING_BACK
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

    return readable(resp.text())


MAX_PAGE_TEXT = 6000
SKIP_TAGS = {"script", "style", "noscript", "svg", "nav", "header", "footer", "aside", "form",
             "button", "select", "template", "iframe", "dialog"}
SKIP_ROLES = {"navigation", "banner", "contentinfo", "complementary", "search", "dialog"}
MAIN_TAGS = {"article", "main"}
BLOCK_TAGS = {"p", "div", "section", "li", "tr", "br", "blockquote", "pre", "dd", "dt", "table",
              "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "figcaption"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source",
             "track", "wbr"}


class _Readable(HTMLParser):
    """Collects the text a person would read: the title, and the article or
    main element when the page has one, without menus, banners and footers."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, bool, bool]] = []
        self.title: list[str] = []
        self.main: list[str] = []
        self.body: list[str] = []
        self.in_title = False

    def _skipping(self) -> bool:
        return any(skip for _, skip, _ in self.stack)

    def _in_main(self) -> bool:
        return any(main for _, _, main in self.stack)

    def _emit(self, text: str) -> None:
        if self._skipping():
            return
        self.body.append(text)
        if self._in_main():
            self.main.append(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag in BLOCK_TAGS:
            self._emit("\n" + ("#" * int(tag[1]) + " " if tag in ("h1", "h2", "h3", "h4", "h5", "h6")
                               else "- " if tag == "li" else ""))
        if tag in VOID_TAGS:
            return
        role = (attrs.get("role") or "").lower()
        skip = (tag in SKIP_TAGS or role in SKIP_ROLES or attrs.get("aria-hidden") == "true"
                or "hidden" in attrs)
        self.stack.append((tag, skip, tag in MAIN_TAGS or role == "main"))

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag in BLOCK_TAGS:
            self._emit("\n")
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        if self.in_title:
            self.title.append(data)
        else:
            self._emit(data)


def _tidy(parts: list[str]) -> str:
    lines = [re.sub(r"[ \t\r\f\v]+", " ", line).strip() for line in "".join(parts).split("\n")]
    lines = [line for line in lines if line and line not in ("-", "#", "##", "###")]
    return "\n".join(lines)


def readable(html: str) -> str:
    parser = _Readable()
    try:
        parser.feed(html)
        parser.close()
    except Exception as e:
        print(f"[web] page didn't parse cleanly, using what was read: {e}")
    title = _tidy(parser.title).replace("\n", " ")
    main, body = _tidy(parser.main), _tidy(parser.body)
    text = main if len(main) >= 400 else body
    if not text:
        return f"{title}\n\n(page had no readable text)" if title else "(page had no readable text)"
    out = f"{title}\n\n{text}" if title else text
    return out[:MAX_PAGE_TEXT] + ("\n[page cut off here]" if len(out) > MAX_PAGE_TEXT else "")


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
