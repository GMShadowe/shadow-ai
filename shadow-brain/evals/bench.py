"""Times one scripted chat against the live pipeline: how long to the first
word, how much of the prompt Ollama had to read again, how much the model
wrote. Reading the prompt is the heaviest work a turn does, so the prompt
time is also the best stand-in for heat that works on every machine.

    .venv/bin/python evals/bench.py
    .venv/bin/python evals/bench.py --tier plus --runs 2
"""

import argparse
import os
import shutil
import statistics
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)

CHAT = [
    "hey, how's it going?",
    "what's a good way to learn the basics of rust in a month?",
    "can you make that shorter, like five bullet points",
    "read notes.md",
    "add eggs to that list",
    "thanks! what do you remember about me?",
    "what's the difference between a process and a thread?",
    "give me a one line example of each in python",
    "ok cool",
    "summarise what we talked about",
]


def bench(tier: str, effort: str) -> list[dict]:
    from run import setup, reset_memory
    from memory.short_term import ShortTermMemory
    from orchestrator import handle_turn

    root = tempfile.mkdtemp(prefix="shadow-bench-", dir=os.path.expanduser("~"))
    try:
        aid = setup(root, tier, effort)
        reset_memory(aid)
        memory = ShortTermMemory()
        rows = []
        for message in CHAT:
            result = handle_turn(message, memory, tier, effort, aid=aid)
            t = result.get("timing") or {}
            rows.append({"message": message, "route": result.get("route"), **t})
        return rows
    finally:
        shutil.rmtree(root, ignore_errors=True)


def show(rows: list[dict]) -> None:
    print(f"{'message':42} {'route':10} {'first':>7} {'total':>7} {'load':>6} {'prompt':>7} {'read':>7} {'wrote':>6}")
    for r in rows:
        print(f"{r['message'][:42]:42} {str(r['route'])[:10]:10} {r['first_token_ms'] or 0:>6}ms "
              f"{r['total_ms']:>6}ms {r['load_ms']:>5}ms {r['prompt_tokens']:>7} {r['prompt_ms']:>6}ms "
              f"{r['output_tokens']:>6}")
    after_first = rows[1:]
    print(f"\nafter the first turn: median first word {statistics.median(r['first_token_ms'] or 0 for r in after_first)}ms, "
          f"prompt reading {sum(r['prompt_ms'] for r in after_first)}ms in all, "
          f"loads {sum(r['load_ms'] for r in after_first)}ms in all")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tier", default="default")
    parser.add_argument("--effort", default="medium")
    parser.add_argument("--runs", type=int, default=1)
    args = parser.parse_args()
    for run in range(args.runs):
        print(f"\n== run {run + 1} ({args.tier}, {args.effort}) ==")
        show(bench(args.tier, args.effort))


if __name__ == "__main__":
    main()
