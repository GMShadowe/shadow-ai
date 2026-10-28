# Shadow design rules

## Personality
Quiet instrument: calm, precise, local. Terminal heritage shows in small
mono details (metadata, tools, code), never everywhere.

## Type
- Instrument Sans for all reading text. IBM Plex Mono for metadata, tool
  rows and code. Both load from Google Fonts in index.html; the families
  themselves live in the `--font-sans` / `--font-mono` tokens, so nothing
  names a typeface directly.
- Message body 15px / 1.7. UI text 13-14px. Metadata 11px mono.
- Headings: weight 600, tight tracking. Never more than 3 sizes on one screen.

## Icons
One family, all inline in `src/components/Icons.jsx` — no icon library.
Every icon: 24x24 viewBox, `fill="none"`, `stroke="currentColor"`,
strokeWidth 2, round caps and joins, rendered at 15-16px.
- Two or three strokes each. A few clean strokes beat a detailed glyph at
  15px, which is the only size that matters.
- No filled shapes: a filled dot or square reads heavier than the strokes
  beside it. Where a dot is needed, draw a zero-length stroke (`M12 8h.01`)
  so it carries the same weight as everything else.
- A set that needs its own stroke weight or optical size is a set that will
  look borrowed. The settings nav once had both, and did.

## Color roles
- bg / panel / panel-alt: surfaces, darkest to lightest.
- line: all borders and dividers (1px).
- ink / ink-muted: primary and secondary text.
- phosphor (accent): primary actions, active states, live status ONLY.
- signal (blue): keyboard focus and in-progress states.
- danger (red): errors and destructive actions ONLY.

## Depth
Flat surfaces separated by 1px lines. Shadows only on floating layers:
the prompt bar, menus and popovers, the settings window.

## Shape
Radius comes from the appearance setting (sm / md / lg / xl tokens).
Pills (rounded-full) only for status dots, send/stop buttons and toggles.

## Motion
- One easing curve: ease-smooth (cubic-bezier(0.2, 0.8, 0.2, 1)).
- 150ms: hover, press. 200ms: state changes. 280ms: things appearing.
- Enter = fade + 6px rise. Popovers = fade + scale from 0.96. Nothing bounces.
- Press feedback: scale 0.95-0.97.
- Always respect prefers-reduced-motion.

The whole vocabulary is four animations in `index.css` and nothing else:
`animate-rise`, `animate-fade`, `animate-pop` and their reverse,
`animate-pop-out` / `animate-fade-out`, at 150ms. A floating layer that
opens over 200ms and then vanishes between two frames reads as a glitch,
so popovers, menus and the settings window stay mounted for their closing
animation - `ui/useExit.js` is the one way that is done.

Two more rules that are easy to miss:
- **Nothing says it is loading for the first quarter second.** `wait-to-show`
  delays a waiting state by 250ms, so a chat that opens quickly or a search
  that answers immediately never flashes a word. Use it on anything that is
  usually fast.
- **Moving an element means animating it, not remounting it.** The prompt bar
  lives in one place in the tree and is never rebuilt; an empty chat just
  keeps more room under it (`.dock`), so the first message slides it down.
  It used to be rendered in two different parents, which remounted it and
  dropped focus and any attached images.

## Interaction states
Every interactive element needs: hover, focus-visible ring (signal),
active/press, and disabled (40% opacity, no hover effect). A disabled
control also drops its hover and press rules, or it still feels alive.

An image in a sent message is interactive: it opens full size in a dark
overlay (`ui/Lightbox.jsx`, escape or a click outside closes it). Clicking
one used to do nothing, which read as broken rather than restrained.

Rhythm in the message list follows the conversation instead of repeating one
gap: a reply sits 20px under its question, the next question 36px under the
reply. Settings rows highlight under the pointer only when there is
something in them to change.

## Composer
The prompt bar is a floating layer that acknowledges everything done to it:
the border takes signal on focus, phosphor while a drop is in progress, and
the same phosphor for a moment when an image arrives by paste or file dialog
(a paste has no gesture of its own, so the bar provides one). Send and stop
are one control that changes job, so the swap pops rather than cutting.
Things attached to it follow it:
the slash menu is a popover above it (shadow, fade + scale), and a chosen
skill sits inside it as a mono chip with a way to remove it. Accent on the
chip only because it is live state for the next message, never decoration.

## Message actions
The row under a reply stays hidden until the message is hovered — or until
it has been rated, which keeps the thumb visible as state rather than as a
control. 11px, icon plus word. Accent for a like, danger for a dislike,
and nothing else in the row is coloured. The dislike reason panel is a
floating layer (shadow, fade + rise), always skippable.

## Rich elements in replies
Inferred from content, never from model syntax, and every one degrades to
plain text. Cards and chips use `line` borders on `panel`, not shadows -
they sit in the message, they don't float above it. A card that couldn't
be fetched becomes a plain styled link; it never shows an empty frame.

## Progress
Two shapes, both phosphor, neither invented per screen:
- **Steps** (onboarding): a row of flat segments, `bg-phosphor` up to and
  including the current step, `bg-line` after. No numbers, no labels - the
  dots say where you are without asking to be read.
- **A download**: a 1px bar, `bg-phosphor` filling left to right over
  `transition-[width]`. Real percentage when there's a byte count to show
  one; while there isn't (resolving a manifest, waiting on the first chunk)
  it's a dim pulsing fill, never an invented number that would have to jump
  back. A finished step turns the bar `bg-phosphor/30` and stays - it
  doesn't vanish, so the row above it reads as history, not as a flash.

## Cards and empty slots
A dashboard of cards (`line` border, `panel` background, same as any other
card) gets one more tile when it has room to grow: a dashed `line` border,
no fill, a plus and a short label. Dashed means "not yet a thing" - a slot,
not a card with nothing in it. At the limit the slot stays but says why
instead of disappearing, so the ceiling is a fact on screen, not a control
that quietly stopped working.

## Live counters
A running number shown beside a status pill - tokens spent, anything else
that changes while you watch - is mono, 11px, in an `ink-muted` pill with a
plain `line` border: a fact, not a warning. It sits next to, never inside,
a danger-colored pill that means something is actually leaving the computer
or actually wrong. Giving a live count the same red as "this is bad" makes
every number look like an alarm.

## Writing
Sentence case everywhere. Plain words. Errors say what happened and
what to do next.
