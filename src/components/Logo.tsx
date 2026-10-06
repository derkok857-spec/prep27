export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--color-accent)" />
      <path
        d="M9 21.5V10.5h6.2a4.3 4.3 0 0 1 0 8.6H9"
        fill="none"
        stroke="var(--color-on-accent)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 22.5l2.6 2.6 5.4-6.1"
        fill="none"
        stroke="var(--color-on-accent)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
