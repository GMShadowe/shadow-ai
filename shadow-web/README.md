# shadow-web

Shadow's landing page. Next.js (App Router), Tailwind 4, shadcn/ui, three.js
via @react-three/fiber, and GSAP.

Colours, type and voice follow [`../DESIGN.md`](../DESIGN.md), on its Cream
theme. Fonts are self-hosted in `src/app/fonts/`.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # the page is fully prerendered
```

The WebGL scenes pause when off-screen, and with reduced motion turned on
they draw one still frame.
