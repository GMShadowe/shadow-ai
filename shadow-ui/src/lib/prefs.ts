/* Small per-browser preferences (selected model, effort). localStorage can
   be missing or throw in a private window, so every access is guarded and
   the app works the same without it. */

export function loadPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function savePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable, ignore
  }
}

export const PREF = {
  model: "shadow.model",
  effort: "shadow.effort",
} as const;
