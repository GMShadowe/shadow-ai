"""Install a Laya trained with train.py into the brain on this Mac.

    python laya-train/install.py out/laya-2026-11-24-2130.zip
    python laya-train/install.py --remove        # back to the pinned Laya

Before installing, the new checkpoint and the pinned one are scored on
laya-train/test.jsonl and, if it is there, on your own messages in
laya-fine-tune/real/real_test.jsonl - which never leave this computer. It is
refused if it routes your real messages worse than the pinned one, unless
--force. Restart the brain afterwards.
"""
import argparse
import hashlib
import json
import shutil
import sys
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRAIN = HERE.parent / "shadow-brain"
sys.path.insert(0, str(BRAIN))
from router.laya_router import LAYA_REVISION, TUNED_DIR, TUNED_RECORD
from router.routes import QUESTIONS
from train import score, show

REAL_TEST = HERE.parent / "laya-fine-tune" / "real" / "real_test.jsonl"
TUNED = Path(TUNED_DIR)


def unpack(source: Path) -> Path:
    if source.is_dir():
        return source
    staging = TUNED.parent / "laya-incoming"
    shutil.rmtree(staging, ignore_errors=True)
    with zipfile.ZipFile(source) as z:
        z.extractall(staging)
    found = [p.parent for p in staging.rglob("rl_agent_config.json") if "checkpoint_latest" not in p.parts]
    if len(found) != 1:
        raise SystemExit(f"Expected one checkpoint in {source.name}, found {len(found)}.")
    return found[0]


def check_base(folder: Path) -> None:
    summary = folder / "summary.json"
    if not summary.exists():
        raise SystemExit(f"{folder.name} has no summary.json, so it didn't come from train.py.")
    revision = json.loads(summary.read_text())["laya_revision"]
    if revision != LAYA_REVISION:
        raise SystemExit(f"It was trained from Laya {revision[:7]}, but the brain pins {LAYA_REVISION[:7]}; "
                         "the router thresholds were tuned on that one. Retrain from the pinned base.")


def gate(folder: Path, force: bool) -> None:
    import torch
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    sets = [("generated test", HERE / "test.jsonl")]
    if REAL_TEST.exists():
        sets.append(("your messages", REAL_TEST))
    else:
        print(f"{REAL_TEST} isn't here, so it is only scored on generated prompts.")
    worse = []
    for label, path in sets:
        if not path.exists():
            print(f"{path.name} is missing; run python laya-train/prepare.py first to score on it.")
            continue
        print(f"\n{label} ({path.name}):")
        before = score("base", path, device, QUESTIONS)
        after = score(str(folder), path, device, QUESTIONS)
        show("base", before)
        show("tuned", after)
        if label == "your messages" and after["routed"] < before["routed"]:
            worse.append(f"routes {after['routed']}% of your messages right against {before['routed']}%")
    if worse and not force:
        raise SystemExit(f"\nNot installed: it {'; '.join(worse)}. --force installs it anyway.")


def digests(folder: Path) -> dict:
    out = {}
    for path in sorted(folder.rglob("*")):
        if path.is_file() and path.name not in (TUNED_RECORD, "summary.json"):
            out[path.relative_to(folder).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    return out


def install(folder: Path) -> None:
    shutil.rmtree(folder / "checkpoint_latest", ignore_errors=True)
    (folder / TUNED_RECORD).write_text(json.dumps({"from": folder.name, "sha256": digests(folder)}, indent=1))
    previous = TUNED.parent / "laya-previous"
    shutil.rmtree(previous, ignore_errors=True)
    if TUNED.exists():
        TUNED.rename(previous)
    shutil.move(str(folder), str(TUNED))
    shutil.rmtree(TUNED.parent / "laya-incoming", ignore_errors=True)
    print(f"\nInstalled in {TUNED}. Restart the brain to use it.")


def remove() -> None:
    if not TUNED.exists():
        print("No fine-tuned Laya is installed; the brain already uses the pinned one.")
        return
    shutil.rmtree(TUNED)
    print(f"Removed {TUNED}. Restart the brain to go back to the pinned Laya.")


def main():
    parser = argparse.ArgumentParser(description="Install a fine-tuned Laya into the brain.")
    parser.add_argument("checkpoint", nargs="?", help="the .zip train.py made, or its folder")
    parser.add_argument("--force", action="store_true", help="install even if it routes your messages worse")
    parser.add_argument("--remove", action="store_true", help="go back to the pinned Laya")
    args = parser.parse_args()
    if args.remove:
        return remove()
    if not args.checkpoint:
        parser.error("give the .zip from train.py, or --remove")
    source = Path(args.checkpoint).resolve()
    if not source.exists():
        raise SystemExit(f"{source} doesn't exist.")
    folder = unpack(source)
    check_base(folder)
    gate(folder, args.force)
    if source.is_dir():
        staged = TUNED.parent / "laya-incoming"
        shutil.rmtree(staged, ignore_errors=True)
        shutil.copytree(folder, staged)
        folder = staged
    install(folder)


if __name__ == "__main__":
    main()
