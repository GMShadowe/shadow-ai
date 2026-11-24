import pytest

import hardware

THIS_MAC = {"os": "macOS 26.5", "machine": "arm64", "ram_total_gb": 17.2, "gpu": None}
MAC_36 = {"os": "macOS 26.5", "machine": "arm64", "ram_total_gb": 38.7, "gpu": None}
PC_4080 = {"os": "Windows 11", "machine": "AMD64", "ram_total_gb": 34.4,
           "gpu": {"name": "RTX 4080", "vram_gb": 16, "vendor": "nvidia"}}
PC_3060 = {"os": "Windows 11", "machine": "AMD64", "ram_total_gb": 17.1,
           "gpu": {"name": "RTX 3060", "vram_gb": 12, "vendor": "nvidia"}}
LAPTOP_8 = {"os": "Windows 11", "machine": "AMD64", "ram_total_gb": 8.5, "gpu": None}


def test_memory_is_counted_the_way_the_box_says():
    assert hardware.memory_on_the_box(17.2) == 16
    assert hardware.memory_on_the_box(8.5) == 8


@pytest.mark.parametrize("hw, tier", [
    (THIS_MAC, "default"), (MAC_36, "inkling"), (PC_4080, "gpt-oss"),
    (PC_3060, "primal"), (LAPTOP_8, "default"),
])
def test_the_suggestion_is_what_runs_comfortably(hw, tier):
    assert hardware.recommend_tier(hw) == tier


def test_primal_needs_22_gb_or_a_12_gb_card():
    from config import load_tier_config
    requires = load_tier_config("primal")["requires"]
    assert not hardware.fits(THIS_MAC, requires)
    assert hardware.fits(PC_3060, requires)
    assert hardware.fits(MAC_36, requires)


@pytest.mark.parametrize("hw, cool", [(THIS_MAC, True), (LAPTOP_8, True), (MAC_36, False), (PC_3060, False)])
def test_cool_mode_starts_on_where_the_machine_works_hardest(hw, cool):
    assert hardware.cool_by_default(hw) is cool


def test_the_strong_tier_is_only_listed_where_it_runs(client, monkeypatch):
    import server
    monkeypatch.setattr(server, "_installed_models", lambda: None)
    ids = lambda hw: [m["id"] for m in server._models(hw)]
    assert ids(THIS_MAC)[:3] == ["default", "plus", "primal"]
    assert "inkling" not in ids(THIS_MAC) and "gpt-oss" not in ids(THIS_MAC)
    assert "inkling" in ids(MAC_36) and "gpt-oss" not in ids(MAC_36)
    assert "gpt-oss" in ids(PC_4080) and "inkling" not in ids(PC_4080)


def test_a_tier_that_doesnt_fit_says_what_it_needs(client, monkeypatch):
    import server
    monkeypatch.setattr(server, "_installed_models", lambda: None)
    primal = next(m for m in server._models(THIS_MAC) if m["id"] == "primal")
    assert not primal["available"]
    assert primal["reason"] == "Needs 22 GB of memory, or 16 GB with a 12 GB NVIDIA card"
