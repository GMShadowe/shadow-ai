"""Shell tool. Starts in the workspace, with a denylist. This is NOT a real
sandbox: a command runs with the user's own access to their files. Two
things are kept from it, because they are Shadow's own secrets:

- **The brain's environment.** Commands get a minimal one (PATH, HOME,
  locale), not the brain's, which may hold provider API keys or tokens.
- **Shadow's data folder** - the BYOK API key, the access token, chats and
  memory. On macOS the command runs under sandbox-exec with that folder
  denied for reading and writing. Elsewhere there is no comparable
  built-in tool, and the approval card says so.
"""

import os
import platform
import re
import shutil
import subprocess

from config import get_workspace

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

# What a command keeps from the brain's environment. Everything else - API
# keys, SHADOW_* settings, tokens a launcher exported - stays behind.
KEEP_ENV = {"PATH", "HOME", "USER", "LOGNAME", "SHELL", "LANG", "TERM", "TMPDIR", "TZ",
            # Windows needs these to start anything at all.
            "SYSTEMROOT", "SYSTEMDRIVE", "COMSPEC", "PATHEXT", "WINDIR", "USERPROFILE",
            "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "TEMP", "TMP", "NUMBER_OF_PROCESSORS"}


def _env() -> dict:
    return {k: v for k, v in os.environ.items() if k in KEEP_ENV or k.startswith("LC_")}


def _sandboxed(command: str) -> list[str] | None:
    """The command wrapped so it can't read or write Shadow's data folder,
    or None where that isn't available."""
    if platform.system() != "Darwin" or not shutil.which("sandbox-exec"):
        return None
    data = os.path.realpath(DATA_DIR).replace("\\", "\\\\").replace('"', '\\"')
    profile = f'(version 1)(allow default)(deny file-read* file-write* (subpath "{data}"))'
    return ["sandbox-exec", "-p", profile, "/bin/sh", "-c", command]


def describe(command=None) -> str:
    """For the approval card: what Allow actually permits."""
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
