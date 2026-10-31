import { useEffect, useState } from "react";
import { ChartIcon } from "../../Icons.jsx";
import Frame from "./Frame.jsx";

/* Numbers the model passed as data, drawn two ways: bars to compare
   things, a line for change over time. Ink, not accent - the accent is for
   live state. The bars grow in once on arrival. */

function format(value, unit) {
  const n = Math.abs(value) >= 1000 ? Math.round(value).toLocaleString() : String(+value.toFixed(2));
  if (!unit) return n;
  return unit === "%" ? `${n}%` : `${n} ${unit}`;
}

function Bars({ points, unit }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const max = Math.max(...points.map((p) => Math.abs(p.value)), 1e-9);

  return (
    <div className="space-y-2.5 px-5 py-4">
      {points.map((p, i) => (
        <div key={`${p.label}-${i}`} className="grid grid-cols-[minmax(4rem,9rem)_1fr_auto] items-center gap-3">
          <span className="truncate text-[13px] text-ink-muted" title={p.label}>{p.label}</span>
          <div className="h-6 min-w-0 overflow-hidden rounded-md bg-panel-alt">
            <div
              className="h-full rounded-md bg-ink/85 transition-[width] duration-700 ease-smooth"
              style={{ width: grown ? `${Math.max((Math.abs(p.value) / max) * 100, 1.5)}%` : "0%", transitionDelay: `${i * 40}ms` }}
            />
          </div>
          <span className="min-w-[3.5rem] text-right font-mono text-[12px] tabular-nums text-ink">{format(p.value, unit)}</span>
        </div>
      ))}
    </div>
  );
}

function Line({ points, unit }) {
  const W = 640, H = 240, padX = 36, top = 28, bottom = 34;
  const values = points.map((p) => p.value);
  let lo = Math.min(...values), hi = Math.max(...values);
  // Keep zero in view when it's close, so a small change doesn't look huge.
  if (lo >= 0 && lo < hi * 0.5) lo = 0;
  const span = hi - lo || Math.abs(hi) || 1;
  lo -= span * 0.12;
  hi += span * 0.12;
  const x = (i) => padX + (points.length === 1 ? (W - padX * 2) / 2 : (i * (W - padX * 2)) / (points.length - 1));
  const y = (v) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bottom);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H - bottom} L${x(0).toFixed(1)},${H - bottom} Z`;
  const labelEvery = Math.ceil(points.length / 8);
  // A low point's label goes under it: above, the line climbing out of it runs through the text.
  const dip = (i) =>
    (i === 0 || points[i - 1].value > points[i].value) && (i === points.length - 1 || points[i + 1].value > points[i].value);
  // The first and last labels lean inward, or the card's edge cuts them off.
  const anchor = (i) => (points.length > 1 && i === 0 ? "start" : points.length > 1 && i === points.length - 1 ? "end" : "middle");

  return (
    <div className="px-3 pb-2 pt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Line chart">
        {[0, 1, 2, 3].map((g) => {
          const gy = top + (g * (H - top - bottom)) / 3;
          return <line key={g} x1={padX} x2={W - padX} y1={gy} y2={gy} stroke="var(--color-line)" strokeWidth="1" />;
        })}
        <path d={area} fill="var(--color-ink)" opacity="0.05" />
        <path d={line} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="chart-draw" pathLength="1" />
        {points.map((p, i) => (
          <g key={`${p.label}-${i}`}>
            <circle cx={x(i)} cy={y(p.value)} r="4" fill="var(--color-panel)" stroke="var(--color-ink)" strokeWidth="2" />
            {points.length <= 12 && (
              <text x={x(i)} y={y(p.value) + (dip(i) ? 20 : -11)} textAnchor={anchor(i)} fontSize="11" fill="var(--color-ink)"
                fontFamily="var(--font-mono)">{format(p.value, unit)}</text>
            )}
            {i % labelEvery === 0 && (
              <text x={x(i)} y={H - 12} fontSize="11" fill="var(--color-ink-muted)"
                textAnchor={anchor(i)} fontFamily="var(--font-mono)">{p.label}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function ChartCard({ panel }) {
  const copyText = [panel.title, ...panel.points.map((p) => `${p.label}\t${p.value}${panel.unit ? ` ${panel.unit}` : ""}`)].join("\n");
  return (
    <Frame icon={ChartIcon} title={panel.title} meta={panel.unit || null} copyText={copyText}>
      {panel.chart === "line" ? <Line points={panel.points} unit={panel.unit} /> : <Bars points={panel.points} unit={panel.unit} />}
    </Frame>
  );
}
