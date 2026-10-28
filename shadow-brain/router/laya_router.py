
"""Fast, persistent Laya wrapper with automatic device selection."""

import os
import threading
import time
import warnings

# Avoid TensorFlow initialization issues in supported environments.
os.environ.setdefault("USE_TF", "0")

_agent = None
_device = None
_load_lock = threading.Lock()


def _select_device(torch) -> str:
    """Prefer the best available supported inference device."""
    requested = os.getenv("LAYA_DEVICE", "auto").strip().lower()

    available = {
        "cpu": True,
        "cuda": torch.cuda.is_available(),
        "mps": (
            hasattr(torch.backends, "mps")
            and torch.backends.mps.is_available()
        ),
    }

    if requested == "auto":
        for device in ("cuda", "mps", "cpu"):
            if available[device]:
                return device

    elif requested in available:
        if available[requested]:
            return requested

        warnings.warn(
            f"LAYA_DEVICE={requested!r} is unavailable; "
            "selecting an available device automatically.",
            RuntimeWarning,
        )

    else:
        warnings.warn(
            f"Unknown LAYA_DEVICE={requested!r}; "
            "selecting an available device automatically.",
            RuntimeWarning,
        )

    for device in ("cuda", "mps", "cpu"):
        if available[device]:
            return device

    return "cpu"


def _configure_cpu(torch) -> int:
    """Set a configurable CPU thread count before loading Laya."""
    configured = os.getenv("LAYA_CPU_THREADS")

    if configured is not None:
        try:
            threads = int(configured)
        except ValueError as exc:
            raise ValueError(
                "LAYA_CPU_THREADS must be a positive integer."
            ) from exc

        if threads < 1:
            raise ValueError("LAYA_CPU_THREADS must be at least 1.")
    else:
        # Conservative default; benchmark other values on each machine.
        threads = min(4, os.cpu_count() or 1)

    torch.set_num_threads(threads)
    return threads


def load():
    """Load Laya once and reuse the same agent."""
    global _agent, _device

    if _agent is None:
        with _load_lock:
            # Check again after acquiring the lock.
            if _agent is None:
                import torch

                _device = _select_device(torch)

                if _device == "cpu":
                    threads = _configure_cpu(torch)
                    print(f"[Laya] Device: CPU | Threads: {threads}")
                else:
                    print(f"[Laya] Device: {_device}")

                import laya

                _agent = laya.load(
                    "convaiinnovations/laya",
                    device="mps" if torch.backends.mps.is_available() else (
                        "cuda" if torch.cuda.is_available() else "cpu"
                    ),
                )

    return _agent


def predict_routes(
    text: str,
    previous: str | None = None,
) -> tuple[dict, float]:
    """Return ({route: probability}, warm inference milliseconds)."""
    import torch
    from router.routes import QUESTIONS

    agent = load()

    state = text[:1500]
    if previous:
        state = (
            f"Previous message: {previous[:400]}\n"
            f"Current message: {state}"
        )

    start = time.perf_counter()

    # Safe for inference; avoids autograd overhead if not already disabled.
    with torch.inference_mode():
        result = agent.predict(state, QUESTIONS)

    elapsed_ms = (time.perf_counter() - start) * 1000

    probabilities = result["answers"]["route"]["probabilities"]
    return probabilities, elapsed_ms


def warmup() -> float:
    """Run one discarded prediction to warm up the inference path."""
    import torch
    from router.routes import QUESTIONS

    agent = load()
    start = time.perf_counter()

    with torch.inference_mode():
        agent.predict("Warmup routing request.", QUESTIONS)

    return (time.perf_counter() - start) * 1000
