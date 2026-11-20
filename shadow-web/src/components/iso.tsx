
const U = 34;
export const C = 0.866 * U;
export const S = 0.5 * U;
const H = 0.82 * U;

export type P = [number, number];
export const iso = (x: number, y: number, z = 0): P => [(x - y) * C, (x + y) * S - z * H];
export const pts = (...p: P[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
export const path = (...p: P[]) => "M" + p.map(([a, b]) => `${a.toFixed(1)} ${b.toFixed(1)}`).join(" L");

export function Box({ x, y, z = 0, w, d, h, className }: {
  x: number; y: number; z?: number; w: number; d: number; h: number; className?: string;
}) {
  const t = z + h;
  return (
    <g className={className}>
      <polygon className="face left" points={pts(iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, t), iso(x, y + d, t))} />
      <polygon className="face right" points={pts(iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, t), iso(x + w, y, t))} />
      <polygon className="face top" points={pts(iso(x, y, t), iso(x + w, y, t), iso(x + w, y + d, t), iso(x, y + d, t))} />
    </g>
  );
}

