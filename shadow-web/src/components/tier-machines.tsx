import { Box, iso, path, pts } from "./iso";


const TIERS = [
  { id: "default", name: "Default", model: "qwen3.5:4b", ram: "8 GB RAM", x: 0, w: 1.5, h: 1.2 },
  { id: "plus", name: "Plus", model: "qwen3.5:9b", ram: "16 GB RAM", x: 2.8, w: 1.9, h: 1.8 },
  { id: "primal", name: "Primal", model: "gemma4:12b", ram: "16 GB RAM", x: 6, w: 2.3, h: 2.6 },
];

function Machine({ x, w, h }: { x: number; w: number; h: number }) {
  const y = 0.6, d = w;
  const fx = x + w;
  return (
    <>
      <Box x={x} y={y} w={w} d={d} h={h} />
      <polygon className="screen" points={pts(iso(fx, y + 0.25, h * 0.45), iso(fx, y + d - 0.25, h * 0.45), iso(fx, y + d - 0.25, h * 0.85), iso(fx, y + 0.25, h * 0.85))} />
      {[0.2, 0.32, 0.44].map((t) => (
        <path key={t} className="ink" d={path(iso(x + 0.25, y + d, h * t), iso(x + w - 0.25, y + d, h * t))} />
      ))}
      {[x + 0.15, x + w - 0.35].map((fxx) => (
        <path key={fxx} className="ink" d={path(iso(fxx, y + d, 0), iso(fxx + 0.2, y + d, 0))} />
      ))}
    </>
  );
}

export function TierMachines() {
  return (
    <svg viewBox="-190 -60 560 420" className="fig h-auto w-full" role="img"
      aria-label="Three machines of growing size: Default runs qwen3.5:4b on 8 GB of RAM, Plus runs qwen3.5:9b on 16 GB, Primal runs gemma4:12b on 16 GB.">
      <Box x={-1} y={-0.6} z={-0.3} w={10.6} d={4.4} h={0.3} className="slab" />
      <g className="grid">
        {Array.from({ length: 10 }, (_, i) => <path key={`x${i}`} d={path(iso(i, -0.6), iso(i, 3.8))} />)}
        {Array.from({ length: 4 }, (_, i) => <path key={`y${i}`} d={path(iso(-1, i + 0.4), iso(9.6, i + 0.4))} />)}
      </g>
      {TIERS.map((t) => (
        <g key={t.id} className={`part p-${t.id}`}>
          <Machine x={t.x} w={t.w} h={t.h} />
        </g>
      ))}
      <g className="callouts tier-callouts">
        {TIERS.map((t, i) => {
          const a = iso(t.x + t.w / 2, 0.6 + t.w, 0);
          const ly = [330, 292, 254][i];
          return (
            <g key={t.id} className={`callout c-${t.id}`}>
              <path className="leader" pathLength={1} data-draw={i * 0.15} d={path(a, [a[0], ly], [a[0] + 124, ly])} />
              <rect className="tick" x={a[0] - 2.5} y={a[1] - 2.5} width="5" height="5" />
              <text className="t1" x={a[0] + 5} y={ly - 6}>{t.name}</text>
              <text className="t2" x={a[0] + 5} y={ly + 14}>{t.model} · {t.ram}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
