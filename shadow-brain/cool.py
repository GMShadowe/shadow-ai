"""Cool mode: the model does less at once, so the machine runs quieter and
cooler, and answers take a little longer.

On Apple silicon the model runs on the graphics chip, so limiting CPU
threads changes almost nothing there; what cools a Mac is less work. So
Cool mode everywhere caps the steps a turn may take, pauses between them,
and holds memory saving back until the chat is quiet. Only on a computer
with no graphics card for Ollama to use, where the model runs on the CPU,
does it also leave some of the processor free.
"""

import platform

STEP_CAP = 12
STEP_PAUSE_SECONDS = 1.5
QUIET_SECONDS = 120
KEEP_ALIVE = "10m"

_default: bool | None = None


def default() -> bool:
    global _default
    if _default is None:
        import hardware
        _default = hardware.cool_by_default(_machine())
    return _default


def on() -> bool:
    from settings import get_settings
    chosen = get_settings().get("cool_mode")
    return default() if chosen is None else bool(chosen)


def _machine() -> dict:
    import hardware
    hw = {"os": "macOS" if platform.system() == "Darwin" else platform.system(),
          "machine": platform.machine(), "gpu": hardware.gpu(), "ram_total_gb": None, "cpu_physical": None}
    try:
        import psutil
        hw["ram_total_gb"] = round(psutil.virtual_memory().total / 1e9, 1)
        hw["cpu_physical"] = psutil.cpu_count(logical=False)
    except ImportError:
        pass
    return hw


def runs_on_cpu(hw: dict) -> bool:
    is_apple_silicon = (hw.get("os") or "").startswith("macOS") and hw.get("machine") == "arm64"
    return not is_apple_silicon and not hw.get("gpu")


def threads(hw: dict | None = None) -> int | None:
    """CPU threads for Ollama in Cool mode, or None to leave its own choice."""
    hw = hw or _machine()
    if not runs_on_cpu(hw):
        return None
    cores = hw.get("cpu_physical") or 0
    return max(2, cores // 2) if cores else None


def steps(limit: int) -> int:
    return min(limit, STEP_CAP) if on() else limit


def pause() -> float:
    return STEP_PAUSE_SECONDS if on() else 0.0


def ollama_options() -> dict:
    if not on():
        return {}
    n = threads()
    return {"num_thread": n} if n else {}


def keep_alive(normal: str) -> str:
    return KEEP_ALIVE if on() else normal


def quiet_seconds(normal: float) -> float:
    return QUIET_SECONDS if on() else normal


def report(hw: dict) -> dict:
    """What Settings shows about Cool mode on this machine."""
    return {
        "on": on(),
        "default": default(),
        "frees_cpu": runs_on_cpu(hw),
        "suggest_low_power": on() and hw.get("low_power") is False,
    }
