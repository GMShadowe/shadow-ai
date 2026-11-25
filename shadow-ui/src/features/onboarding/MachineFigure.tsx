import { useEffect, useRef, useState, type CSSProperties } from "react";
import { greeting, type Callout, type PartId } from "./machine";

export type Stage = "welcome" | "computer" | "name" | "download" | "done";

const C = 0.866;
const S = 0.5;
const W = 300;
const D = 200;
const T = 12;
const H = 190;
const LID = 8;

type P = [number, number];
const iso = (x: number, y: number, z: number): P => [(x - y) * C, (x + y) * S - z];
const pts = (...ps: P[]) => ps.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const vars = (v: Record<string, string | number>) => v as CSSProperties;

const SCREEN = `matrix(${C} ${S} 0 1 0 ${-(T + H)})`;
const DECK = `matrix(${C} ${S} ${-C} ${S} 0 ${-T})`;
const onTop = (z: number) => `matrix(${C} ${S} ${-C} ${S} 0 ${-z})`;

const KEY_ROWS = ["1234567890-=", "qwertyuiop[]", "asdfghjkl;'\\", "zxcvbnm,./ "];
const KEY_W = 19.5;
const KEY_H = 19;
const KEY_X = 34;
const KEY_Y = 18;

function keyAt(char: string): [number, number] | null {
  const c = char.toLowerCase();
  for (let r = 0; r < KEY_ROWS.length; r++) {
    const col = KEY_ROWS[r].indexOf(c);
    if (col >= 0) return [r, col];
  }
  return null;
}

interface BoxSpec {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
}

function Box({ x, y, z, w, d, h, delay }: BoxSpec & { delay: number }) {
  const top = pts(iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h));
  const front = pts(iso(x, y + d, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x, y + d, z));
  const right = pts(iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x + w, y + d, z), iso(x + w, y, z));
  const style = vars({ "--delay": `${delay}ms` });
  return (
    <g>
      <polygon points={front} className="fill-in" style={style} fill="var(--figure-face-2)" stroke="none" />
      <polygon points={right} className="fill-in" style={style} fill="var(--figure-face-2)" stroke="none" />
      <polygon points={top} className="fill-in part-face" style={style} fill="var(--figure-face)" stroke="none" />
      {[front, right, top].map((p, i) => (
        <polygon key={i} points={p} pathLength={1} className="draw" style={style} fill="none" strokeWidth={1.2} />
      ))}
    </g>
  );
}

interface PartSpec {
  id: PartId;
  box: BoxSpec;
  label: P;
}

const PX = W + 70;
const PARTS: PartSpec[] = [
  { id: "cpu", box: { x: PX, y: -10, z: 34, w: 64, d: 64, h: 7 }, label: [400, 70] },
  { id: "memory", box: { x: PX - 6, y: 92, z: 34, w: 92, d: 22, h: 8 }, label: [400, 196] },
  { id: "disk", box: { x: PX + 4, y: 150, z: 34, w: 70, d: 44, h: 6 }, label: [400, 300] },
];

const centreTop = (b: BoxSpec): P => iso(b.x + b.w / 2, b.y + b.d / 2, b.z + b.h);

/* Where a part starts before it rises out: the middle of the keyboard deck. */
const DECK_MIDDLE = iso(W * 0.62, D * 0.55, T);

function PartDetail({ id, b, fill }: { id: PartId; b: BoxSpec; fill: number }) {
  const t = onTop(b.z + b.h);
  const fine = { strokeWidth: 0.8, strokeOpacity: 0.75 };
  if (id === "cpu") {
    return (
      <g transform={t} {...fine}>
        <rect x={b.x + 18} y={b.y + 18} width={28} height={28} fill="none" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line x1={b.x + 12 + i * 10} y1={b.y + 4} x2={b.x + 12 + i * 10} y2={b.y + 10} />
            <line x1={b.x + 12 + i * 10} y1={b.y + b.d - 10} x2={b.x + 12 + i * 10} y2={b.y + b.d - 4} />
          </g>
        ))}
        <circle cx={b.x + 32} cy={b.y + 32} r={3} className="cpu-core" fill="var(--accent)" stroke="none" />
      </g>
    );
  }
  if (id === "memory") {
    return (
      <g transform={t} {...fine}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={b.x + 8 + i * 14} y={b.y + 6} width={9} height={10} fill="none" className="mem-cell" style={vars({ "--i": i })} />
        ))}
      </g>
    );
  }
  return (
    <g transform={t} {...fine}>
      <rect x={b.x + 8} y={b.y + 10} width={b.w - 16} height={8} rx={2} fill="none" />
      <rect x={b.x + 8} y={b.y + 10} width={Math.max(0, (b.w - 16) * fill)} height={8} rx={2} fill="var(--accent)" stroke="none" className="disk-fill" />
      <circle cx={b.x + b.w - 14} cy={b.y + 30} r={4} />
    </g>
  );
}

function Part({ spec, lifted, delay, fill, onHover }: {
  spec: PartSpec;
  lifted: boolean;
  delay: number;
  fill: number;
  onHover: (id: PartId | null) => void;
}) {
  const b = spec.box;
  const shadow = pts(iso(b.x, b.y, 0), iso(b.x + b.w, b.y, 0), iso(b.x + b.w, b.y + b.d, 0), iso(b.x, b.y + b.d, 0));
  const [sx, sy] = iso(b.x + b.w / 2, b.y + b.d / 2, 0);
  const [tx, ty] = iso(b.x + b.w / 2, b.y + b.d / 2, b.z);
  const [cx, cy] = centreTop(b);
  const from = vars({ "--fx": `${DECK_MIDDLE[0] - cx}px`, "--fy": `${DECK_MIDDLE[1] - cy}px`, "--delay": `${delay}ms` });
  return (
    <g onPointerEnter={() => onHover(spec.id)} onPointerLeave={() => onHover(null)} className="cursor-pointer">
      <polygon points={shadow} fill="none" strokeDasharray="3 4" strokeOpacity={0.35} className="callout" style={vars({ "--delay": `${delay + 500}ms` })} />
      <line x1={sx} y1={sy} x2={tx} y2={ty} strokeDasharray="2 4" strokeOpacity={0.45} className="callout" style={vars({ "--delay": `${delay + 500}ms` })} />
      <g className="part-rise" style={from}>
        <g className={`part ${lifted ? "lifted" : ""}`}>
          <Box {...b} delay={delay} />
          <PartDetail id={spec.id} b={b} fill={fill} />
        </g>
      </g>
    </g>
  );
}

function Leader({ at, from, delay, active, align = "start", layer }: {
  at: P;
  from: P;
  delay: number;
  active: boolean;
  align?: "start" | "end";
  layer: "line" | "dots";
}) {
  const knee: P = [at[0] + (align === "start" ? -18 : 18), at[1]];
  if (layer === "line") {
    return (
      <polyline
        points={pts(from, knee, at)}
        fill="none"
        strokeWidth={1}
        pathLength={1}
        className="fig-label draw leader"
        style={vars({ "--delay": `${delay}ms`, "--draw-ms": "560ms" })}
        stroke={active ? "var(--accent)" : "var(--figure-line)"}
        strokeOpacity={active ? 1 : 0.5}
      />
    );
  }
  return (
    <g className="fig-label">
      <circle cx={from[0]} cy={from[1]} r={active ? 4.5 : 3.5} strokeWidth={1.25} className="callout anchor" style={vars({ "--delay": `${delay}ms` })} fill={active ? "var(--accent)" : "var(--bg)"} stroke={active ? "var(--accent)" : "var(--figure-line)"} />
      <circle cx={at[0]} cy={at[1]} r={2} className="callout" style={vars({ "--delay": `${delay + 380}ms` })} fill={active ? "var(--accent)" : "var(--figure-line)"} stroke="none" />
    </g>
  );
}

const VB = { x: -290, y: -262, w: 930, h: 616 };
const percent = ([x, y]: P) => ({ left: `${((x - VB.x) / VB.w) * 100}%`, top: `${((y - VB.y) / VB.h) * 100}%` });

function Card({ at, callout, index, delay, active, align, onHover }: {
  at: P;
  callout: Callout;
  index: number;
  delay: number;
  active: boolean;
  align: "start" | "end";
  onHover: (id: PartId | null) => void;
}) {
  return (
    <div
      className={`fig-card fig-label callout ${align === "end" ? "fig-card-end" : ""} ${active ? "active" : ""}`}
      style={{ ...percent(at), ...vars({ "--delay": `${delay + 300}ms` }) }}
      onPointerEnter={() => onHover(callout.id)}
      onPointerLeave={() => onHover(null)}
    >
      <div className="flex items-baseline gap-2.5">
        <span className="fig-card-index">{String(index).padStart(2, "0")}</span>
        <span className="font-mono text-[12.5px] leading-none tracking-[-0.01em] text-ink">{callout.label}</span>
      </div>
      <div key={callout.detail} className="fig-card-detail detail-swap">
        {callout.detail}
      </div>
    </div>
  );
}

function ScreenContent({ stage, name, progress }: { stage: Stage; name: string; progress: number | null }) {
  const cx = W / 2;
  const cy = 92;
  const display = name.trim() || "Shadow";
  const short = (n: number) => (display.length > n ? `${display.slice(0, n - 1)}…` : display);
  if (stage === "welcome") {
    return (
      <g stroke="var(--figure-line)">
        <circle cx={cx - 6} cy={cy - 6} r={24} fill="none" strokeWidth={2.4} pathLength={1} className="draw" style={vars({ "--delay": "900ms" })} />
        <path d={`M${cx + 26} ${cy - 10} a24 24 0 0 1 -38 38`} fill="none" strokeWidth={2.4} stroke="var(--accent)" pathLength={1} className="draw" style={vars({ "--delay": "1300ms" })} />
      </g>
    );
  }
  if (stage === "computer") {
    return (
      <g>
        <text x={28} y={44} fontFamily="var(--font-mono)" fontSize={10} fill="var(--ink-faint)" stroke="none">
          looking at this computer
        </text>
        {[150, 110, 130, 90].map((w, i) => (
          <rect key={i} x={28} y={60 + i * 20} width={w} height={7} rx={3.5} fill="var(--ink)" fillOpacity={0.14} stroke="none" className="scan-bar" style={vars({ "--delay": `${200 + i * 260}ms` })} />
        ))}
        <g className="scan-line" style={vars({ "--scan-h": "130px" })}>
          <line x1={14} y1={30} x2={W - 14} y2={30} stroke="var(--accent)" strokeWidth={1.5} />
        </g>
      </g>
    );
  }
  if (stage === "name") {
    return (
      <g>
        <rect x={cx - 52} y={34} width={104} height={18} rx={9} fill="none" stroke="var(--figure-line)" strokeOpacity={0.4} />
        <circle cx={cx - 40} cy={43} r={2.5} fill="var(--accent)" stroke="none" className="live-dot" />
        <text x={cx - 32} y={46.5} fontFamily="var(--font-mono)" fontSize={9} fill="var(--ink-muted)" stroke="none">
          {greeting()}
        </text>
        <text key={display} x={cx} y={90} textAnchor="middle" fontFamily="var(--font-serif)" fontSize={26} fill="var(--ink)" stroke="none" className="name-swap">
          I&rsquo;m {short(14)}.
        </text>
        <rect x={40} y={118} width={W - 80} height={26} rx={9} fill="var(--figure-face-2)" stroke="var(--figure-line)" strokeOpacity={0.35} />
        <text x={52} y={135} fontFamily="var(--font-sans)" fontSize={9.5} fill="var(--ink-faint)" stroke="none">
          Ask {display.length > 14 ? "it" : display} anything
        </text>
        <rect x={W - 64} y={123} width={16} height={16} rx={4} fill="var(--accent)" stroke="none" />
      </g>
    );
  }
  if (stage === "download") {
    const f = progress ?? 0;
    return (
      <g>
        <text x={28} y={56} fontFamily="var(--font-mono)" fontSize={10} fill="var(--ink-faint)" stroke="none">
          {progress === null ? "pulling manifest" : "downloading"}
        </text>
        <rect x={28} y={70} width={W - 56} height={8} rx={4} fill="var(--ink)" fillOpacity={0.1} stroke="none" />
        {progress === null ? (
          <rect x={28} y={70} width={W - 56} height={8} rx={4} fill="var(--accent)" fillOpacity={0.35} className="pulse-soft" stroke="none" />
        ) : (
          <rect x={28} y={70} width={Math.max(0, (W - 56) * f)} height={8} rx={4} fill="var(--accent)" stroke="none" />
        )}
        <text x={28} y={104} fontFamily="var(--font-mono)" fontSize={20} fill="var(--ink)" stroke="none" className="tabular">
          {progress === null ? "—" : `${Math.floor(f * 100)}%`}
        </text>
      </g>
    );
  }
  return (
    <g>
      <rect x={12} y={12} width={W - 24} height={H - 30} rx={4} fill="var(--accent)" stroke="none" className="screen-on" />
      <circle cx={cx - 4} cy={cy - 18} r={14} fill="none" stroke="var(--accent-ink)" strokeWidth={2.2} className="fill-in" style={vars({ "--delay": "250ms" })} />
      <path d={`M${cx + 14} ${cy - 22} a14 14 0 0 1 -22 22`} fill="none" stroke="var(--accent-ink)" strokeWidth={2.2} strokeOpacity={0.55} className="fill-in" style={vars({ "--delay": "250ms" })} />
      <text x={cx} y={cy + 32} textAnchor="middle" fontFamily="var(--font-serif)" fontSize={22} fill="var(--accent-ink)" stroke="none" className="fill-in" style={vars({ "--delay": "380ms" })}>
        {short(16)} is ready.
      </text>
    </g>
  );
}

const ORIGIN: P = [-262, -236];
const SCREEN_MIDDLE: P = [(W / 2) * C, (W / 2) * S - (T + H) + 92];
const DOWNLOAD_PATH = `M${ORIGIN[0]} ${ORIGIN[1]} C ${ORIGIN[0] + 130} ${ORIGIN[1] - 30}, ${SCREEN_MIDDLE[0] - 160} ${SCREEN_MIDDLE[1] - 150}, ${SCREEN_MIDDLE[0]} ${SCREEN_MIDDLE[1]}`;

function Cube({ size = 9 }: { size?: number }) {
  const s = size;
  const top = pts([0, -s], [s * C, -s + s * S], [0, -s + 2 * s * S], [-s * C, -s + s * S]);
  const left = pts([-s * C, -s + s * S], [0, -s + 2 * s * S], [0, s], [-s * C, s * S]);
  const right = pts([s * C, -s + s * S], [0, -s + 2 * s * S], [0, s], [s * C, s * S]);
  return (
    <g stroke="none">
      <polygon points={left} fill="color-mix(in oklab, var(--accent) 70%, var(--bg))" />
      <polygon points={right} fill="color-mix(in oklab, var(--accent) 50%, var(--bg))" />
      <polygon points={top} fill="var(--accent)" />
    </g>
  );
}

function DownloadPath({ progress, arrivals }: { progress: number | null; arrivals: number }) {
  const ref = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);
  const [at, setAt] = useState<P>(ORIGIN);
  const f = Math.min(progress ?? 0, 1);

  useEffect(() => {
    const path = ref.current;
    if (!path) return;
    const total = path.getTotalLength();
    setLength(total);
    const point = path.getPointAtLength(total * f);
    setAt([point.x, point.y]);
  }, [f]);

  return (
    <g>
      <path ref={ref} d={DOWNLOAD_PATH} fill="none" strokeDasharray="3 5" strokeOpacity={0.45} className="callout" />
      {length > 0 && (
        <path
          d={DOWNLOAD_PATH}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.75}
          strokeDasharray={`${length * f} ${length}`}
          style={{ transition: "stroke-dasharray 260ms var(--ease-smooth)" }}
        />
      )}
      <g className="callout">
        <circle cx={ORIGIN[0]} cy={ORIGIN[1]} r={3.5} fill="var(--accent)" stroke="none" className="origin-ping" />
        <text x={ORIGIN[0]} y={ORIGIN[1] - 14} fontFamily="var(--font-mono)" fontSize={11.5} fill="var(--ink-faint)" stroke="none">
          registry.ollama.ai
        </text>
      </g>
      <g style={{ transform: `translate(${at[0]}px, ${at[1]}px)`, transition: "transform 260ms var(--ease-smooth)" }}>
        <g className={progress === null ? "pulse-soft" : "cube-bob"}>
          <Cube />
        </g>
      </g>
      <g key={arrivals} transform={`translate(${SCREEN_MIDDLE[0]} ${SCREEN_MIDDLE[1]})`}>
        {arrivals > 0 && <circle r={10} fill="none" stroke="var(--accent)" strokeWidth={1.5} className="burst" />}
      </g>
    </g>
  );
}

const SPARKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
  const dist = 110 + (i % 3) * 34;
  return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist * 0.8, size: i % 3 === 0 ? 7 : 4.5, delay: (i % 4) * 40 };
});

function Sparkles() {
  const [x, y] = SCREEN_MIDDLE;
  return (
    <g transform={`translate(${x} ${y - 10})`} stroke="none">
      {SPARKS.map((s, i) => (
        <path
          key={i}
          d={`M0 ${-s.size} Q0 0 ${s.size} 0 Q0 0 0 ${s.size} Q0 0 ${-s.size} 0 Q0 0 0 ${-s.size}Z`}
          fill={i % 3 === 1 ? "var(--ink)" : "var(--accent)"}
          className="spark"
          style={vars({ "--dx": `${s.dx}px`, "--dy": `${s.dy}px`, "--delay": `${s.delay}ms` })}
        />
      ))}
    </g>
  );
}

/* Heat rising off the chip: three wavy lines working hard, one in Cool mode. */
function Heat({ cool }: { cool: boolean }) {
  const b = PARTS[0].box;
  const [x, y] = iso(b.x + b.w / 2, b.y + b.d / 2, b.z + b.h + 6);
  const lines = cool ? [0] : [-20, 0, 20];
  return (
    <g transform={`translate(${x} ${y - 6})`} fill="none" strokeWidth={1.75} className="callout" style={vars({ "--delay": "900ms" })}>
      {lines.map((dx, i) => (
        <path
          key={`${cool}-${dx}`}
          d={`M${dx} 0 q -7 -10 0 -20 t 0 -20 t 0 -20`}
          stroke="var(--accent)"
          className="heat-line"
          style={vars({ "--i": i })}
        />
      ))}
    </g>
  );
}

export interface KeyPress {
  char: string;
  n: number;
}

export default function MachineFigure({
  stage,
  callouts,
  name,
  progress,
  diskFill,
  arrivals,
  hovered,
  onHover,
  keyPress,
  cool,
}: {
  stage: Stage;
  callouts: Callout[];
  name: string;
  progress: number | null;
  diskFill: number;
  arrivals: number;
  hovered: PartId | null;
  onHover: (id: PartId | null) => void;
  keyPress: KeyPress | null;
  cool: boolean;
}) {
  const showParts = stage !== "welcome";
  const showLabels = stage === "computer";
  const byId = Object.fromEntries(callouts.map((c) => [c.id, c])) as Partial<Record<PartId, Callout>>;
  const pressed = keyPress ? keyAt(keyPress.char) : null;

  const lidFront = pts(iso(0, 0, T), iso(W, 0, T), iso(W, 0, T + H), iso(0, 0, T + H));
  const lidRight = pts(iso(W, -LID, T), iso(W, 0, T), iso(W, 0, T + H), iso(W, -LID, T + H));
  const lidTop = pts(iso(0, -LID, T + H), iso(W, -LID, T + H), iso(W, 0, T + H), iso(0, 0, T + H));
  const deckTop = pts(iso(0, 0, T), iso(W, 0, T), iso(W, D, T), iso(0, D, T));
  const deckFront = pts(iso(0, D, T), iso(W, D, T), iso(W, D, 0), iso(0, D, 0));
  const deckRight = pts(iso(W, 0, T), iso(W, D, T), iso(W, D, 0), iso(W, 0, 0));

  const screenAnchor = iso(0, 0, T + H - 40);
  const modelAnchor = iso(40, 0, T + 50);

  const notes = [
    ...PARTS.map((spec, i) => ({ id: spec.id, at: spec.label, from: centreTop(spec.box), delay: 700 + i * 260, align: "start" as const })),
    { id: "screen" as PartId, at: [-50, -225] as P, from: screenAnchor, delay: 300, align: "end" as const },
    { id: "model" as PartId, at: [-50, -75] as P, from: modelAnchor, delay: 1600, align: "end" as const },
  ].filter((n) => byId[n.id]);
  const order: PartId[] = ["screen", "cpu", "memory", "disk", "model"];

  const leaders = (layer: "line" | "dots") => (
    <g className="depth-2">
      {notes.map((n) => (
        <Leader key={n.id} layer={layer} at={n.at} from={n.from} delay={n.delay} active={hovered === n.id} align={n.align} />
      ))}
    </g>
  );

  return (
    <div className="figure relative mx-auto" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
      <svg
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        className="absolute inset-0 h-full w-full overflow-visible"
        stroke="var(--figure-line)"
        strokeWidth={1.1}
        strokeLinejoin="round"
        strokeLinecap="round"
        role="img"
        aria-label="A line drawing of this computer"
      >
        <g className="depth-1">
          {[lidFront, lidRight, lidTop].map((p, i) => (
            <polygon key={`f${i}`} points={p} className="fill-in" fill={i === 0 ? "var(--figure-face)" : "var(--figure-face-2)"} stroke="none" />
          ))}
          {[deckTop, deckFront, deckRight].map((p, i) => (
            <polygon key={`d${i}`} points={p} className="fill-in" fill={i === 0 ? "var(--figure-face)" : "var(--figure-face-2)"} style={vars({ "--delay": "200ms" })} stroke="none" />
          ))}
          {[lidFront, lidRight, lidTop, deckTop, deckFront, deckRight].map((p, i) => (
            <polygon key={`l${i}`} points={p} pathLength={1} fill="none" strokeWidth={1.6} className="draw" style={vars({ "--delay": `${i * 90}ms` })} />
          ))}

          <g transform={SCREEN}>
            <rect
              x={12}
              y={12}
              width={W - 24}
              height={H - 30}
              rx={4}
              fill="var(--bg)"
              strokeWidth={1}
              pathLength={1}
              className={`draw screen ${hovered === "screen" || hovered === "model" ? "screen-hot" : ""}`}
              style={vars({ "--delay": "500ms" })}
            />
            <g key={stage} className="screen-swap" style={vars({ "--delay": stage === "welcome" ? "700ms" : "0ms" })}>
              <ScreenContent stage={stage} name={name} progress={progress} />
            </g>
          </g>

          <g transform={DECK} strokeWidth={0.8}>
            {KEY_ROWS.map((row, r) =>
              [...row].map((_, col) => (
                <rect
                  key={`${r}-${col}`}
                  x={KEY_X + col * KEY_W}
                  y={KEY_Y + r * KEY_H}
                  width={15}
                  height={14}
                  rx={2}
                  fill="var(--accent)"
                  fillOpacity={0}
                  strokeOpacity={0.6}
                  pathLength={1}
                  className={`draw key ${stage === "welcome" ? "key-wave" : ""}`}
                  style={vars({ "--delay": `${600 + (r * 12 + col) * 8}ms`, "--draw-ms": "500ms", "--wave": `${2300 + (r + col) * 45}ms` })}
                />
              ))
            )}
            {pressed && keyPress && (
              <rect
                key={keyPress.n}
                x={KEY_X + pressed[1] * KEY_W}
                y={KEY_Y + pressed[0] * KEY_H}
                width={15}
                height={14}
                rx={2}
                fill="var(--accent)"
                stroke="var(--accent)"
                className="key-flash"
              />
            )}
            <rect x={W / 2 - 52} y={104} width={104} height={64} rx={5} fill="none" strokeOpacity={0.6} pathLength={1} className="draw" style={vars({ "--delay": "1000ms" })} />
          </g>

          {stage === "download" && <DownloadPath progress={progress} arrivals={arrivals} />}
          {stage === "done" && <Sparkles />}
        </g>

        {showLabels && leaders("line")}

        <g className="depth-2">
          {showParts &&
            PARTS.map((spec, i) =>
              byId[spec.id] ? (
                <Part key={spec.id} spec={spec} lifted={hovered === spec.id} delay={stage === "computer" ? i * 160 : 0} fill={spec.id === "disk" ? diskFill : 0} onHover={onHover} />
              ) : null
            )}
        </g>

        {stage === "computer" && byId.cpu && (
          <g className="depth-2">
            <Heat cool={cool} />
          </g>
        )}

        {showLabels && leaders("dots")}
      </svg>

      {showLabels && (
        <div className="depth-2 pointer-events-none absolute inset-0">
          {notes.map((n) => (
            <Card
              key={n.id}
              at={n.at}
              callout={byId[n.id]!}
              index={order.indexOf(n.id) + 1}
              delay={n.delay}
              active={hovered === n.id}
              align={n.align}
              onHover={onHover}
            />
          ))}
        </div>
      )}
    </div>
  );
}
