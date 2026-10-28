"""Loads adapter configs. Today an adapter is a specialty prompt plus
a tool whitelist on the shared base model. Later, each one also gets
real LoRA weights, and this file is where we'll point to them."""

import json
import os

CONFIG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "configs")


def _load_all() -> dict:
    adapters = {}
    for filename in os.listdir(CONFIG_DIR):
        if filename.endswith(".json"):
            with open(os.path.join(CONFIG_DIR, filename), "r", encoding="utf-8") as f:
                cfg = json.load(f)
            adapters[cfg["name"]] = cfg
    return adapters


ADAPTERS = _load_all()


def get_adapter(name: str) -> dict | None:
    return ADAPTERS.get(name)


def list_adapters() -> list[str]:
    return sorted(ADAPTERS.keys())
