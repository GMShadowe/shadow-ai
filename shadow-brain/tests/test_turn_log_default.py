import json

import orchestrator
import settings

DECISION = {"method": "keywords", "probabilities": None}


def test_the_turn_log_is_off_until_turned_on(data_dir):
    assert settings.get_settings()["log_turns"] is False
    orchestrator.log_turn("a private question", "chat", DECISION, "a reply")
    assert not (data_dir / "turns.jsonl").exists()


def test_turning_it_on_writes_the_turn(data_dir):
    settings.update_settings({"log_turns": True})
    orchestrator.log_turn("hello", "chat", DECISION, "hi")
    line = (data_dir / "turns.jsonl").read_text().strip()
    assert json.loads(line)["input"] == "hello"
