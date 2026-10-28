"""Skills: a markdown document holding careful instructions for one task.

A skill is expertise, not a request. "Summarize minecraft.txt" on its own
gets a lazy read-and-retell; with the summarize skill loaded, the model
knows what to look for, what to leave out and how to lay the answer out.

Two rules shape this whole file:

1. Shadow does not know which skills exist. Nothing here is called while a
   prompt is being built unless the user named a skill with a slash command
   in the composer. No list in the awareness block, no descriptions in the
   system prompt — otherwise the model invents skills it doesn't have, or
   runs one the user didn't ask for.
2. A skill is text for the model to read. Nothing in a skill file is ever
   executed, imported or evaluated here.

Skills are global rather than per assistant: they're just markdown, and
every assistant should be able to use the same ones. One folder each, so a
skill can carry supporting files later; the folder name is the identifier.

    shadow-brain/skills/<skill-name>/SKILL.md
"""

import os
import re

SKILLS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skills")
FILENAME = "SKILL.md"

# Lowercase, digits, dash and underscore. This is also what the UI's slash
# command matches, and it rules out "..", slashes and anything else that
# could walk out of the skills folder.
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,47}$")

# A skill rides in the system prompt, which the context compressor never
# trims, so an enormous one would quietly eat the window instead of being
# dropped. Refuse it out loud instead. Roughly 4000 tokens.
MAX_CHARS = 16000


class SkillError(Exception):
    """Something is wrong with a named skill. The message is shown to the user."""


def _skill_path(name: str) -> str:
    if not NAME_RE.match(name or ""):
        raise SkillError(
            f"'{name}' isn't a valid skill name. Skill names are lowercase letters, "
            "numbers, dashes and underscores."
        )
    folder = os.path.join(SKILLS_DIR, name)
    path = os.path.join(folder, FILENAME)
    # Belt and braces: NAME_RE already blocks traversal, but the check is
    # cheap and this path comes in over HTTP.
    if os.path.commonpath([os.path.realpath(folder), os.path.realpath(SKILLS_DIR)]) != os.path.realpath(SKILLS_DIR):
        raise SkillError(f"'{name}' isn't a valid skill name.")
    if not os.path.isfile(path):
        raise SkillError(
            f"There's no skill called '{name}'. Skills live in shadow-brain/skills/{name}/{FILENAME}."
        )
    return path


def _split_frontmatter(text: str) -> tuple[dict, str]:
    """Pull out a leading --- block. Deliberately not YAML: one key: value
    per line is all a skill needs, and no parser dependency can surprise us."""
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    head = text[3:end]
    body = text[end + 4:].lstrip("\n")
    fields = {}
    for line in head.splitlines():
        if ":" in line:
            key, _, value = line.partition(":")
            fields[key.strip().lower()] = value.strip().strip("\"'")
    return fields, body


def _first_line(body: str) -> str:
    """The first real sentence, used when there's no description field."""
    for line in body.splitlines():
        line = line.strip().lstrip("#").strip()
        if line:
            return line[:200]
    return ""


def _tool_list(raw: str, name: str) -> list[str]:
    """A skill may name the tools its instructions depend on:

        tools: read_file, run_command

    Without this a skill that says "call read_file" lands in a plain-chat
    turn with no file tools loaded, and the instructions can't be followed.
    The user invoked the skill, so asking for those tools is their intent,
    not the model guessing - but it is still only a request: a tool the user
    turned off stays off, a tool set to Ask still asks, and offline mode
    still blocks the web tools.
    """
    from tools.registry import TOOLS

    wanted = [t.strip() for t in re.split(r"[,\s]+", raw or "") if t.strip()]
    unknown = [t for t in wanted if t not in TOOLS]
    if unknown:
        raise SkillError(
            f"The '{name}' skill asks for tools that don't exist: {', '.join(unknown)}. "
            f"Fix the 'tools:' line in skills/{name}/{FILENAME}."
        )
    return wanted


def parse(text: str, name: str = "") -> tuple[str, str, list[str], str]:
    """Returns (title, description, tools, body). Nothing is executed."""
    fields, body = _split_frontmatter(text)
    title = fields.get("name") or ""
    description = fields.get("description") or _first_line(body)
    tools = _tool_list(fields.get("tools", ""), name or title or "skill")
    return title, description, tools, body


def load(name: str) -> dict:
    """One skill, ready to drop into a prompt. Raises SkillError with a
    message the user can act on."""
    path = _skill_path(name)
    try:
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
    except OSError as e:
        raise SkillError(f"Couldn't read the '{name}' skill: {e}") from e

    if not text.strip():
        raise SkillError(f"The '{name}' skill file is empty, so there are no instructions to follow.")
    if len(text) > MAX_CHARS:
        raise SkillError(
            f"The '{name}' skill is {len(text)} characters, over the {MAX_CHARS} limit. "
            "Shorten it, or split it into two skills."
        )

    title, description, tools, body = parse(text, name)
    return {"name": name, "title": title or name, "description": description,
            "tools": tools, "content": body, "chars": len(text)}


def list_skills() -> list[dict]:
    """Every installed skill, name and description only. For the UI's slash
    menu and the Settings list — never for a prompt."""
    try:
        folders = sorted(os.listdir(SKILLS_DIR))
    except FileNotFoundError:
        return []

    out = []
    for name in folders:
        if not NAME_RE.match(name) or not os.path.isfile(os.path.join(SKILLS_DIR, name, FILENAME)):
            continue
        try:
            skill = load(name)
        except SkillError as e:
            # A broken skill is listed with its problem as the description,
            # so it's visible in Settings instead of silently missing.
            out.append({"name": name, "title": name, "description": str(e),
                        "tools": [], "broken": True, "chars": 0})
            continue
        out.append({"name": name, "title": skill["title"], "description": skill["description"],
                    "tools": skill["tools"], "broken": False, "chars": skill["chars"]})
    return out
