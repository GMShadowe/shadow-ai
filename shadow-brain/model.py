"""Talks to Ollama with streaming. Yields events as they happen:
tokens of text, tool starts and results, and permission requests."""

import json
import re
import time

import context
import cool
import permissions
import providers
import usage
from config import load_tier_config
import assistants
from tools.registry import get_schemas, call_tool, preview

MODEL_NAME = load_tier_config()["base_model"]  # default, used by the terminal chat
NUM_CTX = providers.NUM_CTX

OUT_OF_STEPS = (
    "You have used all your tool steps for this request. Without calling any tools, "
    "briefly and honestly tell the user what you did, what worked, what didn't, "
    "and what they could ask you to do next."
)
EMPTY_NUDGE = (
    "Your last reply was empty. Continue the task: use a tool if you still need to, "
    "otherwise give the user your answer now."
)
# A reply that says it did something, in a turn where no tool ran. Small
# models write "I've created the file" without calling write_file; the
# nudge makes them either do it or say they didn't (CLAUDE.md, Honesty).
_DID = (r"created|wrote|written|saved|made|deleted|removed|moved|renamed|ran|run|executed|opened|"
        r"installed|updated|edited|fixed|killed|stopped|searched|checked|looked up|fetched|downloaded|"
        r"sent|emailed|ordered|booked|placed|submitted|posted|started|launched|tested")
CLAIMED_ACTION = re.compile(
    rf"\bI(?:['’]ve| have)? (?:just |already |now )?(?:{_DID})\b"
    r"|\bI(?:['’]ve| have)? (?:just |already )?found(?! it\b| that\b| this\b)"
    r"|\b(?:has|have) been (?:created|saved|written|deleted|removed|moved|renamed|updated|opened|"
    r"sent|placed|booked|ordered|submitted|emailed)\b"
    r"|\bis now open\b|\bis on (?:its|the) way\b",
    re.I,
)
# "Done. Ran the script..." claims the same thing with the "I" left off.
# Case-sensitive, and only before an object, so "Created by Guido..." isn't one.
CLAIMED_BARE = re.compile(
    r"(?:^|[.!?]\s+|\n\s*)(?:Done[.!,:]?\s+)?"
    r"(?:Ran|Executed|Sent|Saved|Created|Deleted|Opened|Installed|Searched|Ordered|Booked|Emailed|"
    r"Submitted|Started|Launched|Fetched|Downloaded)\s+(?:the|a|an|your|it|them|that|this|\d)\b"
)


def _tool_ran_after(messages: list[dict], question: dict | None) -> bool:
    seen = False
    for m in messages:
        if m is question:
            seen = True
        elif seen and m.get("role") == "tool":
            return True
    return False


def claims_action(text: str) -> bool:
    text = text or ""
    return bool(CLAIMED_ACTION.search(text) or CLAIMED_BARE.search(text))


HONESTY_NUDGE = (
    "No tool ran in this reply, but your answer says you did something. If you meant something "
    "from an earlier reply, say that plainly. Otherwise do it now with a tool, or tell the user "
    "honestly that you haven't done it."
)


EMPTY_FALLBACK = (
    "Sorry, I couldn't come up with an answer for that. "
    "Try rephrasing it, or use higher effort."
)
DENIED = (
    "The user denied permission to use {name}. Don't try it again. "
    "Tell the user what you were going to do, and ask how they'd like to continue."
)
UNATTENDED = (
    "{name} needs the user's approval, and this request had no way to ask for it, so it was "
    "skipped. Tell the user what you were going to do, and that approving it needs the Shadow app."
)
TIMED_OUT = (
    "The user didn't answer the permission request for {name}, so it was skipped. "
    "Tell the user what you were going to do."
)


def _chat_stream(model, messages, schemas, temperature, provider=None):
    """One call, two possible destinations.

    Ollama defaults to a 4K context on most machines, which images and
    search results can overflow silently; 16K costs little on Qwen 3.5. A
    BYOK endpoint manages its own context, so num_ctx doesn't apply there.
    """
    if provider and provider.get("kind") == "byok":
        return providers.openai_stream(provider, messages, schemas, temperature)
    return providers.ollama_stream(model, messages, schemas, temperature)


def parse_arguments(raw) -> tuple[dict, str | None]:
    if raw is None or raw == "":
        return {}, None
    if isinstance(raw, dict):
        return dict(raw), None
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except ValueError as e:
            return {}, (f"Error: the arguments for this tool call weren't valid JSON ({e}), so nothing ran. "
                        f"They were: {raw[:300]}. Call the tool again with a JSON object of arguments.")
        if isinstance(parsed, dict):
            return parsed, None
        raw = parsed
    return {}, (f"Error: the arguments for this tool call must be a JSON object, but got "
                f"{type(raw).__name__}, so nothing ran. Call the tool again with a JSON object of arguments.")


def step_stats(chunk) -> dict:
    """What Ollama reports on a step's last chunk. The prompt count is the
    whole prompt even when most of it came from the cache, so the time spent
    reading it is what shows whether the cache was used."""
    ms = lambda name: round((getattr(chunk, name, None) or 0) / 1e6)
    return {"type": "stats", "load_ms": ms("load_duration"),
            "prompt_tokens": getattr(chunk, "prompt_eval_count", None) or 0,
            "prompt_ms": ms("prompt_eval_duration"),
            "output_tokens": getattr(chunk, "eval_count", None) or 0,
            "output_ms": ms("eval_duration")}


def _is_byok(provider: dict | None) -> bool:
    return bool(provider) and provider.get("kind") == "byok"


def _record(provider: dict, reported: dict | None) -> int:
    """Bank one BYOK call's tokens and return how many it added.

    A provider that sent no usage block is recorded as an unreported call, so
    the running total says it is a floor instead of pretending the call was
    free.
    """
    if not reported:
        usage.record(provider["tier"], 0, 0, reported=False)
        return 0
    if reported.get("reported") is False:
        usage.record(provider["tier"], 0, 0, reported=False)
        return 0
    prompt = int(reported.get("prompt") or 0)
    completion = int(reported.get("completion") or 0)
    if not prompt and not completion:
        usage.record(provider["tier"], 0, 0, reported=False)
        return 0
    usage.record(provider["tier"], prompt, completion)
    return prompt + completion


def stream_model(messages: list[dict], tool_names: list[str] | None = None,
                 max_steps: int = 6, temperature: float | None = None,
                 model_name: str | None = None, ask_tools: list[str] | None = None,
                 provider: dict | None = None, aid: str | None = None,
                 question: dict | None = None):
    model = model_name or MODEL_NAME
    allowed = set(tool_names or [])
    ask = set(ask_tools or [])
    schemas = get_schemas(tool_names) if tool_names else None
    nudged = False
    honesty_checked = False
    # The user's question for this turn. Pinned so the compressor can never
    # drop it, however many tool results pile up behind it.
    question = question if question is not None else (messages[-1] if messages else None)
    # A search the orchestrator ran before the model counts: "I searched" is true then.
    ran_tool = _tool_ran_after(messages, question)

    # A BYOK turn is billed to the user, one call per step. Counted as it goes
    # so a cap can stop it part-way instead of reporting the damage after.
    byok = _is_byok(provider)
    spent = 0
    if byok:
        usage.check(provider, 0)

    for _ in range(max_steps):
        content = ""
        tool_calls = []
        # Tool results pile up as the turn goes on, so this runs every step,
        # not just once on the way in.
        messages, _ = context.fit(messages, NUM_CTX, schemas, where="step", pin=question)
        for chunk in _chat_stream(model, messages, schemas, temperature, provider):
            msg = chunk.message
            if msg.content:
                content += msg.content
                yield {"type": "token", "text": msg.content}
            if msg.tool_calls:
                tool_calls.extend(msg.tool_calls)
            reported = getattr(chunk, "usage", None)
            if byok and reported is not None:
                spent += _record(provider, reported)
                yield {"type": "usage", "turn": spent,
                       "today": usage.today_total(provider["tier"]),
                       "endpoint": provider["tier"],
                       "host": provider.get("host", "")}
            if getattr(chunk, "done", False):
                yield step_stats(chunk)

        if not tool_calls:
            if content.strip() and not ran_tool and not honesty_checked and claims_action(content):
                honesty_checked = True
                print(f"[model] reply claims an action but no tool ran, asking again: {content[:120]!r}")
                yield {"type": "tool_start", "name": "honesty_check", "args": {}}
                yield {"type": "tool_end", "name": "honesty_check",
                       "result": "The reply said it did something, but no tool ran. Asked the model again."}
                messages.append({"role": "assistant", "content": content})
                messages.append({"role": "user", "content": HONESTY_NUDGE})
                continue
            if content.strip():
                messages.append({"role": "assistant", "content": content})
                yield {"type": "final", "text": content}
                return
            if not nudged:
                nudged = True
                messages.append({"role": "user", "content": EMPTY_NUDGE})
                continue
            yield {"type": "token", "text": EMPTY_FALLBACK}
            yield {"type": "final", "text": EMPTY_FALLBACK}
            return

        messages.append({"role": "assistant", "content": content, "tool_calls": tool_calls})
        ran_tool = True
        for call in tool_calls:
            name = call.function.name
            args, bad_args = parse_arguments(call.function.arguments)

            if name not in allowed:
                # A dead end on purpose, with the way out spelled out: the old
                # wording left the small models guessing, and they went on to
                # try two more tools that weren't loaded either.
                result = (f"Error: the '{name}' tool is not loaded for this message, so nothing ran. "
                          "Don't try another tool instead. Tell the user plainly that you can't do this "
                          "in this reply, and ask them to say it as a direct instruction so the right "
                          "tools load next time.")
                yield {"type": "tool_start", "name": name, "args": args}
                yield {"type": "tool_end", "name": name, "result": result}
                messages.append({"role": "tool", "tool_name": name, "content": result})
                continue

            if bad_args:
                print(f"[model] {name}: unusable arguments: {call.function.arguments!r:.200}")
                yield {"type": "tool_start", "name": name, "args": {}}
                yield {"type": "tool_end", "name": name, "result": bad_args}
                messages.append({"role": "tool", "tool_name": name, "content": bad_args})
                continue

            if name in ask:
                pid = permissions.create()
                event = {"type": "permission", "id": pid, "name": name, "args": args}
                affects = preview(name, args)
                if affects:
                    event["preview"] = affects
                yield event
                decision = permissions.wait(pid)
                yield {"type": "permission_result", "id": pid, "decision": decision}

                if decision == "always":
                    try:
                        assistants.set_tool_state(name, "on", aid)
                    except (OSError, ValueError) as e:
                        print(f"[permissions] couldn't save 'always allow' for {name}: {e}")
                    ask.discard(name)
                elif decision != "allow":
                    note = {"timeout": TIMED_OUT, "unattended": UNATTENDED}.get(decision, DENIED).format(name=name)
                    messages.append({"role": "tool", "tool_name": name, "content": note})
                    continue

            yield {"type": "tool_start", "name": name, "args": args}
            result = call_tool(name, args)
            yield {"type": "tool_end", "name": name, "result": result}
            messages.append({"role": "tool", "tool_name": name, "content": result})

        # Cool mode: a short rest between steps, so a long task doesn't run
        # the chip flat out from start to finish.
        rest = cool.pause()
        if rest:
            time.sleep(rest)

        # Checked here rather than at the top of the loop, because what has to
        # be prevented is the *next* call: the tool results just added make the
        # following request bigger than the one that got us here.
        if byok:
            usage.check(provider, spent)

    # Out of steps: one last pass with no tools, so the model explains honestly.
    yield {"type": "tool_start", "name": "out_of_steps", "args": {"limit": max_steps}}
    yield {"type": "tool_end", "name": "out_of_steps", "result": "Step budget used up."}
    messages.append({"role": "user", "content": OUT_OF_STEPS})
    content = ""
    messages, _ = context.fit(messages, NUM_CTX, None, where="final pass", pin=question)
    for chunk in _chat_stream(model, messages, None, temperature, provider):
        if chunk.message.content:
            content += chunk.message.content
            yield {"type": "token", "text": chunk.message.content}
        if getattr(chunk, "done", False):
            yield step_stats(chunk)
        reported = getattr(chunk, "usage", None)
        if byok and reported is not None:
            spent += _record(provider, reported)
            yield {"type": "usage", "turn": spent,
                   "today": usage.today_total(provider["tier"]),
                   "endpoint": provider["tier"],
                   "host": provider.get("host", "")}
    yield {"type": "final", "text": content}
