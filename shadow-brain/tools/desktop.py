"""Desktop tools: open apps and read basic system info.
Works on macOS, Windows and Linux."""

import os
import platform
import shutil
import subprocess


def _check_app_name(name) -> str | None:
    """An error if `name` isn't a plain application name.

    The name comes from the model, which may be repeating a web page. A path
    would let it launch any file - a script it just wrote included - and a
    leading dash would be read as an option by `open`.
    """
    name = str(name or "").strip()
    if not name:
        return "Error: say which app to open, by its name, like 'Safari' or 'Notes'."
    if "/" in name or "\\" in name or name.startswith(("-", ".")):
        return (f"Error: '{name}' isn't an app name. open_app takes the name of an installed app, "
                "not a path or a file. To open a file, ask the user to open it themselves.")
    if any(ord(c) < 32 for c in name):
        return f"Error: '{name}' isn't an app name."
    return None


def _start_menu_dirs() -> list[str]:
    dirs = [os.path.join(os.environ.get(var, ""), "Microsoft", "Windows", "Start Menu", "Programs")
            for var in ("APPDATA", "PROGRAMDATA")]
    return [d for d in dirs if os.path.isdir(d)]


def _windows_shortcut(name: str) -> str | None:
    """The Start Menu shortcut for an installed app, matched by its name.

    Only shortcuts, never `cmd /c start <name>`: cmd interprets & | > in the
    name, and `start` runs scripts and executables as readily as apps.
    """
    wanted = name.lower().removesuffix(".lnk")
    for root in _start_menu_dirs():
        for dirpath, _dirs, files in os.walk(root):
            for f in files:
                if f.lower().endswith(".lnk") and f[:-4].lower() == wanted:
                    return os.path.join(dirpath, f)
    return None


def open_app(name: str) -> str:
    error = _check_app_name(name)
    if error:
        return error
    name = str(name).strip()
    system = platform.system()
    try:
        if system == "Darwin":
            result = subprocess.run(["open", "-a", name], capture_output=True, text=True, timeout=10)
            if result.returncode != 0:
                return f"Error: couldn't open '{name}'. {result.stderr.strip()}"
        elif system == "Windows":
            shortcut = _windows_shortcut(name)
            if not shortcut:
                return (f"Error: no installed app called '{name}' was found in the Start menu. "
                        "Use the app's name exactly as the Start menu shows it.")
            os.startfile(shortcut)
        else:
            if not shutil.which(name):
                return f"Error: no app called '{name}' found."
            subprocess.Popen([name], start_new_session=True,
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        return f"Error opening '{name}': {e}"
    return f"Opened {name}."


def system_info() -> str:
    lines = [
        f"OS: {platform.system()} {platform.release()}",
        f"Machine: {platform.machine()}",
        f"CPU cores: {os.cpu_count()}",
    ]
    try:
        import psutil
        vm = psutil.virtual_memory()
        lines.append(f"RAM total: {vm.total / 1e9:.1f} GB")
        lines.append(f"RAM free right now: {vm.available / 1e9:.1f} GB")
        lines.append(f"RAM in use right now: {(vm.total - vm.available) / 1e9:.1f} GB")
        lines.append(f"CPU usage right now: {psutil.cpu_percent(interval=0.5)}%")
    except ImportError:
        lines.append("RAM: unknown (install psutil)")

    disk = shutil.disk_usage(os.path.expanduser("~"))
    lines.append(f"Disk free: {disk.free / 1e9:.1f} GB")
    lines.append(f"Disk total: {disk.total / 1e9:.1f} GB")
    return "\n".join(lines)

# Never stopped, whatever the target says: Shadow itself (and whatever
# launched it), the system's first processes, and Ollama, without which the
# turn asking for this can't even finish.
PROTECTED_NAMES = {"ollama", "ollama.exe", "ollama app", "ollama app.exe"}


def _protected_pids() -> set[int]:
    return {0, 1, os.getpid(), os.getppid()}


def _same_name(wanted: str, name: str) -> bool:
    """Exact, ignoring case and a Windows .exe. Substring matching was the
    bug: a one-letter target matched most processes and an empty one matched
    every process, the brain and Ollama included."""
    a, b = wanted.lower(), (name or "").lower()
    return a == b or a == b.removesuffix(".exe") or a.removesuffix(".exe") == b


def find_targets(target) -> tuple[list[dict], str | None]:
    """The processes kill_process would stop, or an error saying why none.

    Used for the approval card as well as the kill, so the user sees exactly
    which processes an Allow covers before they press it.
    """
    try:
        import psutil
    except ImportError:
        return [], "Error: killing processes needs the 'psutil' package."

    wanted = str(target if target is not None else "").strip()
    if not wanted:
        return [], "Error: say which process to stop - its exact name or its process id."
    by_pid = wanted.isdigit()
    if not by_pid and len(wanted) < 2:
        return [], (f"Error: '{wanted}' is too short to name a process. "
                    "Use the process's exact name or its process id.")

    protected = _protected_pids()
    found, refused = [], []
    for proc in psutil.process_iter(["pid", "name"]):
        pid, name = proc.info["pid"], proc.info["name"] or ""
        if not (pid == int(wanted) if by_pid else _same_name(wanted, name)):
            continue
        if pid in protected or name.lower() in PROTECTED_NAMES:
            refused.append(f"{name} (pid {pid})")
            continue
        found.append({"pid": pid, "name": name, "proc": proc})

    if not found:
        if refused:
            return [], ("Error: refusing to stop " + ", ".join(refused) +
                        ": that is Shadow itself, the system, or Ollama, which this conversation runs on.")
        return [], (f"No running process is called exactly '{wanted}'. "
                    "Process names must match in full; use system_info or ask the user for the exact name.")
    return found, None


def describe_kill(target) -> str:
    """For the approval card: what Allow would stop."""
    found, error = find_targets(target)
    if error:
        return error.removeprefix("Error: ")
    names = ", ".join(f"{p['name']} (pid {p['pid']})" for p in found[:20])
    more = f", and {len(found) - 20} more" if len(found) > 20 else ""
    return f"Will stop {len(found)} process(es): {names}{more}"


def kill_process(target: str) -> str:
    import signal
    import psutil

    found, error = find_targets(target)
    if error:
        return error
    killed, failed = [], []
    for p in found:
        try:
            p["proc"].send_signal(signal.SIGTERM)
            killed.append(f"{p['name']} (pid {p['pid']})")
        except psutil.NoSuchProcess:
            continue
        except psutil.AccessDenied:
            failed.append(f"{p['name']} (pid {p['pid']}): permission denied")
    out = []
    if killed:
        out.append("Stopped: " + ", ".join(killed[:10]) + (f" and {len(killed) - 10} more" if len(killed) > 10 else ""))
    if failed:
        out.append("Couldn't stop: " + ", ".join(failed[:10]))
    return "\n".join(out) or "Those processes had already exited."
