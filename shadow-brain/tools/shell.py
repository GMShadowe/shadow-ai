import os
import platform
import re
import shutil
import subprocess

from config import get_workspace

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

# Provider keys and tokens in the brain's environment must not reach commands.
KEEP_ENV = {"PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TERM", "TMPDIR", "TZ",
            "SYSTEMROOT", "SYSTEMDRIVE", "COMSPEC", "PATHEXT", "WINDIR", "USERPROFILE",
            "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "TEMP", "TMP", "NUMBER_OF_PROCESSORS"}


def _env() -> dict:
    return {k: v for k, v in os.environ.items() if k in KEEP_ENV or k.startswith("LC_")}


def _sandboxed(command: str) -> list[str] | None:
    if platform.system() != "Darwin" or not shutil.which("sandbox-exec"):
        return None
    data = os.path.realpath(DATA_DIR).replace("\\", "\\\\").replace('"', '\\"')
    profile = f'(version 1)(allow default)(deny file-read* file-write* (subpath "{data}"))'
    return ["sandbox-exec", "-p", profile, "/bin/sh", "-c", command]


def describe(command=None) -> str:
    protected = ("Shadow's own data folder is walled off" if _sandboxed("true")
                 else "nothing walls off Shadow's own data folder on this system")
    return ("Runs in a shell with your account's full access: it can read and change any file you "
            f"can, and reach the network. The blocklist is a seatbelt, not a sandbox; {protected}.")


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

    wrapped = _sandboxed(command)
    try:
        result = subprocess.run(
            wrapped if wrapped else command,
            shell=wrapped is None,
            cwd=get_workspace(),
            env=_env(),
            capture_output=True,
            text=True,
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        return "Error: command timed out after 30 seconds."

    output = result.stdout.strip()
    if result.stderr.strip():
        output += f"\n[stderr]\n{result.stderr.strip()}"
    output += f"\n[exit code {result.returncode}]"
    if len(output) > 6000:
        output = output[:6000] + "\n...[truncated]"
    return output
