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
    data = os.path.realpath(DATA_DIR).replace("\\", "\\\\").replace('"', '\\"')
    profile = f'(version 1)(allow default)(deny file-read* file-write* (subpath "{data}"))'
    if _offline():
        profile += '(deny network-outbound (remote ip))(allow network-outbound (remote ip "localhost:*"))'
    return ["sandbox-exec", "-p", profile, "/bin/sh", "-c", command]


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


def run_command(command: str, background=False) -> str:
    command, trailing = _split_background(str(command or ""))
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

    output = stdout.strip()
    if stderr.strip():
        output += f"\n[stderr]\n{stderr.strip()}"
    output += f"\n[exit code {proc.returncode}]"
    if len(output) > 6000:
        output = output[:6000] + "\n...[truncated]"
    return output


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
