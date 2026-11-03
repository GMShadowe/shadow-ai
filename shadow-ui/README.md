# shadow-ui

Shadow's frontend: React 19, TypeScript 7, Vite 8, Tailwind 4. It talks to the
brain (`../shadow-brain`) through this dev server's `/api` proxy, which
attaches the access token so the browser never holds it (see `vite.config.ts`).

```bash
npm install
npm run dev        # http://localhost:5173 (start the brain on :8765 first)
npm run typecheck  # tsc -b, strict
npm run lint       # oxlint
npm run build      # typecheck + production build
```

## Layout

```
src/
  main.tsx                 entry: applies the saved theme, mounts <App/>
  app/
    App.tsx                the shell: rail, chat, drawers, lazy screens
    hooks/                 app state, one concern each
      useBrain.ts            status polling, auth vs offline, offline mode
      useConversations.ts    chat list, open chat, rename / delete / export
      useChatRunner.ts       send, regenerate, edit, stop, rate (streaming)
      useGreetings.ts, useSkills.ts
  features/                one folder per part of the product
    chat/                  message list, message, actions, tool rows,
                           permission cards; lib/conversation.ts holds the
                           pure stream-event reducer and helpers
    composer/              prompt bar, model/effort picker, slash menu
    home/                  empty chat: greeting and starter pills
    layout/                sidebar, collapsed rail, top bar, search dialog
    markdown/              reply rendering: code, tables, link cards, file chips
    display/               list / chart / image cards drawn from tool data
    settings/              settings window and its controls
    onboarding/            first run, assistant dashboard, model downloads
    voice/                 voice screen and the microphone recorder
  components/
    icons/                 the one icon family (inline SVG)
    ui/                    small shared primitives (IconButton, Kbd, Lightbox…)
  hooks/                   generic hooks (useExit, useFocusTrap, useDismiss…)
  lib/
    api/                   typed brain client, split by domain
    format.ts, images.ts, prefs.ts
  theme/appearance.ts      themes, accents, applying the appearance
  styles/                  Tailwind entry + tokens, effects, markdown
  types/                   shapes shared across features
```

Imports from the source root use `@/` (`@/lib/api`, `@/features/home`).
Features talk to each other through their own files or a feature's
`index.ts`; nothing reaches into another feature's internals for state.

Design rules are in [DESIGN.md](DESIGN.md); the person's taste, which those
rules come from, is in `.claude/skills/taste/SKILL.md`.
