export function UfoCraft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 92" className={className} aria-hidden="true">
        <ellipse cx="100" cy="40" rx="38" ry="30" fill="var(--glow-b)" stroke="var(--ink)" strokeWidth="2" />
        <path d="M80 30c6-10 16-14 26-12" stroke="#fff" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8" />
        <ellipse cx="100" cy="58" rx="94" ry="22" fill="var(--charcoal)" />
        <ellipse cx="100" cy="53" rx="94" ry="18" fill="var(--bubble)" stroke="var(--ink)" strokeWidth="2" />
        <g className="ufo-lights" fill="var(--cream)">
          {[30, 58, 86, 114, 142, 170].map((x) => <circle key={x} cx={x} cy={x === 30 || x === 170 ? 56 : 60} r="4" />)}
        </g>
    </svg>
  );
}
