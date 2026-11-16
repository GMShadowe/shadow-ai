import { expect, test } from "@playwright/test";
import { fakeBrain } from "./brain.ts";

test("a message streams a reply into the chat", async ({ page }) => {
  const brain = await fakeBrain(page);
  await page.goto("/");

  await page.getByLabel("Message").fill("hello shadow");
  await page.keyboard.press("Enter");

  await expect(page.getByText("You said: hello shadow")).toBeVisible();
  expect(brain.sent).toHaveLength(1);
  expect(brain.sent[0]).toMatchObject({ message: "hello shadow", skill: null });
});

test("stop ends a reply that is still coming", async ({ page }) => {
  const brain = await fakeBrain(page);
  await page.goto("/");
  brain.holdNextReply();

  await page.getByLabel("Message").fill("write me a long essay");
  await page.keyboard.press("Enter");
  const stop = page.getByRole("button", { name: "Stop the reply" });
  await expect(stop).toBeVisible();

  await stop.click();

  await expect.poll(() => brain.stops).toBe(1);
  await expect(page.getByText("Stopped", { exact: true })).toBeVisible();
  await expect(stop).toBeHidden();
});

test("an added skill is reviewed before its first message goes out", async ({ page }) => {
  const brain = await fakeBrain(page);
  await page.goto("/");

  await page.getByLabel("Message").fill("/pdf-helper summarise report.pdf");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");

  const review = page.getByRole("dialog", { name: /Review \/pdf-helper/ });
  await expect(review).toBeVisible();
  await expect(review).toContainText("file: pdf.md");
  await expect(review).toContainText("read_file");
  await expect(review).toContainText("scripts/extract.py");
  expect(brain.sent).toHaveLength(0);

  await review.getByRole("button", { name: "Cancel" }).click();
  await expect(review).toBeHidden();
  expect(brain.sent).toHaveLength(0);

  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Use this skill" }).click();
  await expect(page.getByText("You said: summarise report.pdf")).toBeVisible();
  expect(brain.approved).toEqual(["pdf-helper"]);
  expect(brain.sent[0]).toMatchObject({ skill: "pdf-helper", message: "summarise report.pdf" });
});

test("a skill can be sent on its own", async ({ page }) => {
  const brain = await fakeBrain(page);
  await page.goto("/");

  await page.getByLabel("Message").fill("/summarize");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Enter");

  await expect.poll(() => brain.sent.length).toBe(1);
  expect(brain.sent[0]).toMatchObject({ skill: "summarize", message: "/summarize" });
});

test("the sidebar can be kept open or closed, and remembers it", async ({ page }) => {
  await fakeBrain(page);
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "Sidebar" });
  const startedOpen = (await sidebar.getAttribute("data-expanded")) === "true";

  await page.getByRole("button", { name: startedOpen ? "Close sidebar" : "Keep sidebar open" }).click();
  await page.mouse.move(900, 400);
  await expect(sidebar).toHaveAttribute("data-expanded", String(!startedOpen));

  await page.reload();
  await page.mouse.move(900, 400);
  await expect(sidebar).toHaveAttribute("data-expanded", String(!startedOpen));
});
