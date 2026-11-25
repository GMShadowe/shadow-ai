"""Reads this computer's specs, decides which tiers fit it, and whether Cool
mode should start on."""

import os
import platform
import shutil
import subprocess
import time

_gpu: dict | None = None
_gpu_read = False
_low_power: tuple[float, bool | None] = (0.0, None)
LOW_POWER_TTL = 30


def get_hardware(workspace: str) -> dict:
    system = platform.system()
    if system == "Darwin":
        os_name = f"macOS {platform.mac_ver()[0]}"
    else:
        os_name = f"{system} {platform.release()}"

    info = {
        "os": os_name,
        "machine": platform.machine(),
        "cpu_cores": os.cpu_count(),
        "cpu_physical": None,
        "ram_total_gb": None,
        "ram_free_gb": None,
        "gpu": gpu(),
        "low_power": low_power_mode(),
    }
    try:
        import psutil
        vm = psutil.virtual_memory()
        info["ram_total_gb"] = round(vm.total / 1e9, 1)
        info["ram_free_gb"] = round(vm.available / 1e9, 1)
        info["cpu_physical"] = psutil.cpu_count(logical=False)
    except ImportError:
        pass

    target = workspace if os.path.isdir(workspace) else os.path.expanduser("~")
    disk = shutil.disk_usage(target)
    info["disk_free_gb"] = round(disk.free / 1e9, 1)
    info["disk_total_gb"] = round(disk.total / 1e9, 1)
    return info


def gpu() -> dict | None:
    """An NVIDIA card, if there is one. Read once: it doesn't change while
    the brain runs. Apple silicon has no separate card - its memory is the
    machine's memory, which ram_total_gb already says."""
    global _gpu, _gpu_read
    if _gpu_read:
        return _gpu
    _gpu_read = True
    if not shutil.which("nvidia-smi"):
        return None
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5, check=True,
        ).stdout
    except (OSError, subprocess.SubprocessError) as e:
        print(f"[hardware] nvidia-smi is installed but didn't answer: {e}")
        return None
    cards = []
    for line in out.strip().splitlines():
        name, _, mib = line.rpartition(",")
        try:
            cards.append({"name": name.strip().removeprefix("NVIDIA ").removeprefix("GeForce "),
                          "vram_gb": round(int(mib.strip()) / 1024), "vendor": "nvidia"})
        except ValueError:
            print(f"[hardware] couldn't read nvidia-smi's line: {line!r}")
    _gpu = max(cards, key=lambda c: c["vram_gb"]) if cards else None
    return _gpu


def low_power_mode() -> bool | None:
    """macOS Low Power Mode, which slows the chip down and with it the heat.
    None where there is no such thing or it can't be read."""
    global _low_power
    if platform.system() != "Darwin":
        return None
    at, value = _low_power
    if time.monotonic() - at < LOW_POWER_TTL:
        return value
    try:
        out = subprocess.run(["pmset", "-g"], capture_output=True, text=True, timeout=3).stdout
        line = next((l for l in out.splitlines() if "lowpowermode" in l), None)
        value = None if line is None else line.split()[-1] == "1"
    except (OSError, subprocess.SubprocessError) as e:
        print(f"[hardware] couldn't read Low Power Mode: {e}")
        value = None
    _low_power = (time.monotonic(), value)
    return value


def memory_on_the_box(decimal_gb: float | None) -> int:
    """psutil counts decimal gigabytes, so a 16 GB Mac reports 17.2. People
    know their machine by the number on the box."""
    return round(decimal_gb * 1e9 / 2 ** 30) if decimal_gb else 0


def _nvidia_vram(hw: dict) -> int:
    card = hw.get("gpu") or {}
    return card.get("vram_gb", 0) if card.get("vendor") == "nvidia" else 0


def _platform_ok(hw: dict, wanted: str | None) -> bool:
    is_mac = (hw.get("os") or "").startswith("macOS")
    if wanted == "apple-silicon":
        return is_mac and hw.get("machine") == "arm64"
    if wanted == "not-mac":
        return not is_mac
    return True


def fits(hw: dict, requires: dict | list | None) -> bool:
    """Whether a tier's "requires" holds here. A list means any one of them."""
    if not requires:
        return True
    if isinstance(requires, list):
        return any(fits(hw, r) for r in requires)
    return (memory_on_the_box(hw.get("ram_total_gb")) >= requires.get("ram", 0)
            and _nvidia_vram(hw) >= requires.get("nvidia_vram", 0)
            and _platform_ok(hw, requires.get("platform")))


def recommend_tier(hw: dict) -> str:
    """What runs comfortably, not the biggest thing that loads: a 9B on a
    16 GB laptop works, but warm and slow enough to worry someone who doesn't
    know a model is running."""
    from config import all_tiers
    tiers = {t["tier"]: t for t in all_tiers(include_custom=False)}
    strong = next((t for t in tiers.values() if t.get("hidden") and fits(hw, t.get("requires"))), None)
    if strong:
        return strong["tier"]
    ram = memory_on_the_box(hw.get("ram_total_gb"))
    if (ram >= 32 or _nvidia_vram(hw) >= 12) and fits(hw, tiers["primal"].get("requires")):
        return "primal"
    if ram >= 24:
        return "plus"
    return "default"


def cool_by_default(hw: dict) -> bool:
    """Cool mode starts on where a model works the machine hardest."""
    return memory_on_the_box(hw.get("ram_total_gb")) <= 16 and _nvidia_vram(hw) < 8
