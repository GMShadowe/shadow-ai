import pytest

import cool
import providers
import settings
from config import max_steps

MAC = {"os": "macOS 26.5", "machine": "arm64", "gpu": None, "cpu_physical": 10}
CPU_PC = {"os": "Windows", "machine": "AMD64", "gpu": None, "cpu_physical": 8}
GPU_PC = {"os": "Windows", "machine": "AMD64", "gpu": {"vendor": "nvidia", "vram_gb": 12}, "cpu_physical": 8}


def test_unset_follows_the_machine(monkeypatch):
    monkeypatch.setattr(cool, "_default", True)
    assert cool.on()
    settings.update_settings({"cool_mode": False})
    assert not cool.on()


def test_only_bad_values_are_refused():
    settings.update_settings({"cool_mode": None})
    with pytest.raises(ValueError):
        settings.update_settings({"cool_mode": "yes"})


def test_threads_are_only_limited_where_the_model_runs_on_the_cpu():
    assert cool.threads(MAC) is None
    assert cool.threads(GPU_PC) is None
    assert cool.threads(CPU_PC) == 4


def test_cool_mode_caps_steps_and_shortens_keep_alive():
    settings.update_settings({"cool_mode": True})
    assert max_steps("ultra") == cool.STEP_CAP
    assert max_steps("low") == 3
    assert providers.keep_alive() == cool.KEEP_ALIVE
    settings.update_settings({"cool_mode": False})
    assert max_steps("ultra") == 32
    assert providers.keep_alive() == providers.KEEP_ALIVE


def test_the_prompt_states_the_capped_step_count():
    import awareness
    settings.update_settings({"cool_mode": True})
    assert f"up to {cool.STEP_CAP} tool steps" in awareness.turn_facts(effort="ultra")


def test_low_power_mode_is_suggested_only_when_it_would_help():
    settings.update_settings({"cool_mode": True})
    assert cool.report({"low_power": False})["suggest_low_power"]
    assert not cool.report({"low_power": True})["suggest_low_power"]
    assert not cool.report({"low_power": None})["suggest_low_power"]


def test_cool_mode_rests_between_tool_steps(monkeypatch):
    import model
    from memory.short_term import ShortTermMemory
    from orchestrator import handle_turn
    from tests.helpers import call, quiet_turn

    settings.update_settings({"cool_mode": True})
    rests = []
    monkeypatch.setattr(model.time, "sleep", rests.append)
    quiet_turn(monkeypatch, [call("about_me", {})], "Here you go.")
    handle_turn("tell me about yourself", ShortTermMemory())
    assert rests == [cool.STEP_PAUSE_SECONDS]
