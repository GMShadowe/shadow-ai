"""The health tools read Google's servers but weren't on the privacy page, and
on a computer without the personal health project they loaded and only failed."""
from adapters.registry import get_adapter
from privacy import outbound
from tools import health


def _row(tmp_path):
    return next(r for r in outbound(str(tmp_path / "log")) if r["id"] == "health")


def test_the_health_tools_are_listed_with_their_host(monkeypatch, tmp_path):
    monkeypatch.setattr(health, "available", lambda: True)
    row = _row(tmp_path)
    assert "health.googleapis.com" in row["host"]
    assert row["active"]


def test_not_installed_means_not_routed_and_not_active(monkeypatch, tmp_path):
    monkeypatch.setattr(health, "available", lambda: False)
    assert get_adapter("health") is None
    assert not _row(tmp_path)["active"]
    assert get_adapter("coding") is not None
