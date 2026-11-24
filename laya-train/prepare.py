"""Build train.jsonl and test.jsonl from data/, asking Laya exactly the
question the brain asks (shadow-brain/router/routes.py), so a route added
there is a route trained here.

    python prepare.py
"""
import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "shadow-brain"))
from router.routes import QUESTIONS, ROUTES

SOURCES = {
    "generated": (HERE / "data" / "generated.jsonl", 0.10),
    "extra": (HERE / "data" / "extra.jsonl", 0.30),
}
TRAIN = HERE / "train.jsonl"
TEST = HERE / "test.jsonl"
SEED = 20261124


def read(path: Path) -> list[dict]:
    rows = []
    for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line)
        if row.get("route") not in ROUTES:
            raise SystemExit(f"{path.name}:{n}: route {row.get('route')!r} isn't one of {', '.join(ROUTES)} "
                             "in shadow-brain/router/routes.py")
        rows.append({"prompt": row["prompt"].strip(), "route": row["route"]})
    return rows


def example(row: dict) -> dict:
    return {"state": row["prompt"][:1500], "questions": QUESTIONS, "expected": {"route": row["route"]}}


def balance(rows: list[dict], rng: random.Random) -> list[dict]:
    """Repeat the smaller routes until each is about as big as the largest,
    so 45 health prompts aren't drowned by 380 coding ones."""
    by_route = defaultdict(list)
    for row in rows:
        by_route[row["route"]].append(row)
    target = max(len(group) for group in by_route.values())
    out = []
    for group in by_route.values():
        out += group * (target // len(group)) + rng.sample(group, target % len(group))
    rng.shuffle(out)
    return out


def main():
    rng = random.Random(SEED)
    train, test, seen = [], [], set()
    for name, (path, test_share) in SOURCES.items():
        by_route = defaultdict(list)
        for row in read(path):
            key = row["prompt"].lower()
            if key not in seen:
                seen.add(key)
                by_route[row["route"]].append(row)
        for route, group in sorted(by_route.items()):
            rng.shuffle(group)
            cut = max(1, round(len(group) * test_share))
            test += group[:cut]
            train += group[cut:]
        print(f"{name:10} {dict(Counter(r['route'] for g in by_route.values() for r in g))}")

    missing = set(ROUTES) - {r["route"] for r in train}
    if missing:
        raise SystemExit(f"No training examples for {', '.join(sorted(missing))}. Add some to data/extra.jsonl.")

    train = balance(train, rng)
    rng.shuffle(test)
    TRAIN.write_text("".join(json.dumps(example(r), ensure_ascii=False) + "\n" for r in train), encoding="utf-8")
    TEST.write_text("".join(json.dumps(example(r), ensure_ascii=False) + "\n" for r in test), encoding="utf-8")
    print(f"train {len(train)} (balanced) {dict(Counter(r['route'] for r in train))}")
    print(f"test  {len(test)} {dict(Counter(r['route'] for r in test))}")


if __name__ == "__main__":
    main()
