"""fetch_url used to return the first 3000 characters of a page with the tags
stripped, which on most sites is the menu. It now keeps what a reader reads."""
from tools.web import MAX_PAGE_TEXT, readable

ARTICLE = "CRDTs let replicas update independently and merge without conflicts. " * 8

PAGE = f"""<html><head><title>CRDTs explained</title><style>body{{color:red}}</style></head>
<body>
<header><a href="/">Home</a> <a href="/blog">Blog</a></header>
<nav><ul><li>Products</li><li>Pricing</li></ul></nav>
<div role="navigation">Skip to content</div>
<main>
  <h1>What is a CRDT?</h1>
  <p>{ARTICLE}</p>
  <ul><li>State-based</li><li>Operation-based</li></ul>
  <img src="x.png"><br>
</main>
<aside>Related posts</aside>
<script>track()</script>
<footer>Copyright 2026</footer>
</body></html>"""


def test_keeps_the_title_and_the_article():
    text = readable(PAGE)
    assert text.startswith("CRDTs explained")
    assert "# What is a CRDT?" in text
    assert "merge without conflicts" in text
    assert "- State-based" in text


def test_drops_menus_banners_scripts_and_footers():
    text = readable(PAGE)
    for junk in ("Pricing", "Blog", "Skip to content", "Related posts", "track()", "Copyright", "color:red"):
        assert junk not in text


def test_a_page_without_main_uses_the_body():
    text = readable("<html><body><nav>Menu</nav><p>Just a paragraph.</p></body></html>")
    assert text == "Just a paragraph."


def test_long_pages_are_cut_and_say_so():
    text = readable("<p>" + "word " * 5000 + "</p>")
    assert len(text) <= MAX_PAGE_TEXT + 40
    assert text.endswith("[page cut off here]")


def test_broken_html_still_returns_text():
    assert "still here" in readable("<div><p>still here<span></div></p></b>")


def test_an_empty_page_says_so():
    assert readable("<html><head><title>Blank</title></head><body></body></html>").endswith(
        "(page had no readable text)")
