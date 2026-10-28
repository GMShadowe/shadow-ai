"""Shell tool. Runs inside the workspace with a denylist. This is NOT a
real sandbox, just a seatbelt. Don't point it at anything you care about."""

import re
import subprocess

from config import get_workspace

DENYLIST = [
    "rm -rf", "rm -r /", "sudo", "mkfs", "dd if=", ":(){",
    "shutdown", "reboot", "> /dev/", "chmod -r 777 /",
]


def run_command(command: str) -> str:
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

    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=get_workspace(),
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
