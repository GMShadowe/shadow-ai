---
name: taste
description: A living record of one person's taste in interfaces, read from their tasteboard and from what they say while building. Use whenever adding, editing or reviewing anything a person will see (layout, components, copy, motion, icons, color, type), and update this file whenever they reveal more of their taste.
---

# Taste

This file is a living record of one person's taste. It starts almost empty and gets better in two ways: from their board (`board/`, the screenshots, sites and notes they saved) and from what they say while you build with them. You are the one who keeps it.

Tasteboard writes `board/` and replaces it when the board changes. It never touches this file once it exists.

## How to keep this file

1. **Load it before any change a person will see.** Follow what's written here over your own defaults. Where it says nothing, do the plain thing and keep it small.
2. **Read the board when it has something new.** `board/BOARD.md` lists every thing on the board, group by group. A thing is new when its id isn't under "From the board" below. For each new thing:
   - a picture: open its file in `board/images/` and look at it;
   - a site: open the link and look at the page itself, not only its picture;
   - a note, or the "why" line under a thing: those are the person's own words, and they outrank what you see.

   Things in one group were put together on purpose. A group with a name was made by hand, and the name is their own word for what its things share. Ask what a group shares before asking what each thing is.
3. **Write what repeats, in numbers.** One screenshot is an example. Three that agree are a rule. Measure: hex values, px, radii, type sizes and weights, line heights, durations, curves, columns, the space between things. "Clean" and "modern" are not rules. "Radius 24 on blocks, 12 on 36px controls" is. Say which things each rule came from. Where the board disagrees with itself, write both down and ask.
4. **Listen while you build.** When the person corrects, praises or rejects something, that is taste. Fix the work, then refine the rule it touches (change a rule before adding one that contradicts it) and add a dated line to the taste log: their words in quotes, and what changed. What they say in the code beats what the board suggests.
5. **Keep what was sent back.** Something tried and rejected goes under "Tried and sent back" with their words, so it isn't tried a second time.
6. **Write only what you know.** Don't fill a section from one example, or from your own preference. An empty section is better than an invented one. Dates are written out (2026-10-14), never "today".

## Taste

What has been asked for, and so what every change must respect.

- **Light, near-white and cool.** Both site references sit on almost-white grounds: `#fafafa` with `#ffffff` blocks, or a warm `#f1f0ec`. Text is near-black. From 6d7b732a, f530271c, c54913ea.
- **Blue is the one colour.** It runs from Midnight Blue `#191970` through Cool Horizon `#58A6FF` to white. The person chose this as "color palette". In c54913ea the same family carries the primary button and the links (`#0f43e7`). From 6d7b732a, c54913ea.
- **Gradients are controlled, not everywhere** (their words). In c54913ea the blue appears in one place per section, as a backdrop behind a product panel. It fades to white at the edges, and the content on top stays on solid white. Never put a gradient behind body text or on every card. From 29d1d2ea, c54913ea.
- **Backgrounds are blurred so the colours blend** (their words). Colour sits in the background as soft, blurred fields: a radial blue wash, or the faint pink and green glows in card corners in c54913ea. It is never a hard-edged shape. From ed323cbb, 6d7b732a, c54913ea.
- **Structure is quiet.** Content sits in 1px hairline grids with large white blocks. Mono is a small accent for numbers, labels and pill tags, never a whole voice. From f530271c, c54913ea.

### Settled: the light theme is the default everywhere (2026-10-30)

The person asked for the light theme as "the default one for everything", in the app and in shadow-web. Light + Horizon is now `DEFAULT_APPEARANCE` in both `shadow-ui/src/theme.js` and `shadow-web/src/lib/appearance.js`. A look saved under the old default moves to the new one once (a `version` field). The dark themes remain as choices. Plus Jakarta Sans replaced Instrument Sans in both. DESIGN.md now describes this.

## Visual system

| Token | Value | From |
| --- | --- | --- |
| ground | `#fafafa` (warm alternative `#f1f0ec`) | c54913ea, f530271c |
| block / card | `#ffffff`, 1px hairline border | c54913ea |
| blue, deep | `#191970` | 6d7b732a (person's palette) |
| blue, light | `#58A6FF` | 6d7b732a (person's palette) |
| blue, action | `#0f43e7` (primary button, link) | c54913ea, sampled |
| gradient | `#191970` → `#58A6FF` → `#ffffff`, radial and soft | 6d7b732a |
| empty-chat texture | `.dot-field`: 1px dots, 22px apart, ink at 18%, fading out from the prompt bar | 2026-10-31, asked for |
| surfaces (light) | bg `#fafafa`, panel `#ffffff`, panel-alt `#f3f4f7`, line `#e6e7eb`, ink `#111318`, muted `#6b7080` | c54913ea, measured |

## Type

- **Plus Jakarta Sans**, by the person's own note (5e31b223), now in `--font-sans` in both apps. It is wider than Instrument Sans: heading tracking tighter than about -0.035em ran letters together ("Tellitwhat.") and was loosened.
- Headlines in the references are large, around 1.1 line height, with tight tracking and normal weight (not bold). A second line or phrase drops to grey ink for contrast (f530271c, "Our smartest models…"; c54913ea headline). Seen in two references, so treat it as a lean, not a rule yet.

## Layout

## Motion

## Copy

## Tried and sent back

- **The blue glow behind the empty chat, and the accent dot above the greeting** (2026-10-31): "remove the gradient and the pill". The board's blurred-gradient lean holds for shadow-web; in the app it was sent back. Replaced by a fading dot grid, which they chose from a list of alternatives.
- **Heavy composer shadow** (2026-10-31): "lighten the shadows of the container". Floating layers in the app now use a shorter, fainter shadow.

## From the board

One line for each thing read: its id, what it is, and what was taken from it.

- `f530271c` - picture, a dev-tool landing page in light warm grey (`#f1f0ec`), why: "design". Taken: near-white ground, hairline structure, a dot-matrix display face kept to the hero, dark pill buttons with an icon tile, grey-to-ink headline contrast.
- `6d7b732a` - picture, a palette card, why: "color palette". Taken: Midnight Blue `#191970` → Cool Horizon `#58A6FF` → White, as a soft radial gradient.
- `c54913ea` - picture, a long SaaS landing page (promptwatch), no note. Taken: `#fafafa` ground, white blocks in a 1px grid, one blue `#0f43e7` for actions and links, a blue gradient used once per section behind a product panel, faint blurred colour glows in card corners, mono for numbers.
- `29d1d2ea` - note: "controlled gradient not everywhere". Became the gradient rule.
- `ed323cbb` - note: "blur effect for background so the colors blend". Became the background blur rule.
- `5e31b223` - note: "Plus Jakarta Sans font". Became the Type line; adopted 2026-10-30.

## Taste log

- 2026-10-30: first board read (6 things). The light, blue, blurred-gradient direction and Plus Jakarta Sans are recorded. The conflict with DESIGN.md's dark phosphor theme is open; nothing in `src/` has changed.
- 2026-10-30: "make the new light theme the default one for everything also change in shadow-web". The light theme with the Horizon accent is now the default in shadow-ui and shadow-web. Plus Jakarta Sans replaced Instrument Sans. One `.glow` appears per screen (the empty chat; the site hero). Shadows, signal and danger colours are set per theme.
- 2026-10-31: "dont just change the colours change the whole design to a modern look, the web first and the landing hero page should look like a very premium world class ai company landing page ykw, add scrolling animations in all of the website". Rebuilt shadow-web: a floating blurred header bar inside hairline page rails, a centred hero with a 7rem medium-weight headline (second line muted), a dark pill button with a blue icon tile, and the product shot as the hero centrepiece on the controlled gradient. Sections are a marquee, a statement that lights up word by word, pinned "how it works" steps, a bento grid, tiers, privacy, and a midnight-blue CTA. Scroll motion: reveal (rise, fade and un-blur, expo ease, 1000ms), word-by-word headlines, scroll-linked tilt on the product shot, and a progress bar. Everything respects reduced motion.
- 2026-10-31: "now do the app". The app got the website's language. The sidebar sits on the page ground, the chat is an inset white card, New chat is a dark pill, the composer is a floating card (22px radius) with a dark round send button, greetings are medium weight and large, and cards, permission prompts and tool rows have softer, rounder shapes.
- 2026-10-31: "remove the gradient and the pill", then "fine dot grid that fades out do that, and make everything in the ui better". The glow and accent dot are gone from the empty chat; a fading dot grid sits behind it instead. Also: chat titles in the sidebar use the full row, messages fade under the header, the settings window has a blurred light backdrop and semibold headings, and the assistant cards line up.
- 2026-10-31: "make a real assistant dashboard that takes up the full screen ... and make the ui of it better". The dashboard now replaces the whole window: a large medium-weight title, cards with a letter avatar, chats and memories as big numbers, the assistant's setup as mono label rows, and a dashed slot for a new one.
