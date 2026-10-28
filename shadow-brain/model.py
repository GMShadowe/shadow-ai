"""Talks to Ollama with streaming. Yields events as they happen:
tokens of text, tool starts and results, and permission requests."""

import context
import permissions
import providers
import usage
from config import load_tier_config
from settings import update_settings
from tools.registry import get_schemas, call_tool

MODEL_NAME = load_tier_config()["base_model"]  # default, used by the terminal chat
NUM_CTX = 16384  # must match the num_ctx sent to Ollama below

OUT_OF_STEPS = (
    "You have used all your tool steps for this request. Without calling any tools, "
    "briefly and honestly tell the user what you did, what worked, what didn't, "
    "and what they could ask you to do next."
)
EMPTY_NUDGE = (
    "Your last reply was empty. Continue the task: use a tool if you still need to, "
    "otherwise give the user your answer now."
)
EMPTY_FALLBACK = (
    "Sorry, I couldn't come up with an answer for that. "
    "Try rephrasing it, or use higher effort."
)
DENIED = (
    "The user denied permission to use {name}. Don't try it again. "
    "Tell the user what you were going to do, and ask how they'd like to continue."
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
    return providers.ollama_stream(model, messages, schemas, temperature, NUM_CTX)


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
                 provider: dict | None = None):
    model = model_name or MODEL_NAME
    allowed = set(tool_names or [])
    ask = set(ask_tools or [])
    schemas = get_schemas(tool_names) if tool_names else None
    nudged = False
    # The user's question for this turn. Pinned so the compressor can never
    # drop it, however many tool results pile up behind it.
    question = messages[-1] if messages else None

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

        if not tool_calls:
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
        for call in tool_calls:
            name = call.function.name
            args = dict(call.function.arguments or {})

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

            if name in ask:
                pid = permissions.create()
                yield {"type": "permission", "id": pid, "name": name, "args": args}
                decision = permissions.wait(pid)
                yield {"type": "permission_result", "id": pid, "decision": decision}

                if decision == "always":
                    update_settings({"tools": {name: "on"}})
                    ask.discard(name)
                elif decision != "allow":
                    note = (TIMED_OUT if decision == "timeout" else DENIED).format(name=name)
                    messages.append({"role": "tool", "tool_name": name, "content": note})
                    continue

            yield {"type": "tool_start", "name": name, "args": args}
            result = call_tool(name, args)
            yield {"type": "tool_end", "name": name, "result": result}
            messages.append({"role": "tool", "tool_name": name, "content": result})

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
        reported = getattr(chunk, "usage", None)
        if byok and reported is not None:
            spent += _record(provider, reported)
            yield {"type": "usage", "turn": spent,
                   "today": usage.today_total(provider["tier"]),
                   "endpoint": provider["tier"],
                   "host": provider.get("host", "")}
    yield {"type": "final", "text": content}
