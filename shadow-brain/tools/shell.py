import os
import platform
import re
import shutil
import signal
import subprocess
import tempfile
import threading

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
    data, skills = (_quoted(os.path.realpath(p)) for p in (DATA_DIR, os.path.join(DATA_DIR, "skills")))
    # Added skills' scripts can be read and run, never changed.
    profile = (f'(version 1)(allow default)(deny file-read* file-write* (subpath "{data}"))'
               f'(allow file-read* (subpath "{skills}"))(allow file-read-metadata (literal "{data}"))')
    if _offline():
        profile += '(deny network-outbound (remote ip))(allow network-outbound (remote ip "localhost:*"))'
    return ["sandbox-exec", "-p", profile, "/bin/sh", "-c", command]


def _quoted(path: str) -> str:
    return path.replace("\\", "\\\\").replace('"', '\\"')


def describe(command=None, background=None) -> str:
    protected = ("Shadow's own data folder is walled off" if _can_sandbox()
                 else "nothing walls off Shadow's own data folder on this system")
    network = ("only this computer, since offline mode is on" if _offline() and _can_sandbox()
               else "the network")
    return ("Runs in a shell with your account's full access: it can read and change any file you "
            f"can, and reach {network}. The blocklist is a seatbelt, not a sandbox; {protected}."
            + _keeps_running(command, background))


def _keeps_running(command, background) -> str:
    if _truthy(background) or _split_background(str(command or ""))[1]:
        return " It keeps running after this reply, until it is stopped or Shadow quits."
    return ""


DENYLIST = [
    "rm -rf", "rm -r /", "sudo", "mkfs", "dd if=", ":(){",
    "shutdown", "reboot", "> /dev/", "chmod -r 777 /",
]


# What to do instead, so a blocked command is a turn and not a dead end.
INSTEAD = {
    "rm -rf": "To delete a folder use the delete_dir tool, and delete_file for a file.",
    "rm -r /": "To delete a folder use the delete_dir tool, and delete_file for a file.",
    "sudo": ("Shadow never runs anything as administrator. Give the user the command so they can "
             "run it themselves if they want to."),
}
STDOUT_HEAD = 1500
STDOUT_TAIL = 2500
STDERR_TAIL = 2500


FETCHER_RE = re.compile(r"\b(curl|wget)\b")
LOCAL_RE = re.compile(r"\b(localhost|127\.0\.0\.1|0\.0\.0\.0)\b|\[::1\]")
JUST_ASKING_RE = re.compile(r"^\s*(curl|wget)\s+(--version|-V|--help|-h)\s*$")


def fetches_the_web(command: str) -> bool:
    """curl or wget aimed anywhere but this computer. A bare host counts:
    "curl wttr.in/Ahmedabad" has no scheme and went straight through."""
    if not FETCHER_RE.search(command) or JUST_ASKING_RE.match(command):
        return False
    return not LOCAL_RE.search(command)


def run_command(command: str, background=False) -> str:
    command, trailing = _split_background(str(command or ""))
    lowered = command.lower()
    for bad in DENYLIST:
        if bad in lowered:
            return f"Blocked: command contains '{bad}'. " + INSTEAD.get(bad, "Find another way, or tell the user.")

    # Web pages must go through web_search / fetch_url, which return readable
    # text and clear errors. Local addresses are still allowed, for testing apps.
    if fetches_the_web(lowered):
        return ("Blocked: don't fetch websites with curl or wget. "
                "Ask the user to let you look it up, which uses proper web tools.")

    if _offline() and not _can_sandbox():
        return OFFLINE_BLOCKED

    if trailing or _truthy(background):
        return _start_background(command)

    proc = _spawn(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        stdout, stderr = proc.communicate(timeout=TIMEOUT_S)
    except subprocess.TimeoutExpired:
        _kill_group(proc)
        proc.communicate()
        return (f"Error: command timed out after {TIMEOUT_S} seconds, and everything it started "
                "was stopped. To start something meant to keep running, like a server, run it "
                "again with background set to true.")

    return format_result(command, stdout, stderr, proc.returncode)


def format_result(command: str, stdout: str, stderr: str, code: int) -> str:
    """Errors come last, so long output keeps its start and its end."""
    output = _trim(stdout.strip(), STDOUT_HEAD, STDOUT_TAIL)
    if stderr.strip():
        output += f"\n[stderr]\n{_trim(stderr.strip(), 0, STDERR_TAIL)}"
    output += f"\n[exit code {code}]"
    hint = failure_hint(command, stderr, code)
    return output + (f"\n{hint}" if hint else "")


def _trim(text: str, head: int, tail: int) -> str:
    if len(text) <= head + tail:
        return text
    cut = len(text) - head - tail
    return f"{text[:head]}\n...[{cut} characters cut from the middle]...\n{text[-tail:]}"


def failure_hint(command: str, stderr: str, code: int) -> str:
    if code == 0:
        return ""
    if code == 127 or "command not found" in stderr:
        missing = re.search(r"([\w.\-]+): (?:command )?not found", stderr)
        name = missing.group(1) if missing else "That command"
        return (f"{name} isn't installed on this computer. Don't ask the user to install it: "
                f"try another command that does the same job. {platform_note()}")
    return ("The command failed. Read the error above, then fix the cause and run it again, "
            "or try a different way. Don't stop at reporting the error if you can fix it.")


def platform_note() -> str:
    system = platform.system()
    if system == "Darwin":
        return ("This is macOS with BSD tools: memory is vm_stat or 'top -l 1', addresses are "
                "'ipconfig getifaddr en0' or ifconfig, ports are 'lsof -i :PORT', there is no free, ip or ss.")
    if system == "Windows":
        return "This is Windows: the shell is cmd, so use dir, type, tasklist and where."
    return "This is Linux: free, ip and ss are the usual tools."


def _spawn(command: str, **streams) -> subprocess.Popen:
    wrapped = _sandboxed(command)
    return subprocess.Popen(
        wrapped if wrapped else command,
        shell=wrapped is None,
        cwd=get_workspace(),
        env=_env(),
        stdin=subprocess.DEVNULL,
        text=True,
        **streams,
        **_new_group(),
    )


def _truthy(value) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"true", "yes", "1"}
    return bool(value)


def _split_background(command: str) -> tuple[str, bool]:
    stripped = command.rstrip()
    if stripped.endswith("&") and not stripped.endswith("&&"):
        return stripped[:-1].rstrip(), True
    return command, False


STARTUP_S = 3
MAX_BACKGROUND = 5
_background: dict[int, dict] = {}
_background_lock = threading.Lock()


def _start_background(command: str) -> str:
    _reap()
    with _background_lock:
        if len(_background) >= MAX_BACKGROUND:
            running = "; ".join(f"{pid}: {b['command']}" for pid, b in _background.items())
            return (f"Error: {MAX_BACKGROUND} commands are already running in the background "
                    f"({running}). Stop one with kill_process and its process id first.")
    fd, log = tempfile.mkstemp(prefix="shadow-background-", suffix=".log")
    with os.fdopen(fd, "w") as out:
        proc = _spawn(command, stdout=out, stderr=subprocess.STDOUT)
    try:
        code = proc.wait(timeout=STARTUP_S)
    except subprocess.TimeoutExpired:
        code = None
    printed = _read_log(log)
    if code is not None:
        _remove(log)
        return (f"{printed}\n[it stopped within {STARTUP_S} seconds instead of staying up, "
                f"exit code {code}]").lstrip()

    with _background_lock:
        _background[proc.pid] = {"proc": proc, "command": command, "log": log}
    ports = _listening_ports(proc.pid)
    listening = f" It is listening on port {', '.join(map(str, ports))}." if ports else ""
    return (f"Started, and still running in the background as process {proc.pid}.{listening} "
            f"It keeps running after this reply; kill_process {proc.pid} stops it and everything "
            f"it started.\nWhat it printed in its first {STARTUP_S} seconds:\n{printed or '(nothing)'}")


def _read_log(path: str, limit: int = 4000) -> str:
    try:
        with open(path, errors="replace") as f:
            text = f.read(limit + 1).strip()
    except OSError as e:
        return f"(couldn't read its output: {e})"
    return text[:limit] + "\n...[truncated]" if len(text) > limit else text


def _listening_ports(pid: int) -> list[int]:
    try:
        import psutil
        root = psutil.Process(pid)
        ports = set()
        for p in [root, *root.children(recursive=True)]:
            for c in p.net_connections(kind="inet"):
                if c.status == psutil.CONN_LISTEN:
                    ports.add(c.laddr.port)
        return sorted(ports)
    except Exception as e:
        print(f"[shell] couldn't read the ports of process {pid}: {e}")
        return []


def _remove(path: str) -> None:
    try:
        os.unlink(path)
    except OSError as e:
        print(f"[shell] couldn't remove {path}: {e}")


def _reap() -> None:
    with _background_lock:
        done = [pid for pid, b in _background.items() if b["proc"].poll() is not None]
        for pid in done:
            _remove(_background.pop(pid)["log"])


def started(pid: int) -> dict | None:
    _reap()
    with _background_lock:
        return _background.get(pid)


def stop(pid: int) -> str:
    with _background_lock:
        entry = _background.pop(pid, None)
    if not entry:
        return f"Process {pid} isn't something Shadow started in the background."
    _kill_group(entry["proc"])
    entry["proc"].wait()
    _remove(entry["log"])
    return f"Stopped {entry['command']!r} (process {pid}) and everything it started."


def stop_all() -> None:
    for pid in list(_background):
        print(f"[shell] {stop(pid)}")


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
