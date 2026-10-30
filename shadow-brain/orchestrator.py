"""The voice layer. Routes the message, grounds research in a real
search, then streams the model's work as events."""

import json
import os
import re
from datetime import datetime

from model import stream_model
from router.classifier import classify_detailed, is_remember
from adapters.registry import get_adapter
from memory.short_term import ShortTermMemory
from memory import long_term, extract
from tools.registry import call_tool
from config import load_tier_config, max_steps, EFFORT_STEPS, default_effort
from assistants import get_profile
from tools.state import WEB_TOOLS, offline, tool_state
from settings import get_settings

import skills
from awareness import compact

RULES = (
    "Be honest. If you don't know something, say so instead of guessing. "
    "Never claim you did something (ran code, saved a file, opened an app) unless a tool actually did it. "
    "When a tool returns an error, tell the user exactly what the error said. Never guess a different reason or say a tool was unavailable. "
    "If the user asks you to create something but doesn't say what should go in it, "
    "ask one short question about what they want first. "
    "Never fill a file with a restatement of the user's request. "
    "Never end a reply by saying you will do something next. Either do it now with a tool, or ask the user if they want it."
)

VISION_RULES = (
    "The user attached {count} image(s). Look at them carefully and answer their question about them. "
    "If you recognize something well-known, like a famous place, landmark, product or artwork, "
    "say what it most likely is, phrased as a likely match rather than a certainty. "
    "Don't invent specific details you can't actually see or confirm, such as an exact spot, date or season. "
    "If text is too small or blurry to read, or something is unclear, say so instead of guessing."
)

TONES = {
    "friendly": "Be warm, friendly and direct.",
    "professional": "Be calm, precise and professional.",
    "casual": "Be relaxed and casual, like texting a friend.",
}

LENGTHS = {
    "short": "Keep answers to a few sentences unless the user asks for more.",
    "balanced": "Match your answer's length to the question: short for simple things, longer for complex ones.",
    "detailed": "Give thorough, well-explained answers.",
}

LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "turns.jsonl")

FILLER = [
    "can you", "could you", "would you", "please", "tell me about", "tell me",
    "search it up", "search for", "search up", "search", "look it up", "look up",
    "find out", "help me", "i want to know", "i want", "what is", "what's", "and",
    "do you know", "you know", "yk", "is",
]


def clean_query(text: str) -> str:
    """Strip filler phrases so the search uses only the user's meaningful words.

    Crude, and left crude on purpose. Stripping phrases cannot turn a sentence
    into a query: "explain what CRDTs are and link to martin kleppmann's site"
    still reaches the search engine close to verbatim, because the message
    carries two requests and no list of filler words knows that. The fix for
    that is the research adapter writing the query itself, which is on the
    roadmap - adding more phrases here only moves which sentences come out
    mangled, and anchoring the stripping to the start of the string (tried,
    rejected) made queries more faithful but worse, since keeping "and tell me
    if it is" helps no search engine.

    The one thing fixed here: an apostrophe used to be replaced with a space,
    so "kleppmann's" became "kleppmann s" and a possessive turned into a stray
    one-letter token in the query.
    """
    q = text.lower()
    for phrase in sorted(FILLER, key=len, reverse=True):
        q = re.sub(rf"\b{re.escape(phrase)}\b", " ", q)
    # Keep an apostrophe when it sits inside a word; drop it anywhere else, so
    # quotes and stray marks still go.
    q = re.sub(r"(?<=\w)'(?=\w)", "\x00", q)
    q = re.sub(r"[^\w\s.\-\x00]", " ", q)
    q = q.replace("\x00", "'")
    q = re.sub(r"\s+", " ", q).strip()
    return q or text


def split_tools(adapters: list[dict]) -> tuple[list[str], list[str], list[str]]:
    """Returns (allowed, ask, blocked). Ask tools are allowed, but need approval each time."""
    profile = get_profile()
    no_web = offline()
    allowed: list[str] = []
    ask: list[str] = []
    blocked: list[str] = []
    for adapter in adapters:
        for name in adapter["tools"]:
            if name in allowed or name in blocked:
                continue
            state = tool_state(name, profile)
            # In offline mode the web tools are blocked like any tool the user
            # turned off, so the prompt tells the model not to reach for them.
            if state == "off" or (no_web and name in WEB_TOOLS):
                blocked.append(name)
            else:
                allowed.append(name)
                if state == "ask":
                    ask.append(name)
    return allowed, ask, blocked


SKILL_HEADER = (
    "The user invoked the \"{name}\" skill for this message. It is a set of instructions for "
    "doing this one task well, written by the user, and it applies to this message only. "
    "Follow it closely. It does not override the honesty rules above: if the skill asks for "
    "something a tool can't do, say so plainly rather than pretending.\n\n{content}"
)


def add_skill_tools(allowed: list[str], ask: list[str], blocked: list[str],
                    skill: dict | None) -> None:
    """Load the tools a skill's instructions depend on, in place.

    The user's own settings still decide: a tool they turned off stays in
    blocked, a tool set to Ask still stops and asks, and offline mode still
    blocks the web tools. A skill can ask; it can't grant.
    """
    if not skill:
        return
    profile = get_profile()
    no_web = offline()
    for name in skill["tools"]:
        if name in allowed or name in blocked:
            continue
        state = tool_state(name, profile)
        if state == "off" or (no_web and name in WEB_TOOLS):
            blocked.append(name)
            continue
        allowed.append(name)
        if state == "ask":
            ask.append(name)


def build_system_prompt(adapters, blocked, ask, image_count=0, tier=None, effort=None,
                        allowed=None, skill=None):
    p = get_profile()
    prompt = (
        f"{compact(tier, effort, allowed, ask)}\n\n"
        f"{TONES.get(p['tone'], '')} {LENGTHS.get(p['response_length'], '')}\n\n"
        f"{RULES}"
    )
    if image_count:
        prompt += "\n\n" + VISION_RULES.format(count=image_count)
    for adapter in adapters:
        prompt += "\n\n" + adapter["specialty_prompt"]
    # Offline mode needs naming: otherwise the model tells the user to turn a
    # tool back on, when the real switch is Settings - Privacy.
    if offline():
        prompt += ("\n\nOffline mode is on, so the web tools are blocked and nothing can leave this computer. "
                   "If the user asks for something from the internet, say plainly that offline mode is on "
                   "and that they can turn it off in Settings - Privacy. Never guess the answer instead.")
    if blocked:
        prompt += (f"\n\nThese tools are turned off in Settings: {', '.join(blocked)}. "
                   "Don't try to use them. If the task needs one, tell the user they can turn it on in Settings.")
    if ask:
        prompt += (f"\n\nThese tools need the user's approval each time: {', '.join(ask)}. "
                   "You can still use them, the user will be asked first. If they deny, don't try again.")
    if p["custom_instructions"]:
        prompt += ("\n\nThe user's personal instructions. Follow them unless they conflict "
                   f"with the honesty rules above:\n{p['custom_instructions']}")
    # Last, because it is the most specific thing the user asked for. It lives
    # in the system prompt, which the compressor never trims, and it is gone
    # again next turn - nothing here is remembered except the name.
    if skill:
        prompt += "\n\n" + SKILL_HEADER.format(name=skill["name"], content=skill["content"])
    return prompt


def merge_temperature(adapters: list[dict]) -> float | None:
    temps = [a["temperature"] for a in adapters if "temperature" in a]
    return min(temps) if temps else None


def stream_turn(user_input: str, memory: ShortTermMemory,
                tier: str | None = None, effort: str | None = None,
                images: list[str] | None = None, skill_name: str | None = None):
    images = images or []
    # Only ever set because the user typed a slash command. The model is never
    # told which skills exist, so it cannot ask for one.
    skill = skills.load(skill_name) if skill_name else None
    tier_cfg = load_tier_config(tier)
    effort = effort if effort in EFFORT_STEPS else default_effort()

    history = memory.get()
    previous = next((m["content"] for m in reversed(history) if m["role"] == "user"), None)

    decision = classify_detailed(user_input, previous, bool(images))
    adapters = [a for a in (get_adapter(n) for n in decision["adapters"]) if a]
    route_label = "+".join(a["name"] for a in adapters) or "chat"
    yield {"type": "route", "route": route_label, "router": decision,
           "model": tier_cfg["label"], "effort": effort,
           "skill": skill["name"] if skill else None}

    allowed, ask, blocked = split_tools(adapters)
    add_skill_tools(allowed, ask, blocked, skill)

    # A model the user brought may not do tool calling at all. Sending
    # schemas anyway gets a confusing provider error, so they are dropped
    # and the prompt says why - the same shape as the offline-mode note.
    no_tools_reason = None
    if not tier_cfg.get("tools", True):
        no_tools_reason = (
            f"The model in use ({tier_cfg['label']}) can't call tools, so you have none this turn. "
            "Answer from what you know. If the task needs a file, a command or the web, say plainly "
            "that this model can't do it and that another model in Settings can. Never pretend you did it."
        )
        allowed, ask, blocked = [], [], []

    # Self-knowledge is always available, even in plain chat. Added before the
    # prompt is built, so the prompt's list of callable tools is the real one.
    # Not when the model can't call tools at all: one schema is enough for a
    # provider to refuse the whole request.
    if not no_tools_reason and "about_me" not in allowed and tool_state("about_me") != "off":
        allowed.append("about_me")

    tools_used: list[dict] = []
    system_prompt = build_system_prompt(adapters, blocked, ask, len(images), tier, effort,
                                        allowed, skill)
    if no_tools_reason:
        system_prompt += "\n\n" + no_tools_reason

    # Pull relevant long-term memories into the prompt.
    try:
        memories = long_term.search(user_input)
        if memories:
            system_prompt += "\n\nThings you remember about the user:\n" + "\n".join(f"- {m}" for m in memories)
    except Exception as e:
        print(f"[memory] search failed: {e}")

    # Research mode: for full questions, search the user's own words first so the
    # model can't bias the query. Skipped when web_search needs approval, and when
    # there's an image. Short follow-ups the model queries itself.
    wants_research = any(a["name"] == "research" for a in adapters) and "web_search" in allowed
    auto_search = wants_research and "web_search" not in ask and not images
    is_follow_up = previous is not None and len(user_input.split()) < 4

    if auto_search and not is_follow_up:
        query = clean_query(user_input)
        args = {"query": query, "auto": True}
        yield {"type": "tool_start", "name": "web_search", "args": args}
        results = call_tool("web_search", {"query": query})
        yield {"type": "tool_end", "name": "web_search", "result": results}
        tools_used.append({"name": "web_search", "args": args, "result": results})
        system_prompt += (
            f"\n\nYou already searched the web for the user's own words: \"{query}\".\n"
            f"Results:\n{results}\n\n"
            "Answer from these results. If they show different things with the same name, "
            "list them briefly by their real names and ask which one the user means. "
            "Use fetch_url only if you need more detail from one specific result. Don't run the same search again."
        )
    elif wants_research and is_follow_up:
        system_prompt += (
            "\n\nThe user's message is a short follow-up. Use the conversation to work out "
            "exactly what they mean, then call web_search with a full, specific query "
            "that includes the actual name of the thing (never just the user's short reply)."
        )

    user_message = {"role": "user", "content": user_input}
    if images:
        user_message["images"] = images

    working = [{"role": "system", "content": system_prompt}]
    working += history
    working.append(user_message)

    reply = ""
    pending: dict | None = None
    spend = None
    for event in stream_model(working, allowed or None, max_steps(effort),
                              merge_temperature(adapters), tier_cfg["base_model"], ask,
                              tier_cfg if tier_cfg.get("custom") else None):
        kind = event["type"]
        if kind == "final":
            reply = event["text"]
            continue
        if kind == "usage":
            # Keep the running total so the finished turn carries it into the
            # message's meta, where the UI can still show it after a reload.
            spend = {"turn": event["turn"], "today": event["today"],
                     "endpoint": event["endpoint"], "host": event.get("host", "")}
        if kind == "permission":
            tools_used.append({"kind": "permission", "id": event["id"], "name": event["name"],
                               "args": event["args"], "decision": None})
        elif kind == "permission_result":
            for t in tools_used:
                if t.get("kind") == "permission" and t["id"] == event["id"]:
                    t["decision"] = event["decision"]
        elif kind == "tool_start":
            pending = {"name": event["name"], "args": event["args"]}
        elif kind == "tool_end" and pending:
            pending["result"] = event["result"]
            tools_used.append(pending)
            pending = None
        yield event

    memory.add("user", user_input, images)
    memory.add("assistant", reply)
    log_turn(user_input, route_label, decision, reply, len(images),
             skill["name"] if skill else None)

    # Save to long-term memory.
    try:
        if is_remember(user_input):
            # Only what extraction pulled out is stored. The raw message used
            # to be saved when it found nothing, which put whole sentences -
            # questions, file requests - into long-term memory.
            facts = extract.extract_facts(user_input)
            if facts:
                saved = [long_term.add(f, source="asked") for f in facts]
                print(f"[memory] remember matched, saved {sum(saved)} of {len(facts)} facts")
            else:
                print("[memory] remember matched, but no fact could be extracted, so nothing was saved")
        elif get_profile().get("auto_memory"):
            for fact in extract.extract_facts(user_input):
                long_term.add(fact, source="auto")
    except Exception as e:
        print(f"[memory] save failed: {e}")

    if spend:
        # One finished turn, so the per-turn average in Settings means something.
        import usage as usage_store
        usage_store.count_turn(spend["endpoint"])

    yield {"type": "done", "reply": reply, "route": route_label, "tools": tools_used,
           "router": decision, "model": tier_cfg["label"], "effort": effort,
           "skill": skill["name"] if skill else None, "usage": spend}


def handle_turn(user_input: str, memory: ShortTermMemory,
                tier: str | None = None, effort: str | None = None,
                images: list[str] | None = None, skill_name: str | None = None) -> dict:
    result = {}
    for event in stream_turn(user_input, memory, tier, effort, images, skill_name):
        if event["type"] == "done":
            result = event
    return result


def log_turn(user_input: str, route: str, decision: dict, reply: str, image_count: int = 0,
             skill: str | None = None) -> None:
    # The log is the only file that keeps a copy of every turn. When the user
    # turns it off in Settings, nothing is written at all.
    if not get_settings().get("log_turns", True):
        return
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "time": datetime.now().isoformat(),
            "input": user_input,
            "images": image_count,
            "route": route,
            "skill": skill,
            "router_method": decision["method"],
            "probabilities": decision["probabilities"],
            "reply": reply,
        }) + "\n")
