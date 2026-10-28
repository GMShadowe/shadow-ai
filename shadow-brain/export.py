"""One chat, written out as something a person can read.

Markdown is the primary format: it reads as plain text in any editor and
renders in anything that understands markdown. JSON is the second option
and is simply the stored conversation, for anyone who wants to process it.

The turn metadata (route, model, effort, skill, router confidence) is kept,
on one dim line under each reply, so it is there without getting in the way
of reading. Tool calls are kept too, inside <details> blocks: collapsed
wherever markdown is rendered, and still clearly labelled as a tool call
when read as raw text.
"""

import json
import re
from datetime import datetime

# A tool result can be 8000 characters. Keep enough to see what happened.
RESULT_KEEP = 2000
RATING_LABEL = {"up": "liked", "down": "disliked"}


def _slug(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (title or "chat").lower()).strip("-")
    return (slug or "chat")[:50]


def filename(conv: dict, fmt: str) -> str:
    day = (conv.get("created_at") or "")[:10] or datetime.now().strftime("%Y-%m-%d")
    return f"shadow-{_slug(conv.get('title'))}-{day}.{'json' if fmt == 'json' else 'md'}"


def _meta_line(m: dict) -> str:
    router = m.get("router") or {}
    probabilities = router.get("probabilities") or {}
    top = round(max(probabilities.values()) * 100) if probabilities else None
    parts = [
        m.get("route"),
        f"/{m['skill']}" if m.get("skill") else None,
        m.get("model"),
        f"{m['effort']} effort" if m.get("effort") else None,
        f"{router.get('method')} {top}%" if router.get("method") and top is not None else router.get("method"),
    ]
    rating = RATING_LABEL.get(m.get("rating"))
    if rating:
        reason = m.get("rating_reason") or m.get("rating_reason_label")
        parts.append(f"{rating}{f' — {reason}' if reason else ''}")
    return " · ".join(p for p in parts if p)


def _tool_block(t: dict) -> str:
    if t.get("kind") == "permission":
        decision = t.get("decision") or "no answer"
        return f"> Permission asked for `{t.get('name')}` — {decision}\n"

    args = t.get("args") or {}
    summary = ", ".join(f"{k}: {str(v)[:60]}" for k, v in args.items()) or "no arguments"
    result = t.get("result")
    if result is None:
        result = "(no result recorded)"
    result = str(result)
    if len(result) > RESULT_KEEP:
        result = result[:RESULT_KEEP] + f"\n… [trimmed, {len(result)} characters in total]"
    return (
        f"<details>\n<summary>Tool: {t.get('name')} — {summary}</summary>\n\n"
        f"```\n{result}\n```\n\n</details>\n"
    )


def to_markdown(conv: dict, assistant_name: str = "Shadow") -> str:
    messages = conv.get("messages") or []
    out = [
        f"# {conv.get('title') or 'Chat'}",
        "",
        f"Exported from Shadow on {datetime.now().strftime('%d %B %Y, %H:%M')} · "
        f"{len(messages)} message(s) · everything below ran on this computer.",
        "",
    ]

    for m in messages:
        role = m.get("role")
        if role == "user":
            out += ["---", "", "## You", ""]
        elif role == "assistant":
            out += ["---", "", f"## {assistant_name}", ""]
            line = _meta_line(m)
            if line:
                out += [f"*{line}*", ""]
        else:
            out += ["---", "", "## Error", ""]

        for name in m.get("images") or []:
            out += [f"`[image attached: {name}]`", ""]

        for t in m.get("tools") or []:
            out += [_tool_block(t), ""]

        content = (m.get("content") or "").strip()
        if content:
            out += [content, ""]
        elif role == "assistant" and not (m.get("tools") or []):
            out += ["*(this reply was empty)*", ""]

    return "\n".join(out).rstrip() + "\n"


def to_json(conv: dict, assistant_name: str = "Shadow") -> str:
    return json.dumps(
        {
            "exported_at": datetime.now().isoformat(),
            "exported_by": "Shadow",
            "assistant": assistant_name,
            "conversation": conv,
        },
        ensure_ascii=False,
        indent=2,
    )


def build(conv: dict, fmt: str = "md", assistant_name: str = "Shadow") -> dict:
    body = to_json(conv, assistant_name) if fmt == "json" else to_markdown(conv, assistant_name)
    return {"filename": filename(conv, fmt), "format": fmt, "content": body}
