"""Local API so the UI can talk to the brain.
Only listens on 127.0.0.1. Never expose this to a network:
it can run commands on this computer."""

import base64
import binascii
import json
import os
import platform

import ollama
from fastapi import Body, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response, StreamingResponse
from pydantic import BaseModel

import assistants
import auth
import errors
import permissions
import storage
from orchestrator import handle_turn, stream_turn, LOG_PATH
import custom
import export
import preview
import feedback
import privacy
import skills
import stt
import usage as usage_store
from memory.short_term import ShortTermMemory
from config import (TIER_ORDER, EFFORT_STEPS, all_tiers, get_workspace, is_placeholder,
                    load_tier_config, normalize_tier)
from settings import get_settings, update_settings
from tools.state import offline, tool_state
from hardware import get_hardware, recommend_tier
from adapters.registry import list_adapters
from tools.registry import TOOLS

from memory import long_term

VERSION = "0.1.0"
MAX_IMAGES = 4
MAX_IMAGE_BYTES = 8 * 1024 * 1024
DEFAULT_IMAGE_PROMPT = "What's in this image?"

TOOL_GROUPS = {
    "Files": ["read_file", "write_file", "edit_file", "move_file", "delete_file", "delete_dir",
              "list_dir", "find_files", "search_text"],
    "Computer": ["run_command", "kill_process", "open_app", "system_info"],
    "Web": ["web_search", "fetch_url", "http_request"],
    "Self": ["about_me"],
}

app = FastAPI(title="Shadow Brain")


# Every request needs Shadow's token, and no request may come from another
# page. One middleware rather than a dependency on each route: this API can
# run commands and delete files, so the check has to be the kind that cannot
# be forgotten when someone adds the next endpoint.
@app.middleware("http")
async def require_token(request: Request, call_next):
    refusal = auth.check(request.method, request.url.path, request.headers)
    if refusal:
        status, reason = refusal
        return JSONResponse({"detail": reason}, status_code=status)
    return await call_next(request)


# There is deliberately no CORS middleware. The UI reaches the brain through
# its own dev server's /api path, so every legitimate request is same-origin
# and needs no CORS at all. What was here before was
# allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?", which trusted
# every app on this machine that serves a page. If cross-origin access is ever
# genuinely needed, add one exact origin - never a regex over localhost, and
# never with allow_credentials.


@app.get("/health")
def health():
    """The one endpoint that answers without a token, so the UI can tell "the
    brain isn't running" from "the brain refused us". Exposes no state."""
    return {"ok": True, "version": VERSION}

# Generate the access token before anything can ask for it, so the file is
# there for the dev server to read the moment the brain is up.
auth.token()

storage.init()
long_term.init()
assistants.migrate_tiers()
sessions: dict[str, ShortTermMemory] = {}


def _migrate_onboarded() -> None:
    """Don't send an existing install through first-run setup.

    The `onboarded` flag was added after people were already using Shadow,
    and it defaults to false, so an install with real chats in it would be
    greeted by a welcome screen. Anyone with a chat already has been through
    setup in every sense that matters.
    """
    if get_settings()["onboarded"]:
        return
    if not any(assistants.counts(aid)["chats"] for aid in assistants.list_ids()):
        return
    try:
        update_settings({"onboarded": True})
        print("[setup] existing chats found, so first-run setup is marked done")
    except (ValueError, OSError) as e:
        print(f"[setup] couldn't mark setup done: {e}")


_migrate_onboarded()


def _maybe_load_laya() -> None:
    if get_settings()["router"] != "laya":
        return
    try:
        from router.laya_router import load
        load()
        print("[router] Laya loaded")
    except Exception as e:
        print(f"[router] Laya unavailable, using keywords: {e}")


def _laya_loaded() -> bool:
    try:
        from router import laya_router
        return laya_router._agent is not None
    except Exception:
        return False


_maybe_load_laya()


class ChatRequest(BaseModel):
    conversation_id: str
    message: str
    model: str | None = None
    effort: str | None = None
    images: list[str] = []
    # Set only when the user picked a skill with a slash command.
    skill: str | None = None


class RenameRequest(BaseModel):
    title: str


class RerunRequest(BaseModel):
    """A regenerate, or an edit when `message` is set."""
    conversation_id: str
    message: str | None = None
    model: str | None = None
    effort: str | None = None


class CustomModelRequest(BaseModel):
    """One of the user's own models. BYOM needs only `model`; BYOK needs a
    base URL, a model name and a key."""
    kind: str
    label: str = ""
    model: str = ""
    base_url: str = ""
    key: str = ""
    vision: bool | None = None
    tools: bool | None = None


class CustomModelPatch(BaseModel):
    label: str | None = None
    model: str | None = None
    base_url: str | None = None
    key: str | None = None   # empty means "keep the stored one"
    vision: bool | None = None
    tools: bool | None = None
    # Token caps on a BYOK endpoint. 0 means no cap.
    cap_turn: int | None = None
    cap_day: int | None = None


class PreviewRequest(BaseModel):
    urls: list[str] = []


class OpenFileRequest(BaseModel):
    path: str


class FeedbackRequest(BaseModel):
    conversation_id: str
    message_id: str
    rating: str | None = None       # "up", "down", or null to clear it
    reason_code: str | None = None  # only meaningful on a dislike
    reason: str = ""


class PermissionAnswer(BaseModel):
    decision: str


def _installed_models() -> set[str] | None:
    try:
        return {m.model for m in ollama.list().models}
    except Exception:
        return None


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _have_model(name: str, installed: set[str]) -> bool:
    """Whether a model is pulled, allowing for the implied :latest tag.

    Ollama reports "nomic-embed-text:latest" but it is pulled and referred
    to as "nomic-embed-text", so a plain name has to match its :latest form
    or setup would download it again every time.
    """
    if name in installed:
        return True
    if ":" not in name:
        return f"{name}:latest" in installed
    return False


def _models(ram_gb: float | None) -> list[dict]:
    installed = _installed_models()
    models = []
    for cfg in all_tiers():
        reason = None
        if cfg.get("kind") == "byok" and offline():
            reason = "Offline mode is on, so nothing may leave this computer."
        elif cfg.get("kind") == "byok":
            reason = None
        elif (cfg.get("custom") and installed is not None
              and not _have_model(cfg["base_model"], installed)):
            reason = f"Not in your Ollama any more. Run: ollama pull {cfg['base_model']}"
        elif cfg.get("placeholder") or not cfg["base_model"]:
            reason = cfg.get("placeholder_reason") or "No model chosen for this tier yet."
        elif installed is not None and not _have_model(cfg["base_model"], installed):
            reason = f"Not downloaded. Run: ollama pull {cfg['base_model']}"
        elif ram_gb is not None and ram_gb < cfg["min_ram_gb"]:
            reason = f"Needs {cfg['min_ram_gb']}GB RAM"
        # Deliberately field by field: a BYOK config carries an API key and
        # it must never reach a response.
        models.append({
            "id": cfg["tier"],
            "label": cfg["label"],
            "description": cfg["description"],
            "model": cfg["base_model"],
            "vision": cfg.get("vision", False),
            "tools": cfg.get("tools", True),
            "kind": cfg.get("kind", "builtin"),
            "custom": bool(cfg.get("custom")),
            # The one thing worth shouting about: this model sends the
            # conversation off this computer.
            "sends_data": cfg.get("kind") == "byok",
            "host": cfg.get("host", ""),
            "available": reason is None,
            "reason": reason,
        })
    return models


def _tool_list() -> list[dict]:
    profile = assistants.get_profile()
    out = []
    for group, names in TOOL_GROUPS.items():
        for name in names:
            if name in TOOLS:
                out.append({
                    "name": name,
                    "group": group,
                    "danger": TOOLS[name].get("danger", "safe"),
                    "description": TOOLS[name]["schema"]["function"]["description"],
                    "state": tool_state(name, profile),
                })
    return out


def _available_tools() -> list[str]:
    profile = assistants.get_profile()
    return [n for n in sorted(TOOLS.keys()) if tool_state(n, profile) != "off"]


def _log_turns() -> int:
    try:
        with open(LOG_PATH, "r", encoding="utf-8") as f:
            return sum(1 for line in f if line.strip())
    except FileNotFoundError:
        return 0


def _settings_payload() -> dict:
    hardware = get_hardware(get_workspace())
    return {
        "version": VERSION,
        "settings": get_settings(),
        "profile": assistants.get_profile(),
        "models": _models(hardware["ram_total_gb"]),
        # Never includes an API key: custom.public() strips it to a hint.
        "custom_models": custom.public(),
        # Tokens each BYOK endpoint has used. Counts only - never a price,
        # because rates differ per provider and a wrong number is worse.
        "usage": usage_store.all_summaries(),
        "hardware": hardware,
        "recommended_model": recommend_tier(hardware["ram_total_gb"]),
        "tools": _tool_list(),
        "laya_loaded": _laya_loaded(),
        "log": {"turns": _log_turns()},
        "memory": {"count": long_term.count()},
    }


def _memory_for(cid: str) -> ShortTermMemory:
    if cid not in sessions:
        memory = ShortTermMemory()
        for m in storage.recent_history(cid, memory.max_turns * 2):
            memory.add(m["role"], m["content"])
        sessions[cid] = memory
    return sessions[cid]


def _decode_images(raw: list[str]) -> list[str]:
    if len(raw) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"You can attach up to {MAX_IMAGES} images.")
    clean = []
    for item in raw:
        b64 = item.split(",", 1)[1] if item.startswith("data:") else item
        try:
            data = base64.b64decode(b64, validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(status_code=400, detail="One of the images couldn't be read.")
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=400, detail="One of the images is too large (max 8MB).")
        if storage.image_ext(data) is None:
            raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP and GIF images are supported.")
        clean.append(b64)
    return clean


def _tier_or_400(name: str | None) -> str | None:
    """A requested tier, or a plain explanation of why it can't be used."""
    if name is None:
        return None
    tier = normalize_tier(name)
    if tier is None:
        raise HTTPException(status_code=400,
                            detail=f"Unknown model '{name}'. The models are: {', '.join(TIER_ORDER)}.")
    cfg = load_tier_config(tier)
    if is_placeholder(tier):
        raise HTTPException(status_code=400, detail=cfg.get("placeholder_note")
                            or f"{cfg['label']} has no model behind it yet. Pick another model.")
    if cfg.get("kind") == "byok" and offline():
        raise HTTPException(
            status_code=400,
            detail=(f"{cfg['label']} sends the conversation to {cfg.get('host')}, and offline mode is on. "
                    "Turn offline mode off in Settings - Privacy, or pick a local model."))
    return tier


def _validate(req: ChatRequest) -> tuple[str, list[str], ShortTermMemory]:
    if not req.conversation_id or len(req.conversation_id) > 64:
        raise HTTPException(status_code=400, detail="Invalid conversation id.")
    req.model = _tier_or_400(req.model)
    if req.effort and req.effort not in EFFORT_STEPS:
        raise HTTPException(status_code=400, detail=f"Unknown effort '{req.effort}'.")

    text = req.message.strip()
    images = _decode_images(req.images)
    if not text and not images:
        raise HTTPException(status_code=400, detail="Message is empty.")
    if images and not load_tier_config(req.model).get("vision", False):
        raise HTTPException(status_code=400, detail="This model can't see images. Pick a different one.")
    if req.skill:
        try:
            skills.load(req.skill)
        except skills.SkillError as e:
            raise HTTPException(status_code=404, detail=str(e)) from e
    return text or DEFAULT_IMAGE_PROMPT, images, _memory_for(req.conversation_id)


def _save_user_message(cid: str, text: str, images: list[str]) -> None:
    storage.ensure_conversation(cid, text)
    names = [storage.save_image(b) for b in images]
    storage.add_message(cid, "user", text, {"images": names} if names else None)


def _save_reply(cid: str, event: dict) -> None:
    # "skill" is the only thing a skill leaves behind: the name, so a later
    # "do that again with the same skill" resolves to something real.
    meta = {k: event.get(k) for k in ("route", "router", "model", "effort", "tools", "skill")}
    storage.add_message(cid, "assistant", event["reply"], meta)


@app.get("/status")
def status():
    settings = get_settings()
    profile = assistants.get_profile()
    hardware = get_hardware(get_workspace())
    return {
        "models": _models(hardware["ram_total_gb"]),
        "default_model": profile["model"],
        "efforts": list(EFFORT_STEPS.keys()),
        "default_effort": profile["effort"],
        "router": settings["router"],
        "workspace": get_workspace(),
        "assistant": {"id": profile["id"], "name": profile["name"]},
        # The UI polls /status, so first-run setup is gated on a boolean here
        # rather than on a second request.
        "onboarded": settings["onboarded"],
        # Spend on the selected model, if it is one that bills. The status bar
        # shows it during a conversation, where a runaway turn is noticeable.
        "usage": usage_store.summary(profile["model"]) if custom.is_custom(profile["model"]) else None,
        "adapters": list_adapters(),
        "tools": _available_tools(),
        # So the dislike popover and feedback.json can't drift apart.
        "feedback_reasons": [{"code": c, "label": l} for c, l in feedback.REASONS.items()],
    }


@app.get("/settings")
def read_settings():
    return _settings_payload()


@app.put("/settings")
def write_settings(patch: dict = Body(...)):
    # Profile fields and global settings arrive together; split them.
    profile_fields = set(assistants.PROFILE_DEFAULTS)
    settings_patch = {k: v for k, v in patch.items() if k not in profile_fields}
    profile_patch = {k: v for k, v in patch.items() if k in profile_fields}

    if isinstance(profile_patch.get("tools"), dict):
        tools = {k: v for k, v in profile_patch["tools"].items() if k in TOOLS}
        merged = dict(assistants.get_profile().get("tools", {}))
        merged.update(tools)
        profile_patch["tools"] = merged
    if "custom_instructions" in profile_patch:
        profile_patch["custom_instructions"] = str(profile_patch["custom_instructions"]).strip()[:1000]

    try:
        if settings_patch:
            update_settings(settings_patch)
        if profile_patch:
            assistants.update_profile(profile_patch)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if patch.get("router") == "laya":
        _maybe_load_laya()
    return _settings_payload()


MAX_AUDIO_BYTES = 10 * 1024 * 1024  # a minute of 16kHz mono is about 2MB


@app.post("/stt")
async def speech_to_text(request: Request):
    """Audio in, text out. Local only: nothing here reaches the network."""
    data = await request.body()
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="That recording is too large to transcribe.")
    try:
        return stt.transcribe(data)
    except stt.NoSpeech as e:
        # Not an error in Shadow: the microphone simply heard nothing useful.
        raise HTTPException(status_code=422, detail=str(e))
    except stt.SttError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get("/stt/status")
def speech_status():
    return stt.status()


@app.post("/preview")
async def link_previews(body: PreviewRequest):
    """Metadata for the links in a reply, so the UI can draw cards.

    Fetched here rather than in the browser: otherwise every link in a
    reply would hand the user's IP to that site. Failures come back as
    ok:false with a reason and the UI falls back to a plain link.
    """
    return await preview.previews(body.urls)


@app.get("/preview/image")
async def preview_image(u: str):
    """A card's image, passed through the brain for the same reason."""
    try:
        data, content_type = await preview.image(u)
    except preview.PreviewError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"That image couldn't be fetched: {e}") from e
    # Cached by the browser too: these never change for a given URL.
    return Response(content=data, media_type=content_type,
                    headers={"Cache-Control": "private, max-age=86400"})


@app.post("/open-file")
def open_file(body: OpenFileRequest):
    """Open a workspace file in whatever the user's computer uses for it.

    Clicking a file chip in a reply is the only thing that calls this, and
    it is confined to the workspace like every other file operation.
    """
    import subprocess

    from tools.files import _safe_path

    try:
        full = _safe_path(body.path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not os.path.exists(full):
        raise HTTPException(status_code=404, detail=f"'{body.path}' isn't in the workspace any more.")

    system = platform.system()
    command = {"Darwin": ["open", full], "Windows": ["cmd", "/c", "start", "", full]}.get(
        system, ["xdg-open", full])
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=10)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Couldn't open it: {e}") from e
    if result.returncode != 0:
        raise HTTPException(status_code=500,
                            detail=f"Couldn't open it: {result.stderr.strip() or 'no reason given'}")
    return {"ok": True, "path": full}


@app.get("/models/installed")
def installed_models():
    """What the user has pulled in Ollama, so BYOM is a choice from a list
    rather than a string they have to remember."""
    try:
        return {"models": custom.installed_ollama()}
    except custom.CustomError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


# The embedder long-term memory runs on. Setup pulls it alongside the chat
# model, because without it memory fails on first use with nothing on screen
# to explain why.
EMBED_MODEL = "nomic-embed-text"


class PullRequest(BaseModel):
    model: str


@app.post("/models/pull")
def pull_model(req: PullRequest):
    """Download an Ollama model, reporting progress as it goes.

    Ollama fetches this from registry.ollama.ai, so it is an outbound call
    and offline mode has to block it - the same three-layer refusal the web
    tools use, checked here as well as in the UI.
    """
    name = (req.model or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Say which model to download.")
    if offline():
        raise HTTPException(
            status_code=403,
            detail="Blocked: offline mode is on, so nothing may be downloaded. "
                   "Turn it off in Settings - Privacy to pull a model.",
        )

    def events():
        try:
            for chunk in ollama.pull(name, stream=True):
                status = getattr(chunk, "status", "") or ""
                completed = getattr(chunk, "completed", None)
                total = getattr(chunk, "total", None)
                yield _sse({
                    "type": "progress",
                    "model": name,
                    "status": status,
                    "completed": completed,
                    "total": total,
                })
            yield _sse({"type": "done", "model": name})
        except Exception as e:
            # Report it rather than ending the stream silently: a pull that
            # stops with no reason looks like a hung progress bar.
            print(f"[models] pull of {name} failed: {e}")
            yield _sse({"type": "error", "model": name,
                        "message": f"Couldn't download {name}: {e}"})

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache"})


@app.get("/models/needed")
def models_needed(tier: str = TIER_ORDER[0]):
    """What first-run setup still has to download for a tier.

    The UI asks before showing the download step, so a machine that already
    has both models skips the wait instead of watching two instant bars.
    """
    name = normalize_tier(tier) or TIER_ORDER[0]
    try:
        cfg = load_tier_config(name)
    except (ValueError, OSError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    wanted = []
    if cfg.get("base_model") and not cfg.get("custom"):
        wanted.append(cfg["base_model"])
    # The embedder is not optional: long-term memory has nothing to store
    # without it, and fails with no explanation on screen.
    wanted.append(EMBED_MODEL)

    installed = _installed_models()
    if installed is None:
        # Ollama isn't answering. Don't claim everything is missing - say so,
        # and let the UI show the real reason.
        return {"wanted": wanted, "missing": [], "ollama_up": False}
    return {"wanted": wanted,
            "missing": [m for m in wanted if not _have_model(m, installed)],
            "ollama_up": True}


@app.get("/models/custom")
def custom_models():
    return {"models": custom.public()}


@app.post("/models/custom")
def add_custom_model(body: CustomModelRequest):
    try:
        if body.kind == "byom":
            entry = custom.add_byom(body.model, body.label, body.vision, body.tools)
        elif body.kind == "byok":
            entry = custom.add_byok(body.base_url, body.model, body.key, body.label,
                                    bool(body.vision), True if body.tools is None else bool(body.tools))
        else:
            raise HTTPException(status_code=400, detail="A model is either 'byom' or 'byok'.")
    except custom.CustomError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"model": entry, "models": custom.public()}


@app.patch("/models/custom/{mid}")
def patch_custom_model(mid: str, body: CustomModelPatch):
    patch = body.model_dump(exclude_none=True)
    try:
        entry = custom.update(mid, patch)
    except custom.CustomError as e:
        # A rejected cap is the user getting a number wrong, not a model that
        # has gone missing, so it mustn't come back as a 404.
        status = 400 if "cap" in str(e).lower() else 404
        raise HTTPException(status_code=status, detail=str(e)) from e
    return {"model": entry, "models": custom.public()}


@app.delete("/models/custom/{mid}")
def delete_custom_model(mid: str):
    if not custom.remove(mid):
        raise HTTPException(status_code=404, detail="That model isn't in your list.")
    # An assistant pointing at it would otherwise be stuck on a model that
    # no longer exists, so it falls back to the floor.
    moved = []
    for aid in assistants.list_ids():
        # The stored value, not the normalized one: reading a profile already
        # falls back to the floor, which would hide the stale id.
        if assistants.raw_model(aid) == mid:
            assistants.update_profile({"model": TIER_ORDER[0]}, aid)
            moved.append(aid)
    return {"ok": True, "models": custom.public(), "moved_to_default": moved}


@app.post("/models/custom/{mid}/test")
def test_custom_model(mid: str):
    """One small request, so a broken endpoint is found here rather than
    halfway through a conversation."""
    entry = custom.get(mid)
    if entry is None:
        raise HTTPException(status_code=404, detail="That model isn't in your list.")
    if entry["kind"] == "byom":
        caps = custom.detect_ollama(entry["model"])
        if not caps["detected"]:
            return {"ok": False, "detail": f"Ollama didn't report on {entry['model']}. Is it still pulled?"}
        return {"ok": True, "vision": caps["vision"], "tools": caps["tools"],
                "detail": (f"{entry['model']} is in your Ollama. Tool calling: "
                           f"{'yes' if caps['tools'] else 'no'}; vision: {'yes' if caps['vision'] else 'no'}.")}
    if offline():
        return {"ok": False, "detail": "Offline mode is on, so Shadow can't reach that endpoint."}
    import providers
    result = providers.probe(load_tier_config(mid))
    if result.get("ok") and not result.get("tools", True):
        custom.update(mid, {"tools": False})
    return result


class AssistantRequest(BaseModel):
    name: str
    profile: dict | None = None


@app.get("/assistants")
def list_assistants():
    """Every assistant, for the dashboard. Includes how much each one owns,
    so a card can say what deleting it would cost."""
    return {
        "assistants": assistants.summaries(),
        "max": assistants.MAX_ASSISTANTS,
        "active": assistants.active_id(),
    }


@app.post("/assistants")
def create_assistant(req: AssistantRequest):
    try:
        profile = assistants.create(req.name, req.profile)
    except assistants.AssistantError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    print(f"[assistants] created {profile['id']} ({profile['name']})")
    return {"assistant": profile}


@app.post("/assistants/{aid}/activate")
def activate_assistant(aid: str):
    if aid not in assistants.list_ids():
        raise HTTPException(status_code=404, detail="That assistant doesn't exist any more.")
    assistants.set_active(aid)
    # Short-term memory is keyed by conversation id alone, so anything left
    # in it belongs to the assistant we just switched away from.
    sessions.clear()
    # Create this assistant's tables if it has never been chatted to. Both
    # resolve their path through assistants.* on every call, so they pick up
    # the new active assistant with no further plumbing.
    storage.init()
    long_term.init()
    profile = assistants.get_profile(aid)
    print(f"[assistants] active assistant is now {aid} ({profile['name']})")
    return {"assistant": profile}


@app.patch("/assistants/{aid}")
def patch_assistant(aid: str, patch: dict = Body(...)):
    """Edit any assistant, active or not.

    PUT /settings only ever writes to the active assistant, so without this
    the dashboard would have to switch to an assistant just to rename it -
    a side effect nobody asked for. Tool states merge the same way, against
    this assistant's own profile rather than the active one's.
    """
    if aid not in assistants.list_ids():
        raise HTTPException(status_code=404, detail="That assistant doesn't exist any more.")

    fields = {k: v for k, v in patch.items() if k in assistants.PROFILE_DEFAULTS}
    if not fields:
        raise HTTPException(status_code=400, detail="Nothing to change.")

    if isinstance(fields.get("tools"), dict):
        tools = {k: v for k, v in fields["tools"].items() if k in TOOLS}
        merged = dict(assistants.get_profile(aid).get("tools", {}))
        merged.update(tools)
        fields["tools"] = merged
    if "name" in fields:
        name = str(fields["name"]).strip()
        if not name:
            raise HTTPException(status_code=400, detail="Give the assistant a name.")
        fields["name"] = name[:40]
    if "custom_instructions" in fields:
        fields["custom_instructions"] = str(fields["custom_instructions"]).strip()[:1000]

    try:
        profile = assistants.update_profile(fields, aid)
    except (ValueError, OSError) as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"assistant": profile}


@app.delete("/assistants/{aid}")
def delete_assistant(aid: str):
    """Destroys the assistant's chats, memory and images. The UI confirms
    with the real counts before calling this."""
    try:
        removed = assistants.delete(aid)
    except assistants.AssistantError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except OSError as e:
        raise HTTPException(status_code=500,
                            detail=f"Couldn't delete that assistant's folder: {e}") from e
    sessions.clear()
    storage.init()
    long_term.init()
    print(f"[assistants] deleted {aid} ({removed['name']}): "
          f"{removed['chats']} chats, {removed['memories']} memories")
    return {"removed": removed, "active": assistants.active_id()}


@app.get("/skills")
def list_skills():
    """For the composer's slash menu and the Settings list. Deliberately not
    part of /status and never put in a prompt: Shadow only knows about a skill
    when the user invokes one by name."""
    return {"skills": skills.list_skills()}


@app.get("/skills/{name}")
def get_skill(name: str):
    try:
        return skills.load(name)
    except skills.SkillError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@app.get("/privacy")
def privacy_report():
    """What can leave this computer, and what is stored on it."""
    return privacy.report(LOG_PATH)


@app.delete("/data/chats")
def clear_chats():
    removed = storage.delete_all_conversations()
    sessions.clear()
    return {"ok": True, "removed": removed}


@app.get("/data/log/export")
def export_log():
    if not os.path.exists(LOG_PATH):
        raise HTTPException(status_code=404, detail="There's no log yet.")
    return FileResponse(LOG_PATH, media_type="application/x-ndjson", filename="shadow-turns.jsonl")


@app.delete("/data/log")
def clear_log():
    try:
        os.remove(LOG_PATH)
    except FileNotFoundError:
        pass
    return {"ok": True}


@app.get("/images/{name}")
def image(name: str):
    path = storage.image_path(name)
    if path is None:
        raise HTTPException(status_code=404, detail="Image not found.")
    return FileResponse(path)


@app.get("/conversations")
def conversations():
    return storage.list_conversations()


@app.get("/conversations/{cid}")
def conversation(cid: str):
    conv = storage.get_conversation(cid)
    if conv is None:
        raise HTTPException(status_code=404, detail="That chat doesn't exist.")
    return conv


@app.patch("/conversations/{cid}")
def rename_conversation(cid: str, body: RenameRequest):
    title = " ".join(body.title.split())[:80]
    if not title:
        raise HTTPException(status_code=400, detail="The title can't be empty.")
    if not storage.rename_conversation(cid, title):
        raise HTTPException(status_code=404, detail="That chat doesn't exist.")
    return {"ok": True}


@app.delete("/conversations/{cid}")
def delete_conversation(cid: str):
    storage.delete_conversation(cid)
    sessions.pop(cid, None)
    return {"ok": True}


@app.post("/permission/{pid}")
def answer_permission(pid: str, body: PermissionAnswer):
    if body.decision not in ("allow", "deny", "always"):
        raise HTTPException(status_code=400, detail="Decision must be allow, deny or always.")
    if not permissions.resolve(pid, body.decision):
        raise HTTPException(status_code=404, detail="This request has expired.")
    return {"ok": True}


def _rerun_setup(req: RerunRequest, new_text: str | None) -> tuple[str, list[str], str | None]:
    """Prepare a conversation for running its last turn again.

    Everything after the user's message goes - the old reply is replaced,
    not appended, so chats.db never holds an orphaned answer. Short-term
    memory is rebuilt from the turns *before* this one, or the message would
    appear twice: once as history and once as the question.
    """
    cid = req.conversation_id
    if not cid or len(cid) > 64:
        raise HTTPException(status_code=400, detail="Invalid conversation id.")
    req.model = _tier_or_400(req.model)
    if req.effort and req.effort not in EFFORT_STEPS:
        raise HTTPException(status_code=400, detail=f"Unknown effort '{req.effort}'.")

    user = storage.last_user_message(cid)
    if user is None:
        raise HTTPException(status_code=404, detail="There's nothing to run again in this chat yet.")

    text = (new_text if new_text is not None else user["content"]).strip()
    names = user["meta"].get("images") or []
    if not text and not names:
        raise HTTPException(status_code=400, detail="A message can't be empty.")

    images = []
    for name in names:
        b64 = storage.image_b64(name)
        if b64:
            images.append(b64)
        else:
            print(f"[chat] image {name} is missing from disk; running without it")
    if images and not load_tier_config(req.model).get("vision", False):
        raise HTTPException(status_code=400,
                            detail="This message has images and the chosen model can't see them. Pick a different one.")

    # The reply being replaced says which skill the user invoked, so a
    # regenerate runs the same way the first attempt did.
    old_reply = storage.message_after(cid, user["seq"])
    skill = (old_reply or {}).get("meta", {}).get("skill")

    storage.delete_after(cid, user["seq"])

    if new_text is not None and text != user["content"]:
        # Only re-title when the title was generated from this message in the
        # first place: a title the user typed themselves stays theirs.
        auto_title = " ".join(user["content"].split())[:60]
        if storage.first_message_id(cid) == user["id"] and storage.conversation_title(cid) == auto_title:
            storage.rename_conversation(cid, " ".join(text.split())[:60] or "New chat")
        storage.update_message(user["id"], content=text)

    memory = ShortTermMemory()
    for m in storage.history_before(cid, user["seq"], memory.max_turns * 2):
        memory.add(m["role"], m["content"])
    sessions[cid] = memory

    return text, images, skill


def _turn_error(cid: str, exc: Exception, model: str | None) -> dict:
    """Translate a failed turn into something the user can act on, and save
    the plain words rather than the library's.

    The saved copy is the message text, which carries the command or the next
    step inside it - so a reopened chat loses the button the stream offered,
    not the information.
    """
    try:
        tier = normalize_tier(model) or assistants.get_profile()["model"]
        base = load_tier_config(tier).get("base_model")
    except (ValueError, OSError):
        tier, base = None, None
    event = errors.event(exc, model=base, tier=tier)
    if event["kind"] != "unknown":
        print(f"[chat] {event['kind']}: {event.get('detail') or event['message']}")
    storage.add_message(cid, "error", event["message"])
    return event


def _stream_turn_response(cid: str, text: str, memory: ShortTermMemory, model, effort,
                          images: list[str], skill: str | None):
    def events():
        try:
            for event in stream_turn(text, memory, model, effort, images, skill):
                if event["type"] == "done":
                    _save_reply(cid, event)
                yield _sse(event)
        except Exception as e:
            yield _sse(_turn_error(cid, e, model))

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache"})


@app.post("/chat/regenerate")
def chat_regenerate(req: RerunRequest):
    """Answer the same question again, fresh. Uses whatever model and effort
    the pickers are on now, not the ones the first reply used."""
    text, images, skill = _rerun_setup(req, None)
    return _stream_turn_response(req.conversation_id, text, sessions[req.conversation_id],
                                 req.model, req.effort, images, skill)


@app.post("/chat/edit")
def chat_edit(req: RerunRequest):
    """Change the last question and answer it again."""
    if req.message is None:
        raise HTTPException(status_code=400, detail="Send the new text of the message.")
    text, images, skill = _rerun_setup(req, req.message)
    return _stream_turn_response(req.conversation_id, text, sessions[req.conversation_id],
                                 req.model, req.effort, images, skill)


@app.post("/feedback")
def rate_reply(body: FeedbackRequest):
    """A thumb up or down on one reply. Stored twice on purpose: in the
    message's meta so the UI still shows it after a refresh, and in
    data/feedback.json with the whole turn, which is the training signal."""
    message = storage.get_message(body.message_id)
    if message is None:
        raise HTTPException(status_code=404,
                            detail="That reply isn't saved yet, so it can't be rated. Try again in a moment.")
    if message["role"] != "assistant":
        raise HTTPException(status_code=400, detail="Only Shadow's replies can be rated.")

    question = storage.user_before(message["conversation_id"], message["seq"])
    try:
        record = feedback.record(
            body.message_id,
            body.rating,
            conversation_id=message["conversation_id"],
            user_input=(question or {}).get("content", ""),
            reply=message["content"],
            meta=message["meta"],
            reason_code=body.reason_code,
            reason=body.reason,
        )
    except feedback.FeedbackError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    storage.update_message(body.message_id, meta_patch={
        "rating": body.rating,
        "rating_reason": (body.reason or "").strip()[:feedback.MAX_REASON] or None,
        "rating_reason_code": body.reason_code or None,
        "rating_reason_label": feedback.REASONS.get(body.reason_code or "") or None,
    })
    return {"ok": True, "rating": body.rating, "stored": record is not None, "stats": feedback.stats()}


@app.get("/feedback")
def feedback_summary():
    return {"reasons": [{"code": c, "label": l} for c, l in feedback.REASONS.items()],
            "stats": feedback.stats()}


@app.get("/search")
def search_chats(q: str = "", limit: int = 30):
    """Titles and message text. Two characters minimum, or every chat matches."""
    query = (q or "").strip()
    if len(query) < 2:
        return {"query": query, "results": [], "short": True}
    return {"query": query, "results": storage.search(query, max(1, min(limit, 100))), "short": False}


@app.get("/conversations/{cid}/export")
def export_conversation(cid: str, format: str = "md"):
    if format not in ("md", "json"):
        raise HTTPException(status_code=400, detail="Export format is 'md' or 'json'.")
    conv = storage.get_conversation(cid)
    if conv is None:
        raise HTTPException(status_code=404, detail="That chat doesn't exist.")
    return export.build(conv, format, assistants.get_profile()["name"])


@app.post("/chat")
def chat(req: ChatRequest):
    text, images, memory = _validate(req)
    cid = req.conversation_id
    _save_user_message(cid, text, images)
    try:
        result = handle_turn(text, memory, req.model, req.effort, images, req.skill)
    except Exception as e:
        event = _turn_error(cid, e, req.model)
        raise HTTPException(status_code=500, detail=event["message"])
    _save_reply(cid, result)
    return result


@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    text, images, memory = _validate(req)
    cid = req.conversation_id
    _save_user_message(cid, text, images)

    def events():
        try:
            for event in stream_turn(text, memory, req.model, req.effort, images, req.skill):
                if event["type"] == "done":
                    _save_reply(cid, event)
                yield _sse(event)
        except Exception as e:
            yield _sse(_turn_error(cid, e, req.model))

    return StreamingResponse(events(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache"})


@app.post("/reset/{conversation_id}")
def reset(conversation_id: str):
    sessions.pop(conversation_id, None)
    return {"ok": True}

@app.get("/memory")
def list_memory():
    return {"memories": long_term.all_memories(), "count": long_term.count()}


@app.delete("/memory/{mid}")
def delete_memory(mid: str):
    long_term.delete(mid)
    return {"ok": True}


@app.delete("/memory")
def clear_memory():
    long_term.clear()
    return {"ok": True}

@app.get("/greetings")
def get_greetings():
    from greetings import greetings
    return {"greetings": greetings()}
