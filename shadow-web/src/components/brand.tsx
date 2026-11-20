
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" aria-hidden="true" className={className}>
      <circle cx="10" cy="10" r="5.5" />
      <path d="M17.6 8.6a5.5 5.5 0 0 1-9 9" opacity="0.55" />
    </svg>
  );
}

export function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path fill="currentColor"
        d="M12 2.5c.6 4.6 2.9 6.9 7.5 7.5v.01c-4.6.6-6.9 2.9-7.5 7.5h-.01c-.6-4.6-2.9-6.9-7.5-7.5V10c4.6-.6 6.9-2.9 7.5-7.5z" />
    </svg>
  );
}

