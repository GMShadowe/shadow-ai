"""In-session conversation memory. Only user messages and Shadow's
final replies are kept, not tool chatter, so small models don't drown
in context. Old turns get trimmed.

Images: only the most recent image stays attached, and only while it's
within the last few messages. Re-sending every old image on every turn
would make each reply slower.

Each reply also remembers which adapters it ran with, so a follow-up the
router reads as chat ("yes, go ahead") keeps the tools the task needs."""


class ShortTermMemory:
    def __init__(self, max_turns: int = 10, image_window: int = 4):
        self.max_turns = max_turns
        self.image_window = image_window
        self.messages: list[dict] = []

    def add(self, role: str, content: str, images: list[str] | None = None,
            adapters: list[str] | None = None) -> None:
        message = {"role": role, "content": content}
        if images:
            message["images"] = list(images)
        if adapters:
            message["adapters"] = list(adapters)
        self.messages.append(message)
        limit = self.max_turns * 2
        if len(self.messages) > limit:
            self.messages = self.messages[-limit:]

    def get(self) -> list[dict]:
        latest_image = max((i for i, m in enumerate(self.messages) if m.get("images")), default=-1)
        window_start = len(self.messages) - self.image_window

        out = []
        for i, m in enumerate(self.messages):
            item = {"role": m["role"], "content": m["content"]}
            if m.get("images"):
                if i == latest_image and i >= window_start:
                    item["images"] = m["images"]
                else:
                    item["content"] += f"\n[{len(m['images'])} image(s) attached earlier]"
            out.append(item)
        return out

    def recent_adapters(self, turns: int) -> list[str]:
        """Adapters the last `turns` replies ran with, most recent first."""
        names: list[str] = []
        replies = [m for m in self.messages if m["role"] == "assistant"][-turns:]
        for m in reversed(replies):
            for name in m.get("adapters", []):
                if name not in names:
                    names.append(name)
        return names

    def clear(self) -> None:
        self.messages = []
