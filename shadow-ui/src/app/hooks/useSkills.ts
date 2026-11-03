import { useEffect, useState } from "react";
import { getSkills, SKILLS_CHANGED } from "@/lib/api";
import type { Skill } from "@/types";

/* The slash menu's list. The brain never puts this in a prompt; it exists
   so the user can pick one. Reloads when Settings adds or removes a skill. */
export function useSkills(connected: boolean) {
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    if (!connected) return;
    const load = () =>
      getSkills()
        .then((r) => setSkills(r.skills ?? []))
        .catch((e) => console.warn("[skills] couldn't load the list:", (e as Error).message));
    load();
    window.addEventListener(SKILLS_CHANGED, load);
    return () => window.removeEventListener(SKILLS_CHANGED, load);
  }, [connected]);

  return skills;
}
