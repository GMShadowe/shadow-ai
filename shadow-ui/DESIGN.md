# Shadow design rules

> The brand guide for every Shadow surface (colours, type, logo, motion,
> voice) is [`../DESIGN.md`](../DESIGN.md). This file covers the app's own
> components.

## Personality
A desktop chat app, done properly: neutral graphite, the platform's own
font, a sidebar of chats, one centred column of conversation, and a rounded
prompt bar. No tint, no gradient, no decoration; detail comes from small,
exact readouts (routes, steps, timers) set quietly in grey. It keeps
Shadow's own name and mark - the look is a convention, not anyone's brand.
Light, Black and Midnight remain choices in Settings → Appearance. The
taste behind this is recorded in `.claude/skills/taste/SKILL.md`.

## Type
- The platform UI face (`--font-sans`: Segoe UI on Windows, SF on macOS) for
  everything, headlines included; the platform mono for code and readouts.
  No web fonts: nothing is downloaded to show text.
- Replies 16px / 28px (`.md`). Your messages 16px / 24px. UI text 14px;
  section labels 12.5-13px in `ink-faint`, sentence case - never mono
  capitals. The empty-chat greeting is 28px regular.
- Inputs are 16px so iOS doesn't zoom. Changing numbers are `tabular-nums`.

## Icons
One family, all inline in `src/components/icons/Icons.tsx` — no icon library.
24x24 viewBox, `fill="none"`, `stroke="currentColor"`, strokeWidth 1.75,
round caps and joins, rendered at 16-20px. Two or three strokes each; where a
dot is needed, a zero-length stroke.

## Color roles
Every value comes from the theme in `src/theme/appearance.ts`; components
never name a hex. Charcoal, the default, is the brand palette: Charcoal
`#292521`, Cream `#F5EDE1`, Blue Regatta `#6F8FE8`. Cream is its light twin.

| Role | Value | Used for |
| --- | --- | --- |
| sidebar | `#211e1b` | the rail and the sidebar |
| bg | `#292521` | the workspace and the inspector |
| panel, composer | `#322d28` / `#2f2a25` | code blocks, cards; the prompt bar |
| bubble / bubble-ink | `#6f8fe8` / `#1b1915` | your messages, charcoal text on Regatta |
| menu | `#35302a` | menus, popovers, dialogs |
| line | cream at 9% | every hairline |
| ink / ink-muted / ink-faint | `#f5ede1` / `#c9c0b3` / `#a49a8d` | text, secondary, labels |
| signal (Blue Regatta) | `#6f8fe8` | the one accent: send, focus, links, meters |
| danger | `#f0705f` | errors, delete, anything leaving the computer |
| ok | `#3ecf8e` | "running locally" dots only |

Type: Geist for the interface, Geist Mono for numbers and readouts, Geist
Serif for display headlines (the empty-chat greeting). Big screens zoom the
whole UI: ×1.1 from 1800px wide, ×1.25 from 2200px, ×1.5 from 3000px.

## Layout
- **Sidebar** (`features/layout/Sidebar.tsx`), one sidebar with two widths.
  Collapsed it is a 56px column: logo (a link to "/"), New chat, Search,
  Voice, Assistants, and the avatar at the bottom. Open it is 260px: the
  same rows with labels, the assistant switcher and the keep-open button in
  the header, chats by day, and a profile row (name, model, local status)
  that opens the profile menu. The button or ⌘/Ctrl B keeps it open or
  closed, and that is remembered. While closed, hovering it (140ms) or
  tabbing into it opens it over the chat; it folds away 260ms after the
  pointer or focus leaves, never while a rename or its menu is open. Icons
  keep the same 40px box and x in both widths; only the words fade. On a
  phone-sized window it always opens over the chat.
- **Workspace**: an inset panel with a hairline and a rounded top-left
  corner. Its top bar holds the chat title (double-click or ⋯ → Rename),
  the ⋯ chat menu, a Files and links popover gathered from the chat's tools
  and replies, and New chat.
- **Conversation**: one 48rem column. Your messages are blue `bubble` pills
  on the right (radius 20px); replies are plain text. On wide windows a
  **scroll map** of ticks runs down the left - long for questions, short for
  replies, lit while on screen - and a tick jumps to its message.
- **Prompt bar** (`features/composer/Composer.tsx`): radius 20px, "Message
  Shadow"; +, Web and Skills on the left; the model and effort picker, the
  mic and the round blue send button (stop while streaming) on the right.
- **Inspector** (`Inspector.tsx`), 300px on the right of a workspace at
  least 1100px wide; a drawer on narrower ones: model and effort, web tools,
  counts, the last reply's route and steps, files and links.
- **Empty chat**: a mono status pill and a 40px serif greeting over a fading
  dot grid; starters as a hairline grid of four cards, a skill under them. **Search chats** (⌘/Ctrl K) is a centred dialog.

## Depth
Flat surfaces, no blur. Menus and dialogs float on `menu` with a hairline and
a soft shadow (`.glass-menu`); the prompt bar has a 7% ink ring that
strengthens to 24% while focused (`.composer-shell`). Backdrops are black at
50%.

## Shape
Radius comes from the appearance setting (sm / md / lg / xl tokens). 36px
controls are 10px; blocks are rounded-2xl; the prompt bar is 20px. Pills
(rounded-full) only for status dots, chips and toggles.

## Motion
- One strong ease-out: `ease-smooth` = cubic-bezier(0.23, 1, 0.32, 1); drawers
  use `ease-drawer` = cubic-bezier(0.32, 0.72, 0, 1). Never ease-in.
- 150ms: hover, press. 200ms: state changes. 280ms: things appearing.
  UI motion stays under 300ms; the headline swap (520ms) and the dock slide
  (420ms) are the deliberate exceptions.
- Press: scale 0.96, `enabled:active:` so a disabled control never moves.
- Name transitioned properties (`transition-[background-color,scale]`), never
  `transition-all`. Animate transform and opacity; bars scale, not resize.
- Anything opened from the keyboard appears without animation (⌘K History).
- Icon state swaps (copy → copied) cross-fade both icons with scale 0.25 → 1
  and a 4px blur, over 300ms.
- The empty chat enters in steps 100ms apart (`.stage`), once per new chat.
- Reduced motion: movement goes, opacity stays.

The vocabulary is `animate-rise`, `animate-fade`, `animate-pop` and their
reverse, `animate-pop-out` / `animate-fade-out`, plus the named effects in
`src/styles/effects.css`. Popovers, menus and the settings window stay
mounted for their closing animation - `hooks/useExit.ts` is the one way.

Two more rules that are easy to miss:
- **Nothing says it is loading for the first quarter second.** `wait-to-show`
  delays a waiting state by 250ms.
- **Moving an element means animating it, not remounting it.** The prompt bar
  lives in one place in the tree and is never rebuilt; an empty chat just
  keeps more room under it (`.dock`), so the first message slides it down.

## Detailed components

Detail means a component carries the information its state already has,
shown small and exact, not more decoration. Each of these is a readout:

- **Route badge** (`chat/components/RouteBadge.tsx`): route icon, name and a
  24px confidence meter; it opens a readout of every route's score, the
  router method and its time. Opens upward when the reply sits low.
- **Thinking readout** (`ThinkingIndicator.tsx`): a mono braille spinner, the
  phase ("Routing", "Thinking", "Reading the results") and an elapsed clock in
  tabular figures, so a slow local model visibly hasn't hung.
- **Tool timeline** (`ToolCall.tsx` in an `<ol>` with a hairline rail): a node
  per step (spinner → tick or cross), the step number, the tool and its
  arguments, a live duration measured in the page, and a header with the
  effort budget as pips (`3/6`). Durations are not invented for reopened chats.
- **Permission card**: the brain's five-minute timeout as "skips in 4:52" and
  a hairline that drains, linear, because it is a timer.
- **Prompt bar**: one round button changes job (voice, send, stop) with an
  icon cross-fade. Long text shows its length.
- **Run picker**: models with their Ollama id, "sees images", and local or the
  host they send to; effort as five bars sized by each level's step budget.
- **Code blocks**: a rounded dark block; the language and Wrap / Copy sit in
  a header that sticks while a long block scrolls past.
- **Search chats**: day groups with counts, matched words marked in results.
- **Tooltips** (`components/ui/Tooltip.tsx`) name icon buttons with their
  shortcut: 400ms the first time, then instant for neighbours for 600ms.
- **Back to latest**: scrolled up, a pill offers the way down and says when a
  reply grew below.

Menus and dialogs use `.glass-menu`: solid `menu`, a hairline, a soft shadow.

## Interaction states
Every interactive element needs: hover, focus-visible ring (signal),
active/press, and disabled (40% opacity, no hover effect). A disabled
control also drops its hover and press rules, or it still feels alive.

Focus, in three rules:
- **The default ring lives in `@layer base`** (`styles/index.css`). It used to be
  unlayered, and unlayered CSS beats every Tailwind utility, so each text
  field's `focus:outline-none` was ignored and the prompt bar drew a square
  ring inside its rounded card. Text fields show focus with their own
  border (`focus:border-signal`); the prompt bar with its card border.
- **Rings follow shape.** A control's ring takes its border-radius, so a
  focusable element inside a rounded row is itself rounded. In a list that
  scrolls (History chats, the settings sections) the ring is inset
  (`focus-visible:outline-offset-[-2px]`), or the scroll box clips it.
- **Dialogs hold focus.** `hooks/useFocusTrap.ts`: focus moves in on open (to
  `data-autofocus`, else the dialog), Tab cycles inside, and focus goes back
  where it was on close. The settings window and the lightbox use it.

An image in a sent message is interactive: it opens full size in a dark
overlay (`components/ui/Lightbox.tsx`, escape or a click outside closes it). Clicking
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

## Display cards
Lists, charts and pictures Shadow was asked for (`features/display/cards/`): one shell
(`Frame.tsx`) - a panel block, hairline border, rounded-2xl, an icon and a
semibold title, a mono count, and a copy button that copies the card as
text. List rows are numbered in mono and arrive one after another. Charts
are ink, never accent: horizontal bars for comparing, an SVG line for change
over time that draws itself once (`.chart-draw`). End labels lean inward and
a low point's label sits under it, so nothing is clipped or crossed by the
line. Pictures sit in a grid with no hole in it, and open in the lightbox.

## Voice screen
The middle is for a card; without one, the exchange takes it, large. The
control is an orb: ink when idle, accent while listening with a ring that
follows the input level, a circling ring while working, a breathing ring
while Shadow answers. Space talks. A first visit shows three spoken-style
suggestions. The stage fades at its edges instead of being cut.

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
The assistant dashboard is a full screen of its own, not a view inside the
chat card: it is about every assistant, so it doesn't sit inside one of them
with its chats down the side. Escape or "Back to chat" leaves it; switching
or creating an assistant goes straight into its chat. A delete confirmation
covers the card it is about rather than appearing above the grid.

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
