import { BRAND } from "@/lib/brand";

/**
 * The Quizplayo mark: a Q whose middle is a play button (quiz + play), with an amber tail.
 * The same drawing is the site icon (app/icon.svg).
 */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="qp-logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b8cff" />
          <stop offset="1" stopColor="#0b4fd6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#qp-logo-bg)" />
      <circle cx="30" cy="30" r="16.5" fill="none" stroke="#fff" strokeWidth="7" />
      <path d="M25.5 22.5 L38 30 L25.5 37.5 Z" fill="#fff" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M42 42 L51 51" stroke="#ffc233" strokeWidth="7.5" strokeLinecap="round" />
    </svg>
  );
}

/** Mark plus wordmark: "Quiz" in the text colour, "playo" in amber. */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="logo" aria-label={BRAND.name}>
      <LogoMark size={size} />
      <span className="logo-word" aria-hidden="true" style={{ fontSize: size * 0.66 }}>
        Quiz<span className="logo-play">playo</span>
      </span>
    </span>
  );
}
