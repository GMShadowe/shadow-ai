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

    shadow-brain/skills/<skill-name>/SKILL.md        shipped with Shadow
    shadow-brain/data/skills/<skill-name>/SKILL.md   added by the user
"""

import json
import os
import re
import shutil
from datetime import datetime, timezone
from urllib.parse import urlsplit

BRAIN_DIR = os.path.dirname(os.path.abspath(__file__))
SKILLS_DIR = os.path.join(BRAIN_DIR, "skills")
ADDED_DIR = os.path.join(BRAIN_DIR, "data", "skills")
FILENAME = "SKILL.md"
ORIGIN = "origin.json"

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


def _check_name(name: str) -> None:
    if not NAME_RE.match(name or ""):
        raise SkillError(
            f"'{name}' isn't a valid skill name. Skill names are lowercase letters, "
            "numbers, dashes and underscores."
        )


def _folder(root: str, name: str) -> str:
    folder = os.path.join(root, name)
    # Belt and braces: NAME_RE already blocks traversal, but the check is
    # cheap and this path comes in over HTTP.
    if os.path.commonpath([os.path.realpath(folder), os.path.realpath(root)]) != os.path.realpath(root):
        raise SkillError(f"'{name}' isn't a valid skill name.")
    return folder


def _skill_path(name: str) -> str:
    _check_name(name)
    for root in (SKILLS_DIR, ADDED_DIR):
        path = os.path.join(_folder(root, name), FILENAME)
        if os.path.isfile(path):
            return path
    raise SkillError(
        f"There's no skill called '{name}'. Add one in Settings - Skills, from a file or a link."
    )


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


def _origin(name: str) -> dict | None:
    folder = os.path.join(ADDED_DIR, name)
    if not os.path.isfile(os.path.join(folder, FILENAME)) or os.path.isfile(os.path.join(SKILLS_DIR, name, FILENAME)):
        return None
    try:
        with open(os.path.join(folder, ORIGIN), "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"source": "added by hand", "added": None}
    except (OSError, json.JSONDecodeError) as e:
        print(f"[skills] couldn't read where '{name}' came from: {e}")
        return {"source": "unknown", "added": None}


def _names() -> list[str]:
    names = set()
    for root in (SKILLS_DIR, ADDED_DIR):
        try:
            entries = os.listdir(root)
        except FileNotFoundError:
            continue
        for name in entries:
            if NAME_RE.match(name) and os.path.isfile(os.path.join(root, name, FILENAME)):
                names.add(name)
    return sorted(names)


def list_skills() -> list[dict]:
    out = []
    for name in _names():
        origin = _origin(name)
        extra = {"added": origin is not None, "source": (origin or {}).get("source")}
        try:
            skill = load(name)
        except SkillError as e:
            # A broken skill is listed with its problem as the description,
            # so it's visible in Settings instead of silently missing.
            out.append({"name": name, "title": name, "description": str(e),
                        "tools": [], "broken": True, "chars": 0, **extra})
            continue
        out.append({"name": name, "title": skill["title"], "description": skill["description"],
                    "tools": skill["tools"], "broken": False, "chars": skill["chars"], **extra})
    return out


def slug(text: str) -> str:
    out = re.sub(r"[^a-z0-9_-]+", "-", (text or "").strip().lower()).strip("-_")
    return out[:48].strip("-_")


def _name_for(text: str, given: str | None, filename: str | None) -> str:
    if given and given.strip():
        name = slug(given)
    else:
        fields, _body = _split_frontmatter(text)
        stem = os.path.splitext(os.path.basename(filename or ""))[0]
        name = slug(fields.get("name") or ("" if stem.upper() == "SKILL" else stem))
    if not name:
        raise SkillError("This skill doesn't say what it's called. Type a name for it.")
    _check_name(name)
    return name


def check_text(text: str, name: str) -> dict:
    if "\x00" in text:
        raise SkillError("That isn't a text file. A skill is a markdown document.")
    if not text.strip():
        raise SkillError("That file is empty, so there are no instructions to follow.")
    if len(text) > MAX_CHARS:
        raise SkillError(
            f"That skill is {len(text)} characters, over the {MAX_CHARS} limit. "
            "Shorten it, or split it into two skills."
        )
    title, description, tools, _body = parse(text, name)
    return {"title": title or name, "description": description, "tools": tools}


def install(text: str, *, name: str | None = None, filename: str | None = None,
            source: str, replace: bool = False) -> dict:
    name = _name_for(text, name, filename)
    check_text(text, name)
    if os.path.isfile(os.path.join(SKILLS_DIR, name, FILENAME)):
        raise SkillError(f"'{name}' is one of Shadow's own skills. Give yours a different name.")
    folder = _folder(ADDED_DIR, name)
    if os.path.isfile(os.path.join(folder, FILENAME)) and not replace:
        raise SkillExists(f"You already have a skill called '{name}'. Replace it, or give this one another name.")

    os.makedirs(folder, exist_ok=True)
    origin = {"source": source, "added": datetime.now(timezone.utc).date().isoformat()}
    for fname, content in ((FILENAME, text), (ORIGIN, json.dumps(origin, indent=2))):
        path = os.path.join(folder, fname)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp, path)
    print(f"[skills] added '{name}' from {source} ({len(text)} chars)")
    return next(s for s in list_skills() if s["name"] == name)


def remove(name: str) -> None:
    _check_name(name)
    if os.path.isfile(os.path.join(SKILLS_DIR, name, FILENAME)):
        raise SkillError(f"'{name}' is one of Shadow's own skills, so it can't be removed here.")
    folder = _folder(ADDED_DIR, name)
    if not os.path.isdir(folder):
        raise SkillError(f"There's no skill called '{name}'.")
    shutil.rmtree(folder)
    print(f"[skills] removed '{name}'")


class SkillExists(SkillError):
    pass


# Parsed for its source and --skill only; nothing pasted is ever executed.
COMMAND_RE = re.compile(
    r"^(?:(?:npx|pnpx|bunx)(?:\s+-y|\s+--yes)?|pnpm\s+dlx|yarn\s+dlx|bun\s+x)?\s*"
    r"skills(?:@\S+)?\s+(?:add|install|i)\s+(?P<args>.+)$",
    re.IGNORECASE,
)
VALUE_FLAGS = {"-a", "--agent", "-s", "--skill"}


def parse_source(text: str) -> tuple[str, str | None]:
    import shlex

    text = (text or "").strip()
    m = COMMAND_RE.match(text)
    if not m:
        return text, None
    try:
        args = shlex.split(m.group("args"))
    except ValueError as e:
        raise SkillError(f"Couldn't read that command: {e}") from e
    source, skill, i = None, None, 0
    while i < len(args):
        arg = args[i]
        flag, eq, value = arg.partition("=")
        if flag in VALUE_FLAGS:
            if not eq:
                i += 1
                value = args[i] if i < len(args) else ""
            if flag in ("-s", "--skill"):
                skill = value
        elif not arg.startswith("-") and source is None:
            source = arg
        i += 1
    if not source:
        raise SkillError("That command doesn't say where the skill is. It should look like "
                         "npx skills add owner/repo.")
    return source, skill


def candidates(text: str) -> list[str]:
    source, skill = parse_source(text)
    if not skill:
        return [raw_url(source)]
    if not NAME_RE.match(skill.lower()):
        raise SkillError(f"'{skill}' isn't a skill name Shadow can look for.")
    base = raw_url(source).rsplit("/", 1)[0]
    return [f"{base}/{folder}/{skill}/{FILENAME}" for folder in ("skills", ".claude/skills", ".agents/skills")] + \
        [f"{base}/{skill}/{FILENAME}"]


def raw_url(link: str) -> str:
    link = (link or "").strip()
    short = re.fullmatch(r"([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)((?:/[A-Za-z0-9_.-]+)*)/?", link)
    if short:
        owner, repo, path = short.groups()
        if not path:
            return f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{FILENAME}"
        path = path.strip("/")
        if not path.lower().endswith(".md"):
            path += "/" + FILENAME
        return f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}"
    parts = urlsplit(link)
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise SkillError("That isn't a link Shadow can use. Paste an https:// address, or owner/repo for GitHub.")
    if parts.hostname.lower() in ("github.com", "www.github.com"):
        bits = [b for b in parts.path.split("/") if b]
        if len(bits) == 2:
            return f"https://raw.githubusercontent.com/{bits[0]}/{bits[1]}/HEAD/{FILENAME}"
        if len(bits) >= 4 and bits[2] in ("tree", "blob"):
            path = "/".join(bits[3:])
            if bits[2] == "tree" or not path.lower().endswith(".md"):
                path = path.rstrip("/") + "/" + FILENAME
            return f"https://raw.githubusercontent.com/{bits[0]}/{bits[1]}/{path}"
    return link


def fetch(link: str) -> tuple[str, str]:
    import netguard
    from tools.state import offline

    if offline():
        raise SkillError("Offline mode is on, so Shadow can't download a skill. Add it from a file instead, "
                         "or turn offline mode off in Settings - Privacy.")
    urls = candidates(link)
    for url in urls:
        try:
            resp = netguard.request("GET", url, headers={"Accept": "text/markdown, text/plain, */*"},
                                    max_bytes=MAX_CHARS * 4 + 1, timeout=15.0)
        except netguard.Blocked as e:
            raise SkillError(f"Shadow won't fetch that link: {e}.") from e
        except Exception as e:
            raise SkillError(f"Couldn't download that skill: {type(e).__name__}: {e}") from e
        if resp.status != 404:
            break
    else:
        if len(urls) > 1:
            raise SkillError(f"Couldn't find that skill in the repo. Looked in: {', '.join(urls)}.")
        raise SkillError(f"There's nothing at {urls[0]} (404). If the repo holds several skills, add "
                         "--skill <name>, or link to the folder holding the one you want.")
    if resp.status != 200:
        raise SkillError(f"{urlsplit(url).hostname} answered {resp.status}, so nothing was added.")
    if resp.truncated:
        raise SkillError(f"That file is bigger than a skill can be ({MAX_CHARS} characters at most).")
    if resp.content_type == "text/html" or resp.body.lstrip()[:15].lower().startswith((b"<!doctype", b"<html")):
        raise SkillError("That link is a web page, not a skill file. Link to the raw SKILL.md "
                         "(on GitHub, the folder or the file both work).")
    return resp.text(), resp.url
