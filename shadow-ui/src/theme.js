export const THEMES = {
  charcoal: { label: "Charcoal", bg: "#13151a", panel: "#1b1e24", panelAlt: "#20242b", line: "#2b2f37", ink: "#e7e5e0", inkMuted: "#8a8f99" },
  black: { label: "Black", bg: "#000000", panel: "#0c0c0e", panelAlt: "#141417", line: "#24242a", ink: "#ececec", inkMuted: "#86868f" },
  midnight: { label: "Midnight", bg: "#0f1420", panel: "#151b2a", panelAlt: "#1b2234", line: "#283149", ink: "#e4e7ef", inkMuted: "#8b93a8" },
  light: { label: "Light", bg: "#f6f5f2", panel: "#ffffff", panelAlt: "#efeee9", line: "#dcdad3", ink: "#1b1d22", inkMuted: "#6b7079" },
};

export const ACCENTS = {
  phosphor: { label: "Phosphor", main: "#8fbf99", dim: "#5e8f6b" },
  blue: { label: "Blue", main: "#7fb0d6", dim: "#4f7fa6" },
  amber: { label: "Amber", main: "#d9b066", dim: "#a8823d" },
  violet: { label: "Violet", main: "#ad9ee0", dim: "#7b6cb0" },
  rose: { label: "Rose", main: "#e09aa6", dim: "#ad6874" },
};

export const DEFAULT_APPEARANCE = { theme: "charcoal", accent: "phosphor", radius: 8, textSize: 16 };

const KEY = "shadow.appearance";

export function loadAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { ...DEFAULT_APPEARANCE, ...saved };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(appearance));
  } catch {
    // storage unavailable, the look just won't persist
  }
}

export function applyAppearance(appearance) {
  const theme = THEMES[appearance.theme] ?? THEMES.charcoal;
  const accent = ACCENTS[appearance.accent] ?? ACCENTS.phosphor;
  const isLight = appearance.theme === "light";
  const root = document.documentElement;
  const set = (name, value) => root.style.setProperty(name, value);

  set("--color-bg", theme.bg);
  set("--color-panel", theme.panel);
  set("--color-panel-alt", theme.panelAlt);
  set("--color-line", theme.line);
  set("--color-ink", theme.ink);
  set("--color-ink-muted", theme.inkMuted);
  // On a light background the brighter accent is hard to read, so use the darker one.
  set("--color-phosphor", isLight ? accent.dim : accent.main);
  set("--color-phosphor-dim", accent.dim);

  const r = Number(appearance.radius) || 0;
  set("--radius-xs", `${Math.round(r * 0.25)}px`);
  set("--radius-sm", `${Math.round(r * 0.5)}px`);
  set("--radius-md", `${Math.round(r * 0.75)}px`);
  set("--radius-lg", `${r}px`);
  set("--radius-xl", `${Math.round(r * 1.5)}px`);

  root.style.fontSize = `${appearance.textSize}px`;
  root.style.colorScheme = isLight ? "light" : "dark";
  root.dataset.theme = isLight ? "light" : "dark";
}
