import { expect, it } from "vitest";
import { hasCodeBlock } from "./highlighter";

it("loads highlighting only for fenced code", () => {
  expect(hasCodeBlock("Run:\n```bash\nls\n```")).toBe(true);
  expect(hasCodeBlock("~~~\ncode\n~~~")).toBe(true);
  expect(hasCodeBlock("Use `ls` to list files.")).toBe(false);
});
