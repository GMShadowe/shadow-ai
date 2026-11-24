# Training Laya

Laya is the router that decides whether a message needs the file, system,
coding, research or health tools, or none. Out of the box it is unsure
about almost everything (most scores are 0.2-0.4), so "how much storage left"
scored 0.27, fell under the 0.30 floor and reached the model with no tools.
This folder fine-tunes it on the GPU and brings it back to the brain.

Training needs an NVIDIA GPU (an RTX 3060 12GB is enough). It refuses to run
on a Mac: training there swapped until the laptop froze.

## On the PC

Python 3.11 or newer. From the repository root:

```
git pull
python -m venv .venv
```

Activate it - `.venv\Scripts\activate` in PowerShell, `source .venv/bin/activate`
in a POSIX shell - then:

```
pip install torch --index-url https://download.pytorch.org/whl/cu124
pip install -r laya-train/requirements.txt
python laya-train/train.py
```

It builds the data, downloads the pinned Laya and checks its digests, trains
(minutes, not hours), scores the result against the base the way Shadow
routes, and leaves `laya-train/out/laya-<date>.zip` (about 850 MB). Copy that
file to the Mac - a USB stick, AirDrop or a shared folder. Don't commit it.

`python laya-train/train.py --epochs 2 --smoothing 0.05` changes the two
settings worth changing. `--score-only out/laya-<date>` re-scores one.

## Back on the Mac

```
shadow-brain/.venv/bin/python laya-train/install.py ~/Downloads/laya-<date>.zip
```

Then restart the brain. It prints `[Laya] Using the fine-tuned checkpoint`.

Before installing, it scores the new checkpoint and the pinned one on the
generated test set and on your own messages in
`laya-fine-tune/real/real_test.jsonl`, which stay on the Mac. It refuses one
that routes your messages worse (`--force` overrides). The brain checks the
installed files against the digests recorded here on every start, and uses
the pinned Laya if they changed.

`install.py --remove` goes back to the pinned Laya. The previous install is
kept in `shadow-brain/data/laya-previous/`.

## The data

- `data/generated.jsonl`: 1,842 generated prompts, labelled and checked
  (the ones whose label disagreed with what they were generated for are left
  out).
- `data/extra.jsonl`: hand-written prompts for what the generated set lacks
  - the `health` route, which it has none of, and the misses seen in real
  use ("whats my storage", "read notes.md", "news about nvidia", "try
  searching on airbnb").

`prepare.py` asks Laya exactly the question the brain asks, read from
`shadow-brain/router/routes.py`, so a route added there needs examples here
or it refuses to build. Each route is repeated up to the size of the
largest, so 45 health prompts aren't outvoted by 380 coding ones. 10% of the
generated prompts and 30% of the hand-written ones are held out for testing.

Nothing here comes from a real conversation. This repository is public; the
real messages used to judge a checkpoint stay in `laya-fine-tune/`, which is
not committed.
