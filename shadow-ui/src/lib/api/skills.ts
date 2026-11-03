import type { Skill } from "@/types";
import { ApiError, enc, jsonInit, request, url } from "./client";

/* Skills. Only the UI reads these: the brain never puts the list in a
   prompt, so Shadow can't offer or invent a skill the user didn't invoke. */
export const getSkills = () => request<{ skills?: Skill[] }>("/skills", "Couldn't load skills");
export const getSkill = (name: string) => request(`/skills/${enc(name)}`, "Couldn't load that skill");

export async function addSkill(body: unknown) {
  const res = await fetch(url("/skills"), jsonInit("POST", body));
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 405: the running brain predates this endpoint.
    const detail =
      res.status === 405
        ? "The brain that's running is older than this screen and can't add skills yet. Restart it (stop uvicorn and start it again), then try again."
        : data.detail;
    throw new ApiError(detail || "Couldn't add that skill", res.status);
  }
  return data;
}

export const deleteSkill = (name: string) =>
  request(`/skills/${enc(name)}`, "Couldn't remove that skill", { method: "DELETE" });

/** Fired on window when the skill list changes, so the slash menu reloads. */
export const SKILLS_CHANGED = "shadow:skills-changed";
