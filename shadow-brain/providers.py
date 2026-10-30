"""Where the generation call actually goes.

Shadow talks to Ollama. BYOK models talk to an OpenAI-compatible endpoint
instead. Everything above this file - the router, adapters, memory, the
tool loop, permissions, the context compressor - is identical either way:
only the call differs, and both backends yield the same little chunk shape
that model.py already reads (`chunk.message.content`, `chunk.message.tool_calls`).

The awkward part is message history. Ollama and OpenAI disagree on three
things, so the conversion happens here and nowhere else:

- images: Ollama takes `images: [base64]`; OpenAI takes content parts with
  a data: URL.
- tool calls: OpenAI needs an id on each call and the same id back on the
  result. Shadow's internal history labels a result with `tool_name`, so
  ids are assigned when converting, and results are matched to calls in
  order - which is safe, because model.py appends results in exactly the
  order the calls came in.
- the system prompt is a plain message in both, so that part is free.
"""

import json
from dataclasses import dataclass, field

import httpx

TIMEOUT = httpx.Timeout(connect=10.0, read=300.0, write=30.0, pool=10.0)


class ProviderError(Exception):
    """Already worded for the user: what happened, and what to do."""


# ---- the shape model.py reads ------------------------------------------------

@dataclass
class Call:
    @dataclass
    class Function:
        name: str = ""
        arguments: dict = field(default_factory=dict)

    function: "Call.Function" = field(default_factory=lambda: Call.Function())
    id: str = ""


@dataclass
class Msg:
    content: str = ""
    tool_calls: list = field(default_factory=list)


@dataclass
class Chunk:
    message: Msg
    # Only the last chunk of a BYOK stream carries this: {"prompt", "completion"}.
    # model.py reads it with getattr, so an Ollama chunk needs nothing extra.
    usage: dict | None = None


# ---- Ollama -----------------------------------------------------------------

def ollama_stream(model: str, messages: list[dict], schemas, temperature, num_ctx: int):
    import ollama

    options = {"num_ctx": num_ctx}
    if temperature is not None:
        options["temperature"] = temperature
    kwargs = {"model": model, "messages": messages, "think": False,
              "stream": True, "options": options}
    if schemas:
        kwargs["tools"] = schemas
    return ollama.chat(**kwargs)


# ---- OpenAI-compatible ------------------------------------------------------

def _openai_messages(messages: list[dict]) -> list[dict]:
    """Shadow's history, in the shape an OpenAI-compatible API expects."""
    out: list[dict] = []
    pending: list[str] = []  # tool_call ids waiting for their result

    for m in messages:
        role = m.get("role")

        if role == "tool":
            # Results come back in call order, so the oldest unanswered id
            # belongs to this one.
            call_id = pending.pop(0) if pending else f"call_{len(out)}"
            out.append({"role": "tool", "tool_call_id": call_id,
                        "content": str(m.get("content", ""))})
            continue

        if role == "assistant" and m.get("tool_calls"):
            calls = []
            for i, call in enumerate(m["tool_calls"]):
                fn = getattr(call, "function", None) or call.get("function", {})
                name = getattr(fn, "name", None) or fn.get("name", "")
                args = getattr(fn, "arguments", None)
                if args is None:
                    args = fn.get("arguments", {})
                call_id = getattr(call, "id", "") or f"call_{len(out)}_{i}"
                pending.append(call_id)
                calls.append({
                    "id": call_id,
                    "type": "function",
                    "function": {"name": name,
                                 "arguments": args if isinstance(args, str) else json.dumps(args or {})},
                })
            out.append({"role": "assistant", "content": m.get("content") or None,
                        "tool_calls": calls})
            continue

        images = m.get("images") or []
        if images:
            parts = [{"type": "text", "text": m.get("content", "")}]
            for b64 in images:
                parts.append({"type": "image_url",
                              "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
            out.append({"role": role, "content": parts})
            continue

        out.append({"role": role, "content": m.get("content", "")})

    return out


def _explain(status: int, body: str, cfg: dict) -> str:
    """Provider errors, said plainly, with the next step."""
    host = cfg.get("host") or cfg.get("base_url", "")
    model = cfg.get("base_model") or ""
    detail = ""
    try:
        parsed = json.loads(body)
        detail = (parsed.get("error") or {}).get("message") or parsed.get("message") or ""
    except (ValueError, AttributeError):
        detail = body[:300]

    if status in (401, 403):
        return (f"{host} rejected the API key ({status}). Check the key in Settings - Models & brain, "
                f"and that it has access to {model}." + (f" It said: {detail}" if detail else ""))
    if status == 404:
        return (f"{host} has no model called '{model}' at that URL ({status}). Check the model "
                f"name and that the base URL ends where the provider's API starts, like /v1."
                + (f" It said: {detail}" if detail else ""))
    if status == 429:
        return f"{host} is rate limiting or out of quota ({status}). {detail or 'Try again shortly.'}"
    if status >= 500:
        return f"{host} had a server error ({status}). {detail or 'Not something this computer can fix; try again later.'}"
    if "tool" in detail.lower() or "function" in detail.lower():
        return (f"{host} refused the request because of the tools Shadow sent: {detail} "
                "If this model can't call tools, turn tool calling off for it in Settings - Models & brain.")
    return f"{host} refused the request ({status}). {detail or 'No reason given.'}"


class _NoStreamOptions(Exception):
    """This server doesn't accept stream_options. Ask again without it."""


def _stream_attempt(client, url, payload, headers, cfg, sink):
    """One request. Yields Chunks; puts any reported usage into `sink`.

    Raises _NoStreamOptions before yielding anything if the server rejected
    the request over that option, which makes retrying safe - nothing has
    reached the caller yet.
    """
    # Tool calls arrive in fragments, keyed by index, and have to be
    # reassembled before they mean anything.
    building: dict[int, dict] = {}

    with client.stream("POST", url, json=payload, headers=headers) as response:
        if response.status_code >= 400:
            body = response.read().decode("utf-8", "replace")
            if "stream_options" in payload and "stream_options" in body:
                raise _NoStreamOptions()
            raise ProviderError(_explain(response.status_code, body, cfg))

        for line in response.iter_lines():
            if not line or not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                break
            try:
                event = json.loads(data)
            except ValueError:
                continue

            # The usage block arrives in a final chunk of its own, which has
            # no choices in it at all - so it is read before that check.
            reported = event.get("usage")
            if isinstance(reported, dict):
                sink["usage"] = {
                    "prompt": int(reported.get("prompt_tokens") or 0),
                    "completion": int(reported.get("completion_tokens") or 0),
                }

            choices = event.get("choices") or []
            if not choices:
                continue
            delta = choices[0].get("delta") or {}

            text = delta.get("content")
            if text:
                yield Chunk(Msg(content=text))

            for fragment in delta.get("tool_calls") or []:
                index = fragment.get("index", 0)
                slot = building.setdefault(index, {"id": "", "name": "", "arguments": ""})
                if fragment.get("id"):
                    slot["id"] = fragment["id"]
                fn = fragment.get("function") or {}
                if fn.get("name"):
                    slot["name"] += fn["name"]
                if fn.get("arguments"):
                    slot["arguments"] += fn["arguments"]

    if building:
        calls = []
        for slot in building.values():
            # Raw string, not {}: {} would run the tool with no arguments.
            args = slot["arguments"]
            try:
                parsed = json.loads(args) if args.strip() else {}
                if isinstance(parsed, dict):
                    args = parsed
            except ValueError:
                pass
            calls.append(Call(function=Call.Function(name=slot["name"], arguments=args), id=slot["id"]))
        yield Chunk(Msg(tool_calls=calls))


def _require_safe_url(cfg: dict) -> None:
    import custom
    try:
        custom.check_base_url(cfg.get("base_url", ""))
    except custom.CustomError as e:
        raise ProviderError(f"Not sent: {e} Change it in Settings - Models & brain.") from e


def openai_stream(cfg: dict, messages: list[dict], schemas, temperature):
    """Streams an OpenAI-compatible chat completion, yielding Chunks.

    The key goes in one place - this Authorization header - and is never
    logged, returned or written anywhere else.

    The last Chunk carries `usage` when the provider reported it, so the turn
    can be counted and capped. A provider that reports nothing yields a final
    Chunk with usage None, which is recorded as an unreported call rather than
    as zero tokens - a count that is quietly too low is worse than one that
    admits what it is missing.
    """
    from tools.state import offline
    if offline():
        raise ProviderError(
            "Offline mode is on, so Shadow can't send this conversation to "
            f"{cfg.get('host') or cfg.get('base_url', 'that endpoint')}. "
            "Turn offline mode off in Settings - Privacy, or pick a local model."
        )

    _require_safe_url(cfg)
    url = f"{cfg['base_url'].rstrip('/')}/chat/completions"
    payload = {
        "model": cfg["base_model"],
        "messages": _openai_messages(messages),
        "stream": True,
        # Ask the provider to report what this call cost. Without it a streamed
        # response carries no token counts at all, and there would be nothing
        # to count or cap with.
        "stream_options": {"include_usage": True},
    }
    if temperature is not None:
        payload["temperature"] = temperature
    if schemas and cfg.get("tools", True):
        payload["tools"] = schemas

    headers = {"Authorization": f"Bearer {cfg['key']}", "Content-Type": "application/json"}
    sink: dict = {"usage": None}

    try:
        with httpx.Client(timeout=TIMEOUT) as client:
            try:
                yield from _stream_attempt(client, url, payload, headers, cfg, sink)
            except _NoStreamOptions:
                # Not every OpenAI-compatible server takes that option. Lose
                # the counting rather than the answer, and say so once.
                print(f"[providers] {cfg.get('host', '')} rejected stream_options; "
                      "retrying without it. This endpoint won't report token counts.")
                without = {k: v for k, v in payload.items() if k != "stream_options"}
                yield from _stream_attempt(client, url, without, headers, cfg, sink)
    except httpx.HTTPError as e:
        host = cfg.get("host") or cfg.get("base_url", "")
        raise ProviderError(
            f"Couldn't reach {host}: {e}. Check the base URL, and that this computer is online "
            "and offline mode is off."
        ) from e

    # Always last, so model.py can record the call whether or not it was told
    # what it cost.
    yield Chunk(Msg(), usage=sink["usage"] or {"prompt": 0, "completion": 0, "reported": False})


def probe(cfg: dict) -> dict:
    """One tiny request, to say whether the endpoint works before the user
    relies on it mid-conversation. Reports what came back, never the key."""
    try:
        _require_safe_url(cfg)
    except ProviderError as e:
        return {"ok": False, "detail": str(e)}
    url = f"{cfg['base_url'].rstrip('/')}/chat/completions"
    payload = {"model": cfg["base_model"], "max_tokens": 1,
               "messages": [{"role": "user", "content": "ping"}]}
    headers = {"Authorization": f"Bearer {cfg['key']}", "Content-Type": "application/json"}
    try:
        with httpx.Client(timeout=httpx.Timeout(20.0)) as client:
            r = client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as e:
        host = cfg.get("host") or cfg.get("base_url", "")
        return {"ok": False, "detail": f"Couldn't reach {host}: {e}."}
    if r.status_code >= 400:
        return {"ok": False, "detail": _explain(r.status_code, r.text, cfg)}

    # Does it take tools? Asking is cheaper than finding out mid-turn.
    tools_payload = dict(payload)
    tools_payload["tools"] = [{
        "type": "function",
        "function": {"name": "ping", "description": "A test.",
                     "parameters": {"type": "object", "properties": {}, "required": []}},
    }]
    tools_ok = True
    tools_detail = ""
    try:
        with httpx.Client(timeout=httpx.Timeout(20.0)) as client:
            t = client.post(url, json=tools_payload, headers=headers)
        if t.status_code >= 400:
            tools_ok = False
            tools_detail = _explain(t.status_code, t.text, cfg)
    except httpx.HTTPError as e:
        tools_ok = False
        tools_detail = str(e)

    return {"ok": True, "tools": tools_ok, "tools_detail": tools_detail,
            "detail": f"{cfg.get('host') or cfg['base_url']} answered as {cfg['base_model']}."
                      + ("" if tools_ok else " It rejected a request with tools, so tool calling is off.")}
