"""Checks the real router (Laya + blending) on known prompts."""

from router.classifier import classify_detailed

TESTS = [
    ("hi, who are you?", "chat"),
    ("can you help me code? tell me about laya, search it up and tell me", "research"),
    ("write a python script that prints the first 10 primes and run it", "coding"),
    ("find all python files in my folder", "files"),
    ("open the notes app", "system"),
    ("what's my ram usage?", "system"),
    ("what's the latest ollama release?", "research"),
    ("make me a todo list in a json file", "files"),
]

correct = 0
for text, expected in TESTS:
    d = classify_detailed(text)
    adapters = d["adapters"]
    ok = (expected == "chat" and not adapters) or expected in adapters
    correct += ok
    top = sorted((d["probabilities"] or {}).items(), key=lambda kv: kv[1], reverse=True)[:2]
    top_str = ", ".join(f"{k} {v:.2f}" for k, v in top)
    print(f"{'OK  ' if ok else 'MISS'} {d['ms']:5}ms  expected={expected:9} got={'+'.join(adapters) or 'chat':16} [{top_str}]  {text}")

print(f"\n{correct}/{len(TESTS)} correct")
