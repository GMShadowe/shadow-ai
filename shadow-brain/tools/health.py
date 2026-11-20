"""Health tools: live Fitbit Air data from the Google Health API.

The API code and the Google sign-in live in the health project
(fitbit_health.py and token.json). SHADOW_HEALTH_DIR points to it; the
default is ~/Coding/health. Every call reads Google live, so answers are as
fresh as the band's last sync to the phone. Read-only.
"""

import datetime as dt
import importlib
import json
import os
import sys

from tools.state import offline

HEALTH_DIR = os.path.expanduser(os.environ.get("SHADOW_HEALTH_DIR", "~/Coding/health"))
OFFLINE = ("Blocked: offline mode is on, and health data comes from Google's servers. "
           "Tell the user they can turn offline mode off in Settings - Privacy.")
_fh = None


def _lib():
    """Import fitbit_health from the health project, once."""
    global _fh
    if _fh is None:
        if not os.path.isfile(os.path.join(HEALTH_DIR, "fitbit_health.py")):
            raise FileNotFoundError(f"fitbit_health.py not found in {HEALTH_DIR}. Set SHADOW_HEALTH_DIR.")
        if HEALTH_DIR not in sys.path:
            sys.path.append(HEALTH_DIR)
        _fh = importlib.import_module("fitbit_health")
    return _fh


def _run(fn):
    if offline():
        return OFFLINE
    try:
        fh = _lib()
    except Exception as e:
        return f"Error: the health tools aren't set up: {e}"
    try:
        data = fn(fh)
    except fh.HealthError as e:
        return f"Error: {e}"
    return json.dumps(data, separators=(",", ":"), default=str)


def _count(value, default: int, top: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = default
    return max(1, min(top, n))


def health_today() -> str:
    return _run(lambda fh: fh.today())


def health_days(start_date: str, end_date: str = "") -> str:
    def go(fh):
        start = fh.parse_day(start_date)
        end = fh.parse_day(end_date or "today")
        if end < start:
            start, end = end, start
        if (end - start).days >= 90:
            raise fh.HealthError("Ask for 90 days or fewer at a time.")
        return fh.summary_for(start, end + dt.timedelta(days=1))
    return _run(go)


def health_hourly(hours: int = 24) -> str:
    def go(fh):
        errors = []
        rows = fh._clean(fh.hourly(_count(hours, 24, 168), errors))
        return {"hours": rows, "errors": errors or None}
    return _run(go)


def health_sleep(days: int = 7) -> str:
    def go(fh):
        errors = []
        today = dt.date.today()
        n = _count(days, 7, 90)
        rows = fh._clean(fh.sleep_sessions(today - dt.timedelta(days=n - 1), today + dt.timedelta(days=1), errors))
        return {"sleeps": rows, "errors": errors or None}
    return _run(go)


def health_workouts(days: int = 14) -> str:
    def go(fh):
        errors = []
        today = dt.date.today()
        n = _count(days, 14, 90)
        rows = fh._clean(fh.workouts(today - dt.timedelta(days=n - 1), today + dt.timedelta(days=1), errors))
        return {"workouts": rows, "errors": errors or None}
    return _run(go)
