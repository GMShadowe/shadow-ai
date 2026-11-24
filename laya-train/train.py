"""Fine-tune Laya on the PC's GPU, score it the way Shadow routes, and zip it
for the trip back to the Mac.

    python train.py                     # prepare, train, score, zip
    python train.py --epochs 2 --smoothing 0.05
    python train.py --score-only out/laya-2026-11-24-2130

Refuses to run without CUDA: training on the 16GB Mac swapped until it froze.
"""
import argparse
import hashlib
import json
import shutil
import statistics
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
sys.path.insert(0, str(HERE.parent / "shadow-brain"))

LAYA_REPO = "convaiinnovations/laya"
LAYA_VERSION = "0.4.13"
# Must match shadow-brain/router/laya_router.py: the thresholds in
# classifier.py were tuned on this revision, and it is the base trained from.
LAYA_REVISION = "7b928d828b7b0e022f929d9bd2e44165aa270148"
LAYA_SHA256 = {
    "model.safetensors": "891102d372688fc2a094dac56a384bc537b87c63f21f9f3dac0be2b7cbc8d86c",
    "rl_agent_config.json": "ae287b56bbcf5f8c4f4541ae9dfd00c914c4c48b940b8398c3058af37ba92bbd",
    "encoder/config.json": "bf3ab80598fdccf414855a2ce80f22859e4492d06ca8a62ddd1cfb63972f8979",
    "tokenizer/tokenizer_config.json": "50044de60daaa73df97d262e15a40d4faf0160e7d742df64b377877a1320dd12",
    "tokenizer/tokenizer.json": "6c8aaa9a542084f2457eab775d4eeb51f92a70c0fd9de28d5edb0ddec3c08d30",
}
LAYA_FILES = ["rl_agent_config.json", "model.safetensors", "tokenizer/*", "encoder/*"]


def require_gpu():
    import torch

    if not torch.cuda.is_available():
        raise SystemExit("No CUDA GPU found. Install the CUDA build of PyTorch first:\n"
                         "  pip install torch --index-url https://download.pytorch.org/whl/cu124")
    props = torch.cuda.get_device_properties(0)
    print(f"GPU: {props.name}, {props.total_memory / 2**30:.1f} GB")


def require_laya():
    import laya

    if laya.__version__ != LAYA_VERSION:
        raise SystemExit(f"laya {laya.__version__} is installed, but Shadow uses {LAYA_VERSION}. "
                         f"Run: pip install laya=={LAYA_VERSION}")


def base_checkpoint() -> Path:
    from huggingface_hub import snapshot_download

    path = Path(snapshot_download(LAYA_REPO, revision=LAYA_REVISION, allow_patterns=LAYA_FILES))
    for name, expected in LAYA_SHA256.items():
        if hashlib.sha256((path / name).read_bytes()).hexdigest() != expected:
            raise SystemExit(f"{name} in the downloaded base doesn't match the pinned digest. Delete the "
                             "Hugging Face cache for convaiinnovations/laya and run again.")
    print(f"Base: {LAYA_REPO}@{LAYA_REVISION[:7]}, digests match")
    return path


def score(checkpoint: str, test: Path, device: str, questions: dict | None = None) -> dict:
    """Top-1, and routed: what Shadow does after classifier._decide applies
    its confidence thresholds. Routed is the number users feel."""
    import laya
    from router.classifier import _decide

    if checkpoint == "base":
        agent = laya.load(LAYA_REPO, revision=LAYA_REVISION, device=device)
    else:
        agent = laya.load(checkpoint, device=device)
    items = [json.loads(line) for line in test.read_text(encoding="utf-8").splitlines() if line.strip()]
    top1 = routed = 0
    confidences, per_route, confusion = [], defaultdict(lambda: [0, 0]), Counter()
    for item in items:
        probs = agent.predict(item["state"], questions or item["questions"])["answers"]["route"]["probabilities"]
        expected = item["expected"]["route"]
        guess = max(probs, key=probs.get)
        picked = _decide(probs)
        top1 += guess == expected
        routed += (picked == []) if expected == "chat" else (expected in picked)
        confidences.append(probs[guess])
        per_route[expected][0] += guess == expected
        per_route[expected][1] += 1
        if guess != expected:
            confusion[f"{expected}->{guess}"] += 1
    n = len(items)
    return {"n": n, "top1": round(100 * top1 / n, 1), "routed": round(100 * routed / n, 1),
            "median_confidence": round(statistics.median(confidences), 2),
            "per_route": {r: f"{c}/{t}" for r, (c, t) in sorted(per_route.items())},
            "worst": confusion.most_common(5)}


def show(name: str, r: dict) -> None:
    print(f"{name:6} top-1 {r['top1']:5}%  routed {r['routed']:5}%  median confidence "
          f"{r['median_confidence']}\n       {r['per_route']}\n       worst {r['worst']}")


def main():
    parser = argparse.ArgumentParser(description="Fine-tune Laya on the GPU.")
    parser.add_argument("--epochs", type=int, default=3)
    parser.add_argument("--smoothing", type=float, default=0.1,
                        help="label smoothing; v1 trained without it and said 1.0 to everything")
    parser.add_argument("--score-only", metavar="CHECKPOINT", help="score an existing checkpoint and stop")
    args = parser.parse_args()

    require_gpu()
    require_laya()
    test = HERE / "test.jsonl"

    if args.score_only:
        show("base", score("base", test, "cuda"))
        show("tuned", score(args.score_only, test, "cuda"))
        return 0

    import prepare
    prepare.main()

    import torch
    from laya.train import TrainConfig, finetune

    base = base_checkpoint()
    name = f"laya-{datetime.now():%Y-%m-%d-%H%M}"
    out = OUT / name
    config = TrainConfig(epochs=args.epochs, micro_batch=8, grad_accum=8, label_smoothing=args.smoothing,
                         shuffle_options=("choice",), seed=0, eval_data=str(test))
    print(f"\nTraining {name}: {args.epochs} epochs, label smoothing {args.smoothing}")
    torch.cuda.reset_peak_memory_stats()
    started = time.time()
    trainer = finetune(data=str(HERE / "train.jsonl"), model_dir=str(base), output_dir=str(out),
                       config=config, device="cuda")
    minutes = (time.time() - started) / 60
    print(f"Trained in {minutes:.1f} min, peak {torch.cuda.max_memory_allocated() / 2**30:.1f} GB VRAM\n")

    before, after = score("base", test, "cuda"), score(str(out), test, "cuda")
    show("base", before)
    show("tuned", after)
    shutil.rmtree(out / "checkpoint_latest", ignore_errors=True)
    (out / "summary.json").write_text(json.dumps({
        "name": name, "laya_revision": LAYA_REVISION, "epochs": args.epochs, "label_smoothing": args.smoothing,
        "minutes": round(minutes, 1), "base": before, "tuned": after, "trainer": trainer,
    }, indent=2, default=str), encoding="utf-8")

    archive = shutil.make_archive(str(OUT / name), "zip", root_dir=OUT, base_dir=name)
    print(f"\nDone. Bring back {Path(archive).relative_to(HERE)} (about 850 MB), then on the Mac:\n"
          f"  python laya-train/install.py {Path(archive).name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
