import os
import platform
import re
import shutil
import signal
import subprocess

from config import get_workspace
from settings import get_settings

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

# Provider keys and tokens in the brain's environment must not reach commands.
KEEP_ENV = {"PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TERM", "TMPDIR", "TZ",
            "SYSTEMROOT", "SYSTEMDRIVE", "COMSPEC", "PATHEXT", "WINDIR", "USERPROFILE",
            "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "TEMP", "TMP", "NUMBER_OF_PROCESSORS"}


def _env() -> dict:
    return {k: v for k, v in os.environ.items() if k in KEEP_ENV or k.startswith("LC_")}


TIMEOUT_S = 30

OFFLINE_BLOCKED = ("Blocked: offline mode is on, and on this system Shadow can't stop a command "
                   "from reaching the network, so commands don't run. Turn offline mode off in "
                   "Settings - Privacy to use run_command.")


def _offline() -> bool:
    return bool(get_settings().get("offline"))


def _can_sandbox() -> bool:
    return platform.system() == "Darwin" and bool(shutil.which("sandbox-exec"))


def _sandboxed(command: str) -> list[str] | None:
    if not _can_sandbox():
        return None
    data = os.path.realpath(DATA_DIR).replace("\\", "\\\\").replace('"', '\\"')
    profile = f'(version 1)(allow default)(deny file-read* file-write* (subpath "{data}"))'
    if _offline():
        profile += '(deny network-outbound (remote ip))(allow network-outbound (remote ip "localhost:*"))'
    return ["sandbox-exec", "-p", profile, "/bin/sh", "-c", command]


def describe(command=None) -> str:
    protected = ("Shadow's own data folder is walled off" if _can_sandbox()
                 else "nothing walls off Shadow's own data folder on this system")
    network = ("only this computer, since offline mode is on" if _offline() and _can_sandbox()
               else "the network")
    return ("Runs in a shell with your account's full access: it can read and change any file you "
            f"can, and reach {network}. The blocklist is a seatbelt, not a sandbox; {protected}.")


DENYLIST = [
    "rm -rf", "rm -r /", "sudo", "mkfs", "dd if=", ":(){",
    "shutdown", "reboot", "> /dev/", "chmod -r 777 /",
]


def run_command(command: str) -> str:
    command = str(command or "")
    lowered = command.lower()
    for bad in DENYLIST:
        if bad in lowered:
            return f"Blocked: command contains '{bad}'."

    # Web pages must go through web_search / fetch_url, which return readable
    # text and clear errors. Local addresses are still allowed, for testing apps.
    if re.search(r"\b(curl|wget)\b", lowered) and re.search(r"https?://", lowered):
        if not re.search(r"https?://(localhost|127\.0\.0\.1)", lowered):
            return ("Blocked: don't fetch websites with curl or wget. "
                    "Ask the user to let you look it up, which uses proper web tools.")

    if _offline() and not _can_sandbox():
        return OFFLINE_BLOCKED

    wrapped = _sandboxed(command)
    proc = subprocess.Popen(
        wrapped if wrapped else command,
        shell=wrapped is None,
        cwd=get_workspace(),
        env=_env(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        **_new_group(),
    )
    try:
        stdout, stderr = proc.communicate(timeout=TIMEOUT_S)
    except subprocess.TimeoutExpired:
        _kill_group(proc)
        proc.communicate()
        return (f"Error: command timed out after {TIMEOUT_S} seconds, and everything it started "
                "was stopped, including anything meant to keep running, like a server.")

    output = stdout.strip()
    if stderr.strip():
        output += f"\n[stderr]\n{stderr.strip()}"
    output += f"\n[exit code {proc.returncode}]"
    if len(output) > 6000:
        output = output[:6000] + "\n...[truncated]"
    return output


def _new_group() -> dict:
    if os.name == "nt":
        return {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    return {"start_new_session": True}


def _kill_group(proc: subprocess.Popen) -> None:
    if os.name == "nt":
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
        return
    try:
        os.killpg(proc.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
