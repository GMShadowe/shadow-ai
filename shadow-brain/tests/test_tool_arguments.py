import model
from model import parse_arguments, stream_model
from tests.helpers import call, scripted


def test_parse_arguments_accepts_dicts_strings_and_nothing():
    assert parse_arguments({"path": "a.txt"}) == ({"path": "a.txt"}, None)
    assert parse_arguments('{"path": "a.txt"}') == ({"path": "a.txt"}, None)
    assert parse_arguments(None) == ({}, None)
    assert parse_arguments("") == ({}, None)


def test_parse_arguments_reports_bad_json_and_non_objects():
    args, err = parse_arguments("{not json")
    assert args == {} and "valid JSON" in err
    args, err = parse_arguments('["a.txt"]')
    assert args == {} and "JSON object" in err


def test_string_arguments_run_the_tool(monkeypatch):
    ran = []
    monkeypatch.setattr(model, "call_tool", lambda name, args: ran.append((name, args)) or "contents")
    monkeypatch.setattr(model, "_chat_stream",
                        scripted([call("read_file", '{"path": "notes.txt"}')], "It says contents."))

    events = list(stream_model([{"role": "user", "content": "read notes.txt"}], ["read_file"]))

    assert ran == [("read_file", {"path": "notes.txt"})]
    assert events[-1] == {"type": "final", "text": "It says contents."}


def test_invalid_arguments_are_an_error_for_the_model_not_a_crash(monkeypatch):
    ran = []
    monkeypatch.setattr(model, "call_tool", lambda name, args: ran.append(name) or "")
    fake = scripted([call("read_file", "{path: notes.txt")], "Sorry, that call was malformed.")
    monkeypatch.setattr(model, "_chat_stream", fake)

    events = list(stream_model([{"role": "user", "content": "read notes.txt"}], ["read_file"]))

    assert ran == []  # never run with guessed arguments
    ends = [e for e in events if e["type"] == "tool_end"]
    assert ends and "valid JSON" in ends[0]["result"]
    assert any(m["role"] == "tool" and "valid JSON" in m["content"] for m in fake.seen[1])
    assert events[-1]["type"] == "final"
