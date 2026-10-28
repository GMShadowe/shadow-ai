"""Terminal chat with live streaming. /clear wipes memory, /quit exits."""

from orchestrator import stream_turn
from memory.short_term import ShortTermMemory
from model import MODEL_NAME
from config import default_tier, get_workspace
import permissions


def main():
    memory = ShortTermMemory()
    print(f"Shadow | tier: {default_tier()} | model: {MODEL_NAME}")
    print(f"Workspace: {get_workspace()}")
    print("Type /clear to reset, /quit to exit.\n")

    while True:
        try:
            user_input = input("you> ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nbye")
            break

        if not user_input:
            continue
        if user_input == "/quit":
            break
        if user_input == "/clear":
            memory.clear()
            print("(memory cleared)\n")
            continue

        try:
            for event in stream_turn(user_input, memory):
                kind = event["type"]
                if kind == "route":
                    print(f"shadow [{event['route']}]> ", end="", flush=True)
                elif kind == "tool_start":
                    print(f"\n  [tool] {event['name']}({event['args']})", flush=True)
                elif kind == "token":
                    print(event["text"], end="", flush=True)
                elif kind == "permission":
                    answer = input(
                        f"\n  Shadow wants to use {event['name']}({event['args']}). "
                        "Allow? [y]es / [n]o / [a]lways: "
                    ).strip().lower()
                    decision = {"y": "allow", "yes": "allow", "a": "always", "always": "always"}.get(answer, "deny")
                    permissions.resolve(event["id"], decision)
            print("\n")
        except Exception as e:
            print(f"\n[error] {e}\n")


if __name__ == "__main__":
    main()
