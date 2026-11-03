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

### Settled palette: Charcoal, Cream, Blue Regatta (2026-11-02, newest)

The person shared a brand-book palette card: "use this color palette". Blue Regatta `#6F8FE8`, Charcoal `#292521`, Cream `#F5EDE1`, with a pale `#B4C6F0` in its wave artwork. Charcoal is now the default theme (charcoal ground, cream ink, Blue Regatta as the one colour: your message bubbles with charcoal text, the send key, focus, meters); Cream is the light version. Midnight stays as a choice. This replaces the Midnight/Horizon colours below; the layout and type rules there still hold.

### Settled layout: Shadow's own workspace, from the board (2026-11-02, latest)

"dont make it look entirely like chatgpt, rn it looks copy, also looking bad on my big monitor". Kept the rail + sidebar + inset workspace, but the identity now comes from the board: Midnight theme (`#0c0e13` rail, `#11141b` workspace, `#171b24` cards, blue-cast hairlines, Horizon `#58A6FF` as the one accent), Geist / Geist Mono / Geist Serif, a serif 40px greeting under a mono status pill, the fading dot grid, starters as a hairline card grid (not pills), a 16px-radius prompt bar with a Horizon focus halo and a 10px-radius send key, and an Inspector column on wide windows. Big screens zoom the whole UI (1.1 / 1.25 / 1.5 at 1800 / 2200 / 3000px wide).

### Earlier: a desktop workspace, rail + sidebar + inset panel (2026-11-02, later)

From three screenshots of a desktop coding-agent app, "but dont make it entirely copied make sure it feels smooth". Always-on 52px rail, a 260px sidebar that slides out from behind it, an inset workspace panel with one rounded corner, chat title and ⋯ menu top-left, model picker inside a 20px-radius prompt bar, deep-blue user bubbles (`#1d3b66`) as the one colour, a scroll map of ticks. Palette: `#161616` rail/sidebar, `#1c1c1c` workspace, `#262626` prompt bar and code cards, `#2a2a2a` menus. Smoothness matters to this person: motion on every open/close that isn't keyboard-driven.

### Earlier: a desktop-chat look, neutral graphite (2026-11-02)

The person asked: "make ui like chatgpt desktop app, very detailed ui and colors 1:1". The app now follows that convention, under Shadow's own name and mark: Graphite theme (`#212121` canvas, `#181818` sidebar, `#303030` prompt bar and user messages, `#353535` menus, white-10% hairlines, ink `#ececec` / `#b4b4b4` / `#8f8f8f`), the platform UI font, a 260px sidebar of chats that closes to a 52px rail, the model selector top-left, a 28px-radius prompt bar with one round ink button (voice / send / stop), replies as plain 16/28 text, starter pills with one tone each. The ASCII field, the cycling serif headline, the gradient word and Geist were removed; the detailed readouts (route badge, step timeline, timers) stay, set quietly in grey. DESIGN.md describes the result.

### Earlier: the app was dark Abyss after a video reference (2026-11-01)

The person asked for the chat UI to look like a reference video (MarceloDesignX, an AI chat home): "make chat ui like this". The app's default is now **Abyss**, a near-black theme (`#090b0f` ground, `#0e1116` panels, `#1d222a` hairlines, `#e8eaed` ink), with the **Tide** accent (`#8fe3cf`). Light stays a choice in Settings → Appearance, and the light rules below still hold for it and for shadow-web. What the reference brought, and the app now does:

- a slim icon rail on the left, the chat list moved into a History drawer opened from a top-right "History Ctrl K" button;
- an empty chat with drifting ASCII figures over a faint 18px grid (`features/home/AsciiField.tsx`), quiet behind the text;
- a small mono status line with a live dot ("● Good evening"), then a large headline that cycles through the greetings, its last word in the one gradient (teal `#8fe3cf` → lavender `#b9a4ff`);
- a glass prompt bar (blurred, 1px light hairline) with +, the model pill, a web toggle, voice, and mono key hints;
- mono suggestion chips under it.

### Earlier: the light theme was the default everywhere (2026-10-30)

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

- **Geist Serif** for display headlines only (empty-chat headline, voice, onboarding, dashboard titles), by the person's note (b91cc47f): "use new vercel serif font". Weight 400, tracking -0.02em, line height 1.1. Body and UI text stay sans; the serif is never used below about 28px. Self-hosted from `src/assets/fonts/` with Geist and Geist Mono, which replaced Plus Jakarta Sans and IBM Plex Mono in the app on 2026-11-01.
- **Plus Jakarta Sans**, by the person's own note (5e31b223), now in `--font-sans` in both apps. It is wider than Instrument Sans: heading tracking tighter than about -0.035em ran letters together ("Tellitwhat.") and was loosened.
- Headlines in the references are large, around 1.1 line height, with tight tracking and normal weight (not bold). A second line or phrase drops to grey ink for contrast (f530271c, "Our smartest models…"; c54913ea headline). Seen in two references, so treat it as a lean, not a rule yet.

## Layout

## Motion

- **Detailed micro interactions, everywhere they help** (d82c1f20): "clean ui and detailed ui with detailed micro ui components and micro animations very detaild". Read with the motion skills: press scales to 0.96 (never when disabled), one strong ease-out `cubic-bezier(0.23, 1, 0.32, 1)`, icons cross-fade with blur on state changes (copy → copied), the empty chat enters in 100ms-staggered steps, keyboard-opened panels appear instantly, and reduced motion keeps opacity only.

## Copy

## Tried and sent back

- **Shadow and halo around the prompt bar** (2026-11-02): "remove bg shadows". The bar sits flat; focus is shown by its border only.

- **The blue glow behind the empty chat, and the accent dot above the greeting** (2026-10-31): "remove the gradient and the pill". The board's blurred-gradient lean holds for shadow-web; in the app it was sent back. Replaced by a fading dot grid, which they chose from a list of alternatives.
- **Heavy composer shadow** (2026-10-31): "lighten the shadows of the container". Floating layers in the app now use a shorter, fainter shadow.

## From the board

One line for each thing read: its id, what it is, and what was taken from it.

- `b91cc47f` - note: "use new vercel serif font , https://vercel.com/font?type=serif". The page names it Geist Serif, "a high-contrast display serif"; Regular is the variant for primary type. Became the display-headline rule in Type.
- `d82c1f20` - note: "clean ui and detailed ui with detailed micro ui components and micro animations very detaild". Became the micro-interaction rule in Motion.

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
- 2026-11-01: "update frontend to latest standards of vite and use tsx and ts ... and make chat ui like this" (a reference video), then "i added some skills, use all them and make ui better". The app moved to TypeScript and a feature-based layout, and took the reference's look: dark Abyss theme by default, icon rail, History drawer, ASCII field, cycling headline with one gradient word, glass prompt bar. This brings back a gradient and a status dot on the empty chat, both sent back on 2026-10-31; the person asked for them by reference this time, so the reference wins, and only one gradient (the headline word) and one live dot are used.
- 2026-11-01: second board read, after "for this project install and run this skill" (Build Taste). Two new notes: Geist Serif for headlines, and detailed micro UI. Geist Serif now sets the display headlines, self-hosted.
- 2026-11-02: "follow build taste skill and redo ui using skills i have added, every ui component should be very detailed like and some creative components". Read d82c1f20 ("detailed micro ui components and micro animations") as detail that carries information: a route badge with a confidence meter and a router readout, a thinking readout with a braille spinner and elapsed clock, a tool timeline with step numbers, durations and effort pips, a permission countdown, effort as bars sized by step budget, code blocks with a gutter and wrap toggle, tooltips with shortcuts, a back-to-latest pill, highlighted search matches, and an ASCII field that leans away from the pointer. Motion stayed on the motion skills' gate: keyboard-opened panels and row hovers don't animate; the one gradient stays the headline word (the chosen effort bar was made solid accent to keep it so). Popovers over text were too see-through in glass and now use a near-solid `.glass-menu`.
- 2026-11-02: "make ui like chatgpt desktop app, very detailed ui and colors 1:1". Rebuilt the shell on the desktop-chat convention (see Settled above). Supersedes the Abyss/ASCII direction of 2026-11-01 and the Geist Serif headline from b91cc47f; the person's latest request wins. Mono capitals for labels were replaced with sentence-case grey, which is what that convention uses.
- 2026-11-02: shared three screenshots of a desktop coding-agent app and asked "make like [that] desktop app, but dont make it entirely copied make sure it feels smooth". Kept: an always-on icon rail beside a sliding sidebar, an inset workspace panel, title + ⋯ menu top bar, model picker inside the prompt bar, blue user bubbles, a scroll map of ticks, a profile menu on the avatar. Made our own: Shadow's palette and name, a status card instead of onboarding, a Files and links list from real tool calls. "Smooth" read as: sidebar unfolds (280ms drawer curve, instant from the keyboard), menus scale from their trigger, chats cross-fade on switch.
- 2026-11-02: "dont make it look entirely like chatgpt, rn it looks copy, also looking bad on my big monitor, rebuild and test use every feature in browser". Rebuilt the identity from the board (see Settled), added big-screen zoom and the Inspector, made the sidebar an overlay on phone widths, and gave voice mode an Escape exit. Every feature was driven in headless Edge at 1920, 2560, 1100 and 390px.
- 2026-11-02: "use this color palette" (Blue Regatta #6F8FE8, Charcoal #292521, Cream #F5EDE1). Charcoal is the default theme and Cream the light one; contrast measured (cream on charcoal 13.1:1, Regatta on charcoal 4.9:1, charcoal text on Regatta bubbles 5.7:1).
- 2026-11-02: "fix this also make it little creative and fun design and ux, remove bg shadows, also make logo clickable and redirect to /, also make this component in our theme". The model/effort picker no longer runs off-screen (opens down when there's no room above, capped to the space) and became playful: radios that turn into the brand sparkle, effort as a dial with a sliding Blue Regatta thumb and a mood line ("Leaves no stone unturned"). The prompt bar lost its shadow and halo (flat, border turns Regatta on focus) - **no shadows or glows behind the prompt bar**. The logo is a link to "/" (fresh chat). Starters became four brand cards copied from the brand book's palette cards: Blue Regatta, Charcoal, Cream, pale wave blue `#B4C6F0`; hover lifts 3px and spins a sparkle in.
- 2026-11-02: "when its on ultra, make it do some crazy" - Ultra fires a sparkle burst and shockwave out of the dial thumb, jolts the dial, and shimmers while chosen. The person likes playful delight on rare, deliberate choices.
- 2026-11-02: "when we click on this show options like image video, deep search, and more" - the + opens a menu (Photos, Deep search, Use a skill, Voice mode; Create image / Create video listed as "soon" since no model can make them).
- 2026-11-02: "instead of 2 sidebars keep one, make it look nice collapsed and opened also open on hover and close when not active, keep open/closed when done via button". One sidebar: 56px icons collapsed, 260px open; hover/focus peeks over the chat and folds away on leave; the header button (or Ctrl+B) keeps it open or closed, remembered.
