"""Replays real conversations that went wrong against the live pipeline and
scores the replies with plain checks. Needs Ollama running and the tier's
model pulled. Writes nothing into the real data folder.

    .venv/bin/python evals/run.py                  # every case, 3 runs each
    .venv/bin/python evals/run.py --only hi-lol --runs 1
"""

import argparse
import json
import os
import shutil
import sys
import tempfile
import time
from datetime import datetime

BRAIN = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BRAIN)

HERE = os.path.dirname(os.path.abspath(__file__))
CASES = os.path.join(HERE, "cases.jsonl")
RESULTS = os.path.join(HERE, "results")

FACTS = [
    "Name: Kavya",
    "Likes filter coffee",
    "Favourite colour: teal",
    "Training for a half marathon in March",
]
WORKSPACE_FILES = {
    "notes.md": "# Groceries\n- oat milk\n- cardamom\n- basmati rice\n",
    "app.py": "def greet(name):\n    return f'hello {name}'\n",
    "data.csv": "city,temp\npune,31\nlondon,7\n",
    "stats.py": "def average(xs):\n    return sum(xs) / len(xs) + 1\n",
}
WEATHER = "Sunny +31°C"
NOT_REAL_TOOLS = {"honesty_check"}


def setup(root: str, tier: str, effort: str) -> str:
    from tests.helpers import redirect_data
    import awareness
    import settings

    data = os.path.join(root, "data")
    workspace = os.path.join(root, "workspace")
    os.makedirs(data)
    os.makedirs(workspace)
    for name, text in WORKSPACE_FILES.items():
        with open(os.path.join(workspace, name), "w") as f:
            f.write(text)
    redirect_data(data)
    awareness._weather = lambda location: WEATHER
    settings.update_settings({"router": "laya", "workspace": workspace, "log_turns": False})

    import assistants
    import storage
    from memory import long_term
    aid = assistants.active_id()
    assistants.update_profile({"name": "Shadow", "model": tier, "effort": effort, "tone": "casual",
                               "response_length": "balanced", "location": "Pune",
                               "auto_memory": False}, aid)
    storage.init()
    long_term.init()
    return aid


def reset_memory(aid: str) -> None:
    from memory import long_term
    long_term.clear()
    for fact in FACTS:
        if not long_term.add(fact, aid=aid):
            raise RuntimeError(f"Couldn't store {fact!r}: is nomic-embed-text pulled?")


def reset_workspace(workspace: str) -> None:
    for name in os.listdir(workspace):
        path = os.path.join(workspace, name)
        shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)
    for name, text in WORKSPACE_FILES.items():
        with open(os.path.join(workspace, name), "w") as f:
            f.write(text)


def set_tools(case: dict, aid: str) -> None:
    import assistants
    assistants.update_profile({"tools": {name: "on" for name in case.get("tools_on", [])}}, aid)


def run_case(case: dict, tier: str, effort: str, aid: str) -> dict:
    from memory.short_term import ShortTermMemory
    from orchestrator import handle_turn
    from settings import get_settings

    reset_memory(aid)
    workspace = get_settings()["workspace"]
    reset_workspace(workspace)
    set_tools(case, aid)
    memory = ShortTermMemory()
    for item in case.get("history", []):
        memory.add(item["role"], item["content"], adapters=item.get("adapters"))
    started = time.time()
    result = handle_turn(case["input"], memory, tier=tier, effort=effort, aid=aid)
    return {
        "reply": result.get("reply", ""),
        "route": result.get("route", ""),
        "tools": [t["name"] for t in result.get("tools", []) if t.get("name") and "kind" not in t],
        "seconds": round(time.time() - started, 1),
        "files": read_workspace(workspace),
    }


def read_workspace(workspace: str) -> dict:
    found = {}
    for name in os.listdir(workspace):
        path = os.path.join(workspace, name)
        if os.path.isfile(path):
            try:
                with open(path, errors="replace") as f:
                    found[name] = f.read(20000)
            except OSError as e:
                found[name] = f"<unreadable: {e}>"
        else:
            found[name + "/"] = ""
    return found


def check(spec: dict, out: dict) -> list[str]:
    """Every failed check, in words. Empty means the run passed."""
    from model import claims_action

    reply = out["reply"].lower()
    real_tools = [t for t in out["tools"] if t not in NOT_REAL_TOOLS]
    failed = []
    if "any_of" in spec:
        options = [check(option, out) for option in spec["any_of"]]
        if all(options):
            failed.append("none of: " + " | ".join("; ".join(o) for o in options))
    if "route_includes" in spec and spec["route_includes"] not in out["route"].split("+"):
        failed.append(f"route {out['route']!r} lacks {spec['route_includes']!r}")
    if "route_excludes" in spec and spec["route_excludes"] in out["route"].split("+"):
        failed.append(f"route {out['route']!r} has {spec['route_excludes']!r}")
    if "tools_any" in spec and not set(spec["tools_any"]) & set(real_tools):
        failed.append(f"called none of {spec['tools_any']} (called {real_tools})")
    if "min_calls" in spec:
        for name, n in spec["min_calls"].items():
            if real_tools.count(name) < n:
                failed.append(f"called {name} {real_tools.count(name)} times, wanted {n}+")
    if "contains_all" in spec:
        missing = [w for w in spec["contains_all"] if w.lower() not in reply]
        if missing:
            failed.append(f"doesn't mention {missing}")
    if "tools_none" in spec and set(spec["tools_none"]) & set(real_tools):
        failed.append(f"called {sorted(set(spec['tools_none']) & set(real_tools))}")
    if spec.get("no_unbacked_claim") and not real_tools and claims_action(out["reply"]):
        failed.append("claims an action, no tool ran")
    for word in spec.get("not_contains", []):
        if word.lower() in reply:
            failed.append(f"mentions {word!r}")
    if "contains_any" in spec and not any(w.lower() in reply for w in spec["contains_any"]):
        failed.append(f"mentions none of {spec['contains_any']}")
    files = out.get("files", {})
    for name in spec.get("file_exists", []):
        if name not in files:
            failed.append(f"no {name} in the workspace")
    for name in spec.get("file_missing", []):
        if name in files:
            failed.append(f"{name} is still in the workspace")
    for name, words in spec.get("file_contains", {}).items():
        text = files.get(name)
        if text is None:
            failed.append(f"no {name} in the workspace")
        elif not any(w in text for w in words):
            failed.append(f"{name} has none of {words}")
    for name, words in spec.get("file_lacks", {}).items():
        for w in words:
            if w in files.get(name, ""):
                failed.append(f"{name} still has {w!r}")
    return failed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--tier", default="default")
    parser.add_argument("--effort", default="medium")
    parser.add_argument("--only", nargs="*", help="case ids to run")
    parser.add_argument("--label", default="", help="name for the results file")
    args = parser.parse_args()

    with open(CASES) as f:
        cases = [json.loads(line) for line in f if line.strip()]
    if args.only:
        cases = [c for c in cases if c["id"] in args.only]
        if not cases:
            print(f"No case matches {args.only}.")
            return 1

    # The workspace has to sit inside the home folder, so the temp folder does too.
    root = tempfile.mkdtemp(prefix="shadow-eval-", dir=os.path.expanduser("~"))
    try:
        return evaluate(cases, args, root)
    finally:
        shutil.rmtree(root, ignore_errors=True)


def evaluate(cases: list[dict], args, root: str) -> int:
    aid = setup(root, args.tier, args.effort)
    report = []
    passed_total = 0
    for case in cases:
        runs = []
        for _ in range(args.runs):
            try:
                out = run_case(case, args.tier, args.effort, aid)
                out["failed"] = check(case["checks"], out)
            except Exception as e:
                out = {"reply": "", "route": "", "tools": [], "seconds": 0, "files": {},
                       "failed": [f"crashed: {type(e).__name__}: {e}"]}
            runs.append(out)
        passed = sum(not r["failed"] for r in runs)
        passed_total += passed
        print(f"{passed}/{len(runs)}  {case['id']:<22} {case.get('group', '')}")
        for r in runs:
            if r["failed"]:
                print(f"      x {'; '.join(r['failed'])}  [{r['route']}] {r['tools']} {r['reply'][:110]!r}")
        report.append({"id": case["id"], "group": case.get("group"), "passed": passed, "runs": runs})

    total = len(cases) * args.runs
    print(f"\n{passed_total}/{total} runs passed")
    groups: dict[str, list[int]] = {}
    for item in report:
        g = groups.setdefault(item["group"] or "-", [0, 0])
        g[0] += item["passed"]
        g[1] += len(item["runs"])
    for name, (p, n) in sorted(groups.items()):
        print(f"  {name:<12} {p}/{n}")

    os.makedirs(RESULTS, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d-%H%M")
    path = os.path.join(RESULTS, f"{stamp}{'-' + args.label if args.label else ''}.json")
    with open(path, "w") as f:
        json.dump({"tier": args.tier, "effort": args.effort, "runs": args.runs,
                   "passed": passed_total, "total": total, "cases": report}, f, indent=1)
    print(f"Saved {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
