"""Keeps a request inside the model's context window.

The prompt is built from parts that each grow on their own: the awareness
block, retrieved memories, 17 tool schemas, the conversation so far, and
every tool call and result from this turn. Together they can pass 16K, and
Ollama then fails the whole request ("exceeds the available context size"),
which loses the user's message.

So before every request we measure it, and if it is too big we shrink it in
order of what is cheapest to lose:

  1. system prompt (awareness, rules, memories)   never touched
  2. the current user message and any images      never touched (pinned by
     the caller, because a nudge or an out-of-steps note can arrive after it)
  3. the last few messages                        never dropped
  4. bulky tool results in older turns            trimmed first
  5. bulky tool arguments in older turns          then trimmed
  6. older turns                                  dropped last

Each stage stops as soon as the request fits, so a chat loses the least it
can. Nothing is silent: every pass prints what it cut.

Tokens are estimated, not counted. Four characters per token is close
enough for Qwen on English and code, and it costs nothing — a real
tokenizer would mean loading the model's vocabulary just to decide whether
to trim.
"""

import json

CHARS_PER_TOKEN = 4
# One image is worth hundreds of tokens, and the exact number depends on how
# the vision encoder tiles it. This is a deliberate over-estimate: being wrong
# high costs a little headroom, being wrong low costs the whole request.
IMAGE_TOKENS = 1000
# Room left for the reply itself. num_ctx covers prompt and answer together.
RESERVE_TOKENS = 2000
# Per message, for the role and the chat template's own markers.
MESSAGE_OVERHEAD = 4
# How much of an old tool result is worth keeping: enough to remember what
# happened, not the whole 6000-character shell dump.
TOOL_RESULT_KEEP = 600
# Arguments the model sent to a tool. A generated web page can be 20000
# characters, and re-sending it every step is what overflowed 8K.
TOOL_ARG_KEEP = 400
# Messages at the end that are never dropped, whatever happens.
RECENT_KEEP = 4

TRIM_NOTE = (
    "\n\nNote on this conversation: {n} earlier message(s) were trimmed to fit "
    "the context window, so you cannot see the start of this chat. Don't pretend "
    "to remember what was in them — if the answer depends on something said "
    "earlier, say you've lost it and ask the user."
)


def _call_parts(call):
    """Ollama hands tool calls back as objects; the ones this module has
    already rewritten are plain dicts. Both shapes turn up here."""
    fn = call.get("function") if isinstance(call, dict) else getattr(call, "function", None)
    if fn is None:
        return None, None
    if isinstance(fn, dict):
        return fn.get("name"), fn.get("arguments")
    return getattr(fn, "name", None), getattr(fn, "arguments", None)


def estimate_message(message: dict) -> int:
    """Rough token cost of one message, images and tool calls included."""
    total = MESSAGE_OVERHEAD + len(message.get("content") or "") // CHARS_PER_TOKEN
    total += len(message.get("images") or []) * IMAGE_TOKENS
    for call in message.get("tool_calls") or []:
        # Tool calls reach the model as JSON. Measure the name and arguments
        # themselves: dumping the call object would measure its repr instead,
        # which hides a 20000-character file argument behind a short string.
        name, args = _call_parts(call)
        total += MESSAGE_OVERHEAD + len(name or "") // CHARS_PER_TOKEN
        total += len(_dump(args)) // CHARS_PER_TOKEN
    return total


def estimate(messages: list[dict], schemas: list[dict] | None = None) -> int:
    """Rough token cost of a whole request, tool schemas included."""
    total = sum(estimate_message(m) for m in messages)
    if schemas:
        total += len(_dump(schemas)) // CHARS_PER_TOKEN
    return total


def _dump(value) -> str:
    try:
        return json.dumps(value, default=str)
    except (TypeError, ValueError):
        return str(value)


def _protected(messages: list[dict], pin: dict | None = None) -> set[int]:
    """Indexes that must survive: the system prompt, the last few messages,
    the user's current question, and anything carrying an image.

    The question is pinned by identity rather than by position, because
    model.py appends user-role messages of its own (the empty-reply nudge,
    the out-of-steps note) and those would otherwise look like the newest
    question while the real one got dropped.
    """
    if not messages:
        return set()
    keep = {0}
    keep.update(range(max(0, len(messages) - RECENT_KEEP), len(messages)))
    last_user = max((i for i, m in enumerate(messages) if m.get("role") == "user"), default=None)
    if last_user is not None:
        keep.add(last_user)
    for i, m in enumerate(messages):
        # Images are expensive, but they are also the thing the user is asking
        # about, and short_term already keeps only the most recent one.
        if m.get("images") or (pin is not None and m is pin):
            keep.add(i)
    return keep


def _shorten(text: str, keep: int) -> str:
    return text[:keep].rstrip() + f"\n… [{len(text) - keep} characters trimmed to fit]"


def _shrink_args(calls):
    """Replaces long argument values with a note about what was there. The
    tool already ran, so the text itself is of no further use to the model —
    but it must not look like the model sent a truncated file."""
    out = []
    changed = False
    for call in calls:
        name, args = _call_parts(call)
        if not isinstance(args, dict):
            out.append(call)
            continue
        shorter = {}
        for key, value in args.items():
            if isinstance(value, str) and len(value) > TOOL_ARG_KEEP:
                shorter[key] = f"[{len(value)} characters sent earlier, not repeated here]"
                changed = True
            else:
                shorter[key] = value
        out.append({"function": {"name": name, "arguments": shorter}})
    return (out, changed) if changed else (calls, False)


def fit(messages: list[dict], limit: int, schemas: list[dict] | None = None,
        reserve: int = RESERVE_TOKENS, where: str = "request",
        pin: dict | None = None) -> tuple[list[dict], dict | None]:
    """Returns (messages, report). The report is None when nothing was trimmed.

    `limit` is the model's num_ctx; `reserve` is how much of it to leave for
    the reply. `pin` is a message that must never be dropped — the user's
    current question. Prints a line whenever it changes anything.
    """
    if not messages:
        return messages, None

    budget = max(limit - reserve, limit // 2)
    base = len(_dump(schemas)) // CHARS_PER_TOKEN if schemas else 0
    costs = [estimate_message(m) for m in messages]
    before = total = base + sum(costs)
    if total <= budget:
        return messages, None

    out = list(messages)
    keep = _protected(out, pin)
    trimmed_results = trimmed_args = dropped = 0

    # Stage 1: bulky tool results in older messages, oldest first.
    for i, m in enumerate(out):
        if total <= budget:
            break
        if i in keep or m.get("role") != "tool":
            continue
        content = m.get("content") or ""
        if len(content) <= TOOL_RESULT_KEEP:
            continue
        out[i] = {**m, "content": _shorten(content, TOOL_RESULT_KEEP)}
        new_cost = estimate_message(out[i])
        total += new_cost - costs[i]
        costs[i] = new_cost
        trimmed_results += 1

    # Stage 2: what the model sent *into* those tools (generated files, long
    # commands), which is usually the single biggest thing in the request.
    for i, m in enumerate(out):
        if total <= budget:
            break
        if i in keep or not m.get("tool_calls"):
            continue
        calls, changed = _shrink_args(m["tool_calls"])
        if not changed:
            continue
        out[i] = {**m, "tool_calls": calls}
        new_cost = estimate_message(out[i])
        total += new_cost - costs[i]
        costs[i] = new_cost
        trimmed_args += 1

    # Stage 3: drop whole messages from the oldest end. Only ever from the
    # front, so the recent conversation stays in one piece.
    i = 1  # index 0 is the system prompt
    while total > budget and i < len(out):
        if i in keep:
            i += 1
            continue
        # A tool result whose call is gone makes no sense on its own, so it
        # leaves with the message it belonged to.
        span = 1
        while i + span < len(out) and out[i + span].get("role") == "tool" and (i + span) not in keep:
            span += 1
        total -= sum(costs[i:i + span])
        del out[i:i + span]
        del costs[i:i + span]
        dropped += span
        keep = _protected(out, pin)

    if dropped and out and out[0].get("role") == "system":
        note = TRIM_NOTE.format(n=dropped)
        out[0] = {**out[0], "content": out[0]["content"] + note}
        total += len(note) // CHARS_PER_TOKEN

    # Last resort: the protected messages alone are over budget. Shrink what
    # is left of the tool output rather than failing the request outright.
    if total > budget:
        for i, m in enumerate(out):
            if total <= budget:
                break
            content = m.get("content") or ""
            if m.get("role") != "tool" or len(content) <= TOOL_RESULT_KEEP // 2:
                continue
            out[i] = {**m, "content": _shorten(content, TOOL_RESULT_KEEP // 2)}
            new_cost = estimate_message(out[i])
            total += new_cost - costs[i]
            costs[i] = new_cost
            trimmed_results += 1

    report = {
        "where": where,
        "before": before,
        "after": total,
        "budget": budget,
        "limit": limit,
        "trimmed_results": trimmed_results,
        "trimmed_args": trimmed_args,
        "dropped_messages": dropped,
        "kept_messages": len(out),
        "fits": total <= budget,
    }

    parts = []
    if trimmed_results:
        parts.append(f"trimmed {trimmed_results} tool result(s)")
    if trimmed_args:
        parts.append(f"shortened {trimmed_args} tool call(s)")
    if dropped:
        parts.append(f"dropped {dropped} old message(s)")
    print(f"[context] {where}: {before} -> {total} tokens (budget {budget} of {limit}), "
          + (", ".join(parts) if parts else "nothing left to cut"))
    if not report["fits"]:
        # Honest about the case this can't fix: the system prompt and the
        # current message alone don't leave room. Ollama may refuse this one.
        print(f"[context] still over budget by {total - budget} tokens — the system prompt "
              "and the current message are protected, so there is nothing left to cut")
    return out, report
