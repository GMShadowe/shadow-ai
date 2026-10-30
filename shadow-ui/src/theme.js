export const THEMES = {
  light: {
    label: "Light", bg: "#fafafa", panel: "#ffffff", panelAlt: "#f3f4f7", line: "#e6e7eb",
    ink: "#111318", inkMuted: "#6b7080", signal: "#0f43e7", danger: "#d03b2f",
    glow: "#58a6ff", glowDeep: "#191970", shadow: "rgba(17, 24, 39, 0.16)",
  },
  charcoal: {
    label: "Charcoal", bg: "#13151a", panel: "#1b1e24", panelAlt: "#20242b", line: "#2b2f37",
    ink: "#e7e5e0", inkMuted: "#8a8f99", signal: "#6fa3c7", danger: "#d9837a",
    glow: "#58a6ff", glowDeep: "#191970", shadow: "rgba(0, 0, 0, 0.8)",
  },
  black: {
    label: "Black", bg: "#000000", panel: "#0c0c0e", panelAlt: "#141417", line: "#24242a",
    ink: "#ececec", inkMuted: "#86868f", signal: "#6fa3c7", danger: "#d9837a",
    glow: "#58a6ff", glowDeep: "#191970", shadow: "rgba(0, 0, 0, 0.8)",
  },
  midnight: {
    label: "Midnight", bg: "#0f1420", panel: "#151b2a", panelAlt: "#1b2234", line: "#283149",
    ink: "#e4e7ef", inkMuted: "#8b93a8", signal: "#6fa3c7", danger: "#d9837a",
    glow: "#58a6ff", glowDeep: "#191970", shadow: "rgba(0, 0, 0, 0.8)",
  },
};

export const ACCENTS = {
  horizon: { label: "Horizon", main: "#58a6ff", dim: "#3d7fd9", light: "#0f43e7" },
  phosphor: { label: "Phosphor", main: "#8fbf99", dim: "#5e8f6b" },
  amber: { label: "Amber", main: "#d9b066", dim: "#a8823d" },
  violet: { label: "Violet", main: "#ad9ee0", dim: "#7b6cb0" },
  rose: { label: "Rose", main: "#e09aa6", dim: "#ad6874" },
};

// Bump when the default look changes: saved themes move to the new default once.
const VERSION = 2;

export const DEFAULT_APPEARANCE = { version: VERSION, theme: "light", accent: "horizon", radius: 8, textSize: 16 };

const KEY = "shadow.appearance";

export function loadAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (saved.version !== VERSION) {
      const { theme: _theme, accent: _accent, ...rest } = saved;
      return { ...DEFAULT_APPEARANCE, ...rest, version: VERSION };
    }
    return { ...DEFAULT_APPEARANCE, ...saved };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...appearance, version: VERSION }));
  } catch {
    // storage unavailable, the look just won't persist
  }
}

export function applyAppearance(appearance) {
  const theme = THEMES[appearance.theme] ?? THEMES.light;
  const accent = ACCENTS[appearance.accent] ?? ACCENTS.horizon;
  const isLight = appearance.theme === "light" || !THEMES[appearance.theme];
  const root = document.documentElement;
  const set = (name, value) => root.style.setProperty(name, value);

  set("--color-bg", theme.bg);
  set("--color-panel", theme.panel);
  set("--color-panel-alt", theme.panelAlt);
  set("--color-line", theme.line);
  set("--color-ink", theme.ink);
  set("--color-ink-muted", theme.inkMuted);
  set("--color-signal", theme.signal);
  set("--color-danger", theme.danger);
  set("--color-glow", theme.glow);
  set("--color-glow-deep", theme.glowDeep);
  set("--shadow-color", theme.shadow);
  // On a light background the brighter accent is hard to read, so use the darker one.
  const onLight = accent.light ?? accent.dim;
  set("--color-phosphor", isLight ? onLight : accent.main);
  set("--color-phosphor-dim", isLight ? onLight : accent.dim);

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
