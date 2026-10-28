"""Desktop tools: open apps and read basic system info.
Works on macOS, Windows and Linux."""

import os
import platform
import shutil
import subprocess


def open_app(name: str) -> str:
    system = platform.system()
    try:
        if system == "Darwin":
            result = subprocess.run(["open", "-a", name], capture_output=True, text=True, timeout=10)
            if result.returncode != 0:
                return f"Error: couldn't open '{name}'. {result.stderr.strip()}"
        elif system == "Windows":
            subprocess.Popen(["cmd", "/c", "start", "", name])
        else:
            if not shutil.which(name):
                return f"Error: no app called '{name}' found."
            subprocess.Popen([name], start_new_session=True)
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

def kill_process(target: str) -> str:
    import signal
    try:
        import psutil
    except ImportError:
        return "Error: killing processes needs the 'psutil' package."

    killed = []
    for proc in psutil.process_iter(["pid", "name"]):
        try:
            if target == str(proc.info["pid"]) or target.lower() in (proc.info["name"] or "").lower():
                proc.send_signal(signal.SIGTERM)
                killed.append(f"{proc.info['name']} (pid {proc.info['pid']})")
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    if not killed:
        return f"No running process matched '{target}'."
    return "Stopped: " + ", ".join(killed[:10])
