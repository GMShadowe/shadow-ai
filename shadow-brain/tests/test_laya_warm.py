import threading
import time

from router import laya_router


class SlowAgent:
    def __init__(self):
        self.calls = 0
        self.running = 0
        self.overlap = False

    def predict(self, state, questions):
        self.running += 1
        self.overlap |= self.running > 1
        self.calls += 1
        time.sleep(0.05)
        self.running -= 1
        return {"answers": {"route": {"probabilities": {"chat": 1.0}}}}


def _wait_idle():
    deadline = time.monotonic() + 5
    while laya_router._warming:
        assert time.monotonic() < deadline
        time.sleep(0.01)


def test_warming_never_loads_laya(monkeypatch):
    monkeypatch.setattr(laya_router, "_agent", None)
    assert laya_router.warm_in_background() == "not loaded"


def test_typing_warms_once_then_holds_off(monkeypatch):
    agent = SlowAgent()
    monkeypatch.setattr(laya_router, "_agent", agent)
    monkeypatch.setattr(laya_router, "_last_predict", 0.0)

    assert laya_router.warm_in_background() == "warming"
    assert laya_router.warm_in_background() in ("already warming", "already warm")
    _wait_idle()
    assert laya_router.warm_in_background() == "already warm"
    assert agent.calls == 1


def test_a_warmup_and_a_real_prediction_take_turns(monkeypatch):
    agent = SlowAgent()
    monkeypatch.setattr(laya_router, "_agent", agent)
    monkeypatch.setattr(laya_router, "_last_predict", 0.0)

    laya_router.warm_in_background()
    real = threading.Thread(target=lambda: laya_router.predict_routes("delete junk.txt"))
    real.start()
    real.join(5)
    _wait_idle()
    assert agent.calls == 2 and not agent.overlap


def test_the_endpoint_does_nothing_without_laya(client):
    assert client.post("/router/warm").json() == {"state": "not used"}
