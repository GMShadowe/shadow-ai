/* Themes, accents and the appearance the user saved. Every colour in the app
   comes from here as a CSS variable; components never name a hex.

   The default, Charcoal, is the person's brand palette: Charcoal #292521 as
   the ground, Cream #F5EDE1 as the ink, and Blue Regatta #6F8FE8 as the one
   colour - on your messages, the send key, focus and highlights. Cream is
   the same palette turned to light. */

export interface Theme {
  label: string;
  /** The conversation canvas. */
  bg: string;
  /** The sidebar and collapsed rail. */
  sidebar: string;
  /** Cards and blocks inside the conversation. */
  panel: string;
  /** Insets: code bodies, inputs, wells. */
  panelAlt: string;
  /** The prompt bar. */
  composer: string;
  /** Your own messages. */
  bubble: string;
  /** Text on your own messages (defaults to ink). */
  bubbleInk?: string;
  /** Menus, popovers and dialogs. */
  menu: string;
  line: string;
  ink: string;
  inkMuted: string;
  /** The quietest text: section headings, hints. */
  inkFaint: string;
  signal: string;
  danger: string;
  /** Kept for the few places a second tone is drawn; neutral on purpose. */
  glowA: string;
  glowB: string;
  shadow: string;
  light?: boolean;
}

export interface Accent {
  label: string;
  main: string;
  dim: string;
  /** A darker variant, used when the theme is light. */
  light?: string;
}

export const THEMES = {
  shadow: {
    label: "Charcoal", bg: "#292521", sidebar: "#211e1b", panel: "#322d28", panelAlt: "#2e2924",
    composer: "#2f2a25", bubble: "#6f8fe8", bubbleInk: "#1b1915", menu: "#35302a", line: "rgba(245, 237, 225, 0.09)",
    ink: "#f5ede1", inkMuted: "#c9c0b3", inkFaint: "#a49a8d", signal: "#6f8fe8", danger: "#f0705f",
    glowA: "#6f8fe8", glowB: "#b4c6f0", shadow: "rgba(0, 0, 0, 0.45)",
  },
  cream: {
    label: "Cream", bg: "#f5ede1", sidebar: "#ece2d3", panel: "#fbf7f0", panelAlt: "#efe6d8",
    composer: "#fbf7f0", bubble: "#6f8fe8", bubbleInk: "#1b1915", menu: "#fffaf3", line: "rgba(41, 37, 33, 0.1)",
    ink: "#292521", inkMuted: "#5f574e", inkFaint: "#73695e", signal: "#3f5fcf", danger: "#c4382b",
    glowA: "#6f8fe8", glowB: "#b4c6f0", shadow: "rgba(41, 37, 33, 0.12)", light: true,
  },
  midnight: {
    label: "Midnight", bg: "#11141b", sidebar: "#0c0e13", panel: "#171b24", panelAlt: "#141821",
    composer: "#161a23", bubble: "#182540", menu: "#1b202b", line: "rgba(160, 180, 255, 0.09)",
    ink: "#e8ebf2", inkMuted: "#a6adbd", inkFaint: "#767e91", signal: "#58a6ff", danger: "#f0605a",
    glowA: "#58a6ff", glowB: "#191970", shadow: "rgba(0, 0, 0, 0.55)",
  },
  graphite: {
    label: "Graphite", bg: "#1c1c1c", sidebar: "#161616", panel: "#262626", panelAlt: "#232323",
    composer: "#262626", bubble: "#1d3b66", menu: "#2a2a2a", line: "rgba(255, 255, 255, 0.09)",
    ink: "#ececec", inkMuted: "#b0b0b0", inkFaint: "#8c8c8c", signal: "#6ea8fe", danger: "#f0605a",
    glowA: "#ececec", glowB: "#b0b0b0", shadow: "rgba(0, 0, 0, 0.5)",
  },
  light: {
    label: "Light", bg: "#ffffff", sidebar: "#f6f7f9", panel: "#ffffff", panelAlt: "#f6f7f9",
    composer: "#ffffff", bubble: "#e6efff", menu: "#ffffff", line: "rgba(17, 19, 24, 0.09)",
    ink: "#111318", inkMuted: "#5b6070", inkFaint: "#868b99", signal: "#0f43e7", danger: "#d1322b",
    glowA: "#0d0d0d", glowB: "#5d5d5d", shadow: "rgba(0, 0, 0, 0.08)", light: true,
  },
  black: {
    label: "Black", bg: "#000000", sidebar: "#0d0d0d", panel: "#171717", panelAlt: "#0d0d0d",
    composer: "#1a1a1a", bubble: "#17335a", menu: "#262626", line: "rgba(255, 255, 255, 0.1)",
    ink: "#ececec", inkMuted: "#b4b4b4", inkFaint: "#8f8f8f", signal: "#7ab7ff", danger: "#f0605a",
    glowA: "#ececec", glowB: "#b4b4b4", shadow: "rgba(0, 0, 0, 0.6)",
  },
  navy: {
    label: "Navy", bg: "#141a26", sidebar: "#0f141e", panel: "#1b2232", panelAlt: "#0f141e",
    composer: "#1b2232", bubble: "#24467a", menu: "#273043", line: "rgba(255, 255, 255, 0.1)",
    ink: "#e6e9f0", inkMuted: "#a9b1c2", inkFaint: "#7f8899", signal: "#8ab4f8", danger: "#f0605a",
    glowA: "#e6e9f0", glowB: "#a9b1c2", shadow: "rgba(0, 0, 0, 0.6)",
  },
} satisfies Record<string, Theme>;

export const ACCENTS = {
  regatta: { label: "Blue Regatta", main: "#6f8fe8", dim: "#5574d6", light: "#3f5fcf" },
  horizon: { label: "Horizon", main: "#58a6ff", dim: "#3b82e0", light: "#0f43e7" },
  neutral: { label: "Neutral", main: "#ececec", dim: "#b4b4b4", light: "#0d0d0d" },
  green: { label: "Green", main: "#3ecf8e", dim: "#27a571", light: "#13855a" },
  violet: { label: "Violet", main: "#b9a4ff", dim: "#8a74d6", light: "#6a4fd8" },
  amber: { label: "Amber", main: "#e5b567", dim: "#b88a3c", light: "#8a6418" },
} satisfies Record<string, Accent>;

export type ThemeId = keyof typeof THEMES;
export type AccentId = keyof typeof ACCENTS;

export interface Appearance {
  version: number;
  theme: ThemeId;
  accent: AccentId;
  radius: number;
  textSize: number;
}

// Bump when the default look changes: saved themes move to the new default once.
const VERSION = 7;

export const DEFAULT_APPEARANCE: Appearance = {
  version: VERSION,
  theme: "shadow",
  accent: "regatta",
  radius: 12,
  textSize: 16,
};

const KEY = "shadow.appearance";

export function loadAppearance(): Appearance {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Appearance>;
    if (saved.version !== VERSION) {
      const { theme: _theme, accent: _accent, radius: _radius, ...rest } = saved;
      return { ...DEFAULT_APPEARANCE, ...rest, version: VERSION };
    }
    const merged = { ...DEFAULT_APPEARANCE, ...saved };
    // A theme or accent that no longer exists falls back rather than breaking.
    if (!(merged.theme in THEMES)) merged.theme = DEFAULT_APPEARANCE.theme;
    if (!(merged.accent in ACCENTS)) merged.accent = DEFAULT_APPEARANCE.accent;
    return merged;
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(appearance: Appearance): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...appearance, version: VERSION }));
  } catch {
    // storage unavailable, the look just won't persist
  }
}

/* Every colour transition in the app would otherwise fire at once on a theme
   change and smear the switch, so transitions are off for one frame. */
function withoutTransitions(apply: () => void): void {
  const style = document.createElement("style");
  style.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(style);
  apply();
  void getComputedStyle(document.body).opacity; // force the style flush
  requestAnimationFrame(() => requestAnimationFrame(() => style.remove()));
}

export function applyAppearance(appearance: Appearance): void {
  const theme: Theme = THEMES[appearance.theme] ?? THEMES.shadow;
  const accent: Accent = ACCENTS[appearance.accent] ?? ACCENTS.regatta;
  const isLight = !!theme.light;
  const root = document.documentElement;
  const set = (name: string, value: string) => root.style.setProperty(name, value);

  withoutTransitions(() => {
    set("--color-bg", theme.bg);
    set("--color-sidebar", theme.sidebar);
    set("--color-panel", theme.panel);
    set("--color-panel-alt", theme.panelAlt);
    set("--color-composer", theme.composer);
    set("--color-bubble", theme.bubble);
    set("--color-bubble-ink", theme.bubbleInk ?? theme.ink);
    set("--color-menu", theme.menu);
    set("--color-line", theme.line);
    set("--color-ink", theme.ink);
    set("--color-ink-muted", theme.inkMuted);
    set("--color-ink-faint", theme.inkFaint);
    set("--color-signal", theme.signal);
    set("--color-danger", theme.danger);
    set("--color-glow-a", theme.glowA);
    set("--color-glow-b", theme.glowB);
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme.sidebar);
  });
}
