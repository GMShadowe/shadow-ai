# Shadow design guide

Shadow's colours, type, shapes, motion and voice. It covers every surface:
the app (`shadow-ui`), the landing page, docs, and social images. If you are
building something new that people will see, start here so it looks like
part of the same product.

The app's own component rules live in [`shadow-ui/DESIGN.md`](shadow-ui/DESIGN.md).
The colour values in this file come from
[`shadow-ui/src/theme/appearance.ts`](shadow-ui/src/theme/appearance.ts) and
[`shadow-ui/src/styles/index.css`](shadow-ui/src/styles/index.css).
If a value here and in those files ever disagree, the code is right; fix
this file.

---

## 1. What Shadow is, and how it should feel

Shadow is a personal AI assistant that runs on your own computer. Models run
locally through Ollama, your chats stay on the machine, and nothing is sent
anywhere unless you choose a remote model.

The look is **warm, calm and a little playful**. A charcoal ground with
cream text and one blue that does all the talking. It is not a neon "AI"
look, and it is not a copy of ChatGPT or any other assistant. The details
are exact and quiet. Delight is saved for rare moments, such as a sparkle
burst or a card that lifts on hover.

---

## 2. Colour

### The three brand colours

| Name | Hex | Role |
| --- | --- | --- |
| **Charcoal** | `#292521` | The ground: backgrounds, dark text on blue |
| **Cream** | `#F5EDE1` | The ink: text on charcoal, the light theme's ground |
| **Blue Regatta** | `#6F8FE8` | **The one colour**: primary actions, highlights, your messages |

A fourth tone, **Wave Blue** `#B4C6F0`, is the pale blue from the brand's
wave artwork. Use it for soft fills, secondary highlights and illustration.
It never carries text in its own colour.

**Proportions.** On a page, roughly 70% Charcoal, 20% Cream text and
surfaces, and 10% Blue. Blue is precious: if everything is blue, nothing
is.

### Full palette, dark ("Charcoal", the default)

| Token | Hex | Used for |
| --- | --- | --- |
| `sidebar` | `#211E1B` | Deepest surface: nav bars, footers, side columns |
| `bg` | `#292521` | Page background |
| `panel` | `#322D28` | Cards, code blocks, raised sections |
| `panel-alt` | `#2E2924` | Insets inside cards |
| `composer` | `#2F2A25` | Inputs and text fields |
| `menu` | `#35302A` | Menus, popovers, dialogs |
| `line` | Cream at 9%: `rgba(245,237,225,0.09)` | Every hairline and border |
| `ink` | `#F5EDE1` | Body text, headings |
| `ink-muted` | `#C9C0B3` | Secondary text |
| `ink-faint` | `#A49A8D` | Labels, captions, hints |
| `signal` | `#6F8FE8` | Accent: links, focus, active state, primary buttons |
| `bubble` | `#6F8FE8` | Blue fills (user messages, primary cards) |
| `bubble-ink` | `#1B1915` | Text on any blue fill |
| `glow-b` | `#B4C6F0` | Wave Blue fills |
| `danger` | `#F0705F` | Errors, delete, "this leaves your computer" |
| `ok` | `#3ECF8E` | The "running locally" dot. Nothing else. |

### Light ("Cream")

| Token | Hex |
| --- | --- |
| `bg` | `#F5EDE1` |
| `sidebar` | `#ECE2D3` |
| `panel`, `composer` | `#FBF7F0` |
| `panel-alt` | `#EFE6D8` |
| `menu` | `#FFFAF3` |
| `line` | Charcoal at 10%: `rgba(41,37,33,0.10)` |
| `ink` / `ink-muted` / `ink-faint` | `#292521` / `#5F574E` / `#73695E` |
| `signal` | `#3F5FCF` (a deeper blue, because `#6F8FE8` is too pale to read on cream) |
| `bubble` / `bubble-ink` | `#6F8FE8` / `#1B1915` (unchanged) |
| `danger` | `#C4382B` |

### Contrast (measured, WCAG 2.2)

| Pair | Ratio | OK for |
| --- | --- | --- |
| Cream on Charcoal | 13.1 : 1 | All text |
| `ink-muted` on Charcoal | 8.5 : 1 | All text |
| `ink-faint` on Charcoal | 5.5 : 1 | All text |
| Blue Regatta on Charcoal | 4.9 : 1 | Text, links, icons |
| `bubble-ink` on Blue Regatta | 5.7 : 1 | Text on blue buttons and cards |
| `bubble-ink` on Wave Blue | 10.3 : 1 | Text on pale-blue cards |
| Charcoal on Cream | 13.1 : 1 | All text (light) |
| `ink-faint` light on Cream | 4.6 : 1 | All text (light) |
| `#3F5FCF` on Cream | 4.8 : 1 | Links and buttons (light) |
| **Blue Regatta on Cream** | **2.7 : 1** | **Never for text.** Fills and decoration only. |
| **Cream on Blue Regatta** | about 2.7 : 1 | **Never.** Put Charcoal text on blue, not cream. |

### Colour rules

- **Text on blue is always dark** (`#1B1915`), never white or cream.
- **One colour.** Don't add purple, teal or green accents. Green only marks
  "running locally". Red only marks errors, deleting, and data leaving
  the computer.
- **Selected text inside blue boxes** gets a charcoal highlight with blue
  letters. A blue highlight on blue disappears.
- **Gradients are controlled.** At most one soft gradient per section, made
  of Blue Regatta, Wave Blue and Charcoal, and never behind body text.
  Animated shimmer, like the "Ultra" effort setting, is a rare treat, not
  a background.

### Paste-ready CSS

```css
:root {
  /* Charcoal (default) */
  --color-sidebar: #211e1b;
  --color-bg: #292521;
  --color-panel: #322d28;
  --color-panel-alt: #2e2924;
  --color-composer: #2f2a25;
  --color-menu: #35302a;
  --color-line: rgba(245, 237, 225, 0.09);
  --color-ink: #f5ede1;
  --color-ink-muted: #c9c0b3;
  --color-ink-faint: #a49a8d;
  --color-signal: #6f8fe8;
  --color-bubble: #6f8fe8;
  --color-bubble-ink: #1b1915;
  --color-glow-b: #b4c6f0;
  --color-danger: #f0705f;
  --color-ok: #3ecf8e;

  --font-sans: "Geist", ui-sans-serif, system-ui, "Segoe UI", sans-serif;
  --font-mono: "Geist Mono", ui-monospace, "Cascadia Mono", Consolas, monospace;
  --font-serif: "Geist Serif", Georgia, serif;

  --ease-smooth: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
}

/* Cream (light) */
[data-theme="light"] {
  --color-sidebar: #ece2d3;
  --color-bg: #f5ede1;
  --color-panel: #fbf7f0;
  --color-panel-alt: #efe6d8;
  --color-composer: #fbf7f0;
  --color-menu: #fffaf3;
  --color-line: rgba(41, 37, 33, 0.1);
  --color-ink: #292521;
  --color-ink-muted: #5f574e;
  --color-ink-faint: #73695e;
  --color-signal: #3f5fcf;
  --color-danger: #c4382b;
}
```

With Tailwind 4, put the same variables in an `@theme { … }` block. You
then get `bg-bg`, `text-ink`, `bg-signal`, `border-line` and so on, the same
names the app uses.

---

## 3. Type

| Face | Use | Source |
| --- | --- | --- |
| **Geist** (variable, 100–900) | All interface and body text | `geist` npm package, `dist/fonts/geist-sans/Geist-Variable.woff2` |
| **Geist Mono** (variable) | Numbers, labels, readouts, code, key hints | `dist/fonts/geist-mono/GeistMono-Variable.woff2` |
| **Geist Serif** (Regular) | **Display headlines only** (28px and up) | `dist/fonts/geist-serif/GeistSerif-Regular.woff2` |

The app self-hosts these from `shadow-ui/src/assets/fonts/` under the SIL
Open Font License. Self-host them on the site too; don't load them from a
font CDN.

### Scale

| Role | Size / line height | Weight | Notes |
| --- | --- | --- | --- |
| Hero headline | 56–80px / 1.05 | Serif 400 | Letter spacing −0.02em. A second line may drop to `ink-muted`. |
| Section headline | 40px / 1.1 | Serif 400 | Letter spacing −0.02em |
| Card title | 18–20px / 1.3 | Sans 600 | |
| Body | 16px / 1.6 (long text up to 18px / 1.7) | Sans 400 | Keep lines to 60–75 characters |
| UI text, buttons | 14px / 1.4 | Sans 500 | |
| Captions, labels | 12.5–13px | Sans 500, `ink-faint` | **Sentence case, never ALL CAPS** |
| Mono accents | 11–12px | Mono 400 | Numbers, versions, `⌘ K` style key hints, tags |

- Serif headlines are always regular weight (400), never bold.
- Use `font-variant-numeric: tabular-nums` on numbers that change.
- Use curly quotes, real ellipses (…) and en dashes in copy.

---

## 4. Logo and motifs

### The mark

A form and the shadow it casts: a circle, and an arc that is its shadow.

```svg
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
  <circle cx="10" cy="10" r="5.5"/>
  <path d="M17.6 8.6a5.5 5.5 0 0 1-9 9" opacity="0.55"/>
</svg>
```

- **Wordmark:** "Shadow" in Geist 600, next to the mark. The mark's width
  is about 1.2× the cap height, with a gap of 0.4× the mark between them.
- **App icon / favicon:** `shadow-ui/public/favicon.svg`. A Blue Regatta
  rounded tile (radius 8 of 32) with a solid Cream circle, its Charcoal
  shadow down and to the right, and a Cream sparkle in the corner. Use it
  as-is for social avatars and app icons.
- **Clear space:** at least the height of the circle on every side.
  **Smallest size:** 16px.
- **The logo always links to `/`.**
- Don't recolour the mark outside the palette, stretch it, outline it, add
  a glow, or put it on a busy photo.

### The sparkle

The four-point sparkle is the brand's accent motif. Use it for small
moments: a chosen state, a hover reward, a bullet in a feature list.

```svg
<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5v.01c-4.6.6-6.9 2.9-7.5 7.5h-.01c-.6-4.6-2.9-6.9-7.5-7.5V10c4.6-.6 6.9-2.9 7.5-7.5z"/></svg>
```

### The wave

Soft, organic bands of Blue Regatta and Wave Blue, from the brand book.
Good for the hero background, section dividers and illustrations. Inside
the app it shows up as the scroll ribbon beside long chats. Keep waves
behind headlines and away from body text.

### Texture

A fading **dot grid**: 1px dots 22px apart, Cream at about 16%, fading out
from the centre. It sits behind empty or hero areas.

---

## 5. Shape and depth

| Thing | Radius |
| --- | --- |
| Small controls, chips | 8–10px |
| Buttons | 10px, or fully round for pills |
| Inputs, the prompt bar | 16px |
| Cards | 16px (`rounded-2xl`) |
| Large panels, the hero product shot | 20–24px |

- **Flat with hairlines.** Structure comes from a 1px `line` border, not
  from shadows.
- **No shadows or glows behind inputs or text fields.** On focus, the
  border turns Blue Regatta and nothing else changes. (The person asked for
  this.)
- Only floating layers (menus, popovers, dialogs) get a short, soft
  shadow: `0 10px 30px -6px rgba(0,0,0,.45)`.
- Nested corners: outer radius = inner radius + padding.

---

## 6. Components to reuse on the site

These match what the app already does.

- **Primary button:** a Blue Regatta fill, `#1B1915` text, radius 10px,
  14px/500. On hover, `opacity: .9`. On press, `scale(.96)`.
- **Secondary button:** transparent with a `line` border and `ink` text. On
  hover, the background gets a 6% ink wash.
- **Link:** `signal` colour, underlined on hover.
- **Brand cards:** four looks, used together as a set (the empty chat's
  starter cards):
  1. A Blue Regatta fill with `bubble-ink` text
  2. A Charcoal `panel` with a hairline and `ink` text
  3. A Cream fill with Charcoal text
  4. A Wave Blue fill with `bubble-ink` text

  Each has a small round icon tile at the top left and a title plus a
  one-line hint at the bottom. On hover the card lifts 3px and a sparkle
  spins into its corner. On press it scales to .97.
- **Chips / tags:** fully rounded, a hairline border, mono 11px,
  `ink-faint`.
- **Status pill:** a hairline pill holding a green dot and mono text, for
  example `● Plus · running on this computer`.
- **Code blocks:** a `panel` fill with a hairline and radius 16px. The
  header shows the language plus copy and wrap icons. Syntax colours
  (dark): blue `#2e95d3` keywords, green `#00a67d` strings, pink `#df3079`
  numbers. The light versions are in `shadow-ui/src/styles/markdown.css`.
- **Key hints:** mono, `ink-faint`, written like `↵ send`, `⇧ ↵ new line`,
  `⌘ K`.

---

## 7. Motion

| Token | Value |
| --- | --- |
| `--ease-smooth` | `cubic-bezier(0.23, 1, 0.32, 1)`: everything entering, leaving or responding |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)`: drawers and sidebars |
| Press | `scale(.96)` over 150ms. Never on disabled controls. |
| Hover, colour changes | 100–150ms |
| Menus, popovers | 150–200ms, growing from the side of their trigger (start at `scale(.96)` + opacity 0) |
| Drawers, sidebars | 260–280ms |
| Staggered entrances | 50–100ms apart, 300ms each, rising 6–12px with a fade |

- Never use `ease-in` on UI, never `transition: all`, never `scale(0)`.
- Keyboard shortcuts open things instantly, without animation.
- Hover effects only on real pointers: `@media (hover: hover) and (pointer: fine)`.
- **Respect `prefers-reduced-motion`.** Drop movement and keep fades.
- Delight belongs to rare, deliberate moments, such as the Ultra sparkle
  burst. A landing page may use scroll reveals: a 6–12px rise plus a fade,
  once per element, never on body paragraphs.

---

## 8. Voice and copy

- **Plain and specific.** Say what happens: "Runs on your computer. Your
  chats never leave it." Avoid hype words like "revolutionary",
  "supercharge" or "unleash".
- **Sentence case everywhere**: headings, buttons, labels.
- **Honest about limits.** If something isn't there yet, say "soon"; don't
  imply it works. The app lists Create image and Create video as "soon".
- **Key facts to lean on:** local-first; models via Ollama; several
  assistants, each with its own chats and memory; tools for files, shell
  commands and web search, with your permission; voice mode; nothing leaves
  the machine unless you pick a remote model, and then the app says so
  plainly.
- The product name is **Shadow** (capital S) in copy. The lowercase
  "shadow" wordmark only appears in headers next to the mark.

---

## 9. Do and don't

**Do**
- Use Charcoal, Cream and Blue Regatta, in roughly that order of quantity
- Use serif headlines, Geist body text and mono for numbers
- Build structure from hairlines, flat surfaces and generous space
- Use one Blue Regatta primary action per view
- Put dark text on blue
- Use sparkles and waves as accents

**Don't**
- Copy ChatGPT, Codex or any other assistant's look
- Add other accent colours (teal, purple, neon)
- Put a gradient behind body text, or glow and shadow around inputs
- Use ALL-CAPS labels or bold serif
- Use white or cream text on Blue Regatta
- Use the ASCII figures or matrix-style effects from older drafts (they
  were removed)

---

## 10. Checklist before you ship a page

- [ ] Every colour comes from the tokens above
- [ ] Text contrast is at least 4.5:1 (check text on blue and on Cream especially)
- [ ] Geist, Geist Mono and Geist Serif are self-hosted; serif only at 28px and up
- [ ] Only one primary Blue Regatta action per view
- [ ] The logo links to `/`; the favicon is `shadow-ui/public/favicon.svg`
- [ ] Hover is gated to real pointers; reduced motion is respected
- [ ] It works at 320px wide and at 200% zoom
- [ ] Copy is sentence case, plain and honest
