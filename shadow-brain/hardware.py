"""Reads this computer's specs and recommends a model tier."""

import os
import platform
import shutil


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
        "ram_total_gb": None,
        "ram_free_gb": None,
    }
    try:
        import psutil
        vm = psutil.virtual_memory()
        info["ram_total_gb"] = round(vm.total / 1e9, 1)
        info["ram_free_gb"] = round(vm.available / 1e9, 1)
    except ImportError:
        pass

    target = workspace if os.path.isdir(workspace) else os.path.expanduser("~")
    disk = shutil.disk_usage(target)
    info["disk_free_gb"] = round(disk.free / 1e9, 1)
    info["disk_total_gb"] = round(disk.total / 1e9, 1)
    return info


def recommend_tier(ram_total_gb: float | None) -> str:
    """Never recommends Primal: it has no model behind it yet. And never
    recommends below Default, because Default is the floor now - a machine
    under 8GB is told so by the model list instead of being sent to a tier
    that no longer exists."""
    if ram_total_gb is not None and ram_total_gb >= 16:
        return "plus"
    return "default"
