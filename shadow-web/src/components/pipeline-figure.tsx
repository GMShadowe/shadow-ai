import type { CSSProperties } from "react";


import { Box, C, S, iso, path, type P } from "./iso";

type Callout = { id: string; a: P; e: P; f: P; title: string; sub: string; d: number };

const ADAPTERS = ["coding", "files", "research", "health", "system"];

const CALLOUTS: Callout[] = [
  { id: "message", a: iso(1.8, 3.4, 0.15), e: [-150, 30], f: [-322, 30], title: "Your message", sub: "typed or spoken", d: 0 },
  { id: "router", a: iso(4.4, 3.4, 1.4), e: [29, -28], f: [200, -28], title: "Laya router", sub: "picks the help you need", d: 120 },
  { id: "adapters", a: iso(6.9, 1.45, 0.9), e: [250, 52], f: [470, 52], title: "Five adapters", sub: "coding, files, research, health, system", d: 240 },
  { id: "model", a: iso(9.7, 3.4, 2.2), e: [300, 158], f: [470, 158], title: "Local model", sub: "runs through Ollama", d: 360 },
  { id: "memory", a: iso(9.8, 5.9, 0.78), e: [260, 300], f: [470, 300], title: "Chats and memory", sub: "SQLite, in your folder", d: 480 },
  { id: "computer", a: iso(2, 7, -0.25), e: [-190, 262], f: [-322, 262], title: "Your computer", sub: "all of it runs here", d: 600 },
];

const ROUTE = path(iso(1.8, 3.4), iso(4.4, 3.4), iso(6.9, 3.4), iso(9.7, 3.4), iso(9.8, 5.9));

export function PipelineFigure() {
  const [mx, my] = iso(3.6, 2.6, 1.4);
  const k = 1.6 / 24;

  return (
    <svg viewBox="-335 -70 820 430" className="fig h-auto w-full" role="img"
      aria-label="Shadow's pipeline on your computer: your message goes to the Laya router, which picks one of five adapters (coding, files, research, health, system), which work with the local model running through Ollama. Chats and memory are kept in SQLite.">
      <Box x={0} y={0} z={-0.5} w={12} d={7} h={0.5} className="slab" />
      <g className="grid">
        {Array.from({ length: 11 }, (_, i) => <path key={`x${i}`} d={path(iso(i + 1, 0), iso(i + 1, 7))} />)}
        {Array.from({ length: 6 }, (_, i) => <path key={`y${i}`} d={path(iso(0, i + 1), iso(12, i + 1))} />)}
      </g>

      <path className="route" d={ROUTE} />
      <circle className="pulse" r="3.5">
        <animateMotion dur="5s" repeatCount="indefinite" path={ROUTE} />
      </circle>

      {/* Back to front, so nearer parts cover farther ones */}
      <g className="part p-router">
        <Box x={3.6} y={2.6} w={1.6} d={1.6} h={1.4} />
        <g transform={`matrix(${C * k} ${S * k} ${-C * k} ${S * k} ${mx} ${my})`} className="mark">
          <circle cx="10" cy="10" r="5.5" />
          <path d="M17.6 8.6a5.5 5.5 0 0 1-9 9" opacity="0.55" />
        </g>
      </g>

      {ADAPTERS.map((name, i) => (
        <g key={name} className="part cue p-adapters" style={{ "--d": `${i * 2}s` } as CSSProperties}>
          <title>{name}</title>
          <Box x={6.4} y={1 + i * 1.1} w={1} d={0.9} h={0.9} />
        </g>
      ))}

      <g className="part p-message">
        <Box x={1} y={2.6} w={1.6} d={1.6} h={0.15} />
        {[0.5, 0.9, 1.3].map((t, i) => (
          <path key={t} className="ink" d={path(iso(1.25, 2.6 + t, 0.15), iso(i === 2 ? 1.9 : 2.35, 2.6 + t, 0.15))} />
        ))}
      </g>

      <g className="part p-model">
        <Box x={8.8} y={2.4} w={1.8} d={2} h={2.2} />
        {[0.5, 0.8, 1.1, 1.4].map((t) => (
          <path key={t} className="ink" d={path(iso(10.6, 2.8, t + 0.2), iso(10.6, 4.0, t + 0.2))} />
        ))}
      </g>

      <g className="part p-memory">
        {[0, 1, 2].map((i) => (
          <Box key={i} x={9} y={5.2} z={i * 0.3} w={1.6} d={1.4} h={0.18} />
        ))}
      </g>

      <g className="callouts">
        {CALLOUTS.map(({ id, a, e, f, title, sub, d }) => {
          const right = f[0] > e[0];
          const tx = e[0] + (right ? 2 : -2);
          return (
            <g key={id} className={`callout c-${id}`} style={{ "--d": `${d}ms` } as CSSProperties}>
              <path className="leader" pathLength={1} data-draw={d / 1000} d={path(a, e, f)} />
              <rect className="tick" x={a[0] - 2.5} y={a[1] - 2.5} width="5" height="5" />
              <text className="t1" x={tx} y={e[1] - 7} textAnchor={right ? "start" : "end"}>{title}</text>
              <text className="t2" x={tx} y={e[1] + 14} textAnchor={right ? "start" : "end"}>{sub}</text>
            </g>
          );
        })}
      </g>

      <g className="cross">
        {([[-325, -60], [475, -60], [-325, 350], [475, 350]] as P[]).map(([x, y]) => (
          <path key={`${x}${y}`} d={`M${x - 6} ${y}h12M${x} ${y - 6}v12`} />
        ))}
      </g>
    </svg>
  );
}
