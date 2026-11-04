"use client";

import { type CSSProperties, useEffect } from "react";
import { AnswerShape } from "@/components/AnswerShape";
import { LogoMark } from "@/components/Logo";
import { useCountdown } from "@/components/Stage";
import type { ShownBrand } from "@/lib/me";

/** The sound switch on a game screen: a drawn speaker (emoji are missing on some devices) and the words. */
export function SoundToggle({ muted, onToggle, compact = false }: { muted: boolean; onToggle: () => void; compact?: boolean }) {
  return (
    <button type="button" className="gl-quiet gl-sound" onClick={onToggle} aria-pressed={muted}
            aria-label={muted ? "Sound off. Turn sound on" : "Sound on. Turn sound off"}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {muted
          ? <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          : <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />}
      </svg>
      {!compact && <span>{muted ? "Sound off" : "Sound on"}</span>}
    </button>
  );
}

/** A player's badge: their initial on one of the four answer shapes and colours, picked from the name. */
export function PlayerBadge({ name, size = 72 }: { name: string; size?: number }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const n = hash % 4;
  return (
    <span className="gl-badge" style={{ "--bg": `var(--a${n + 1})`, "--s": `${size}px` } as CSSProperties} aria-hidden="true">
      <AnswerShape index={n} size={size} color="var(--bg)" />
      <span className="gl-badge-initial">{name.trim().charAt(0).toUpperCase() || "?"}</span>
    </span>
  );
}

/** A tick each second for the last {@code from} seconds before {@code until}. */
export function LastSecondsTicks({ until, serverNow, tick, from = 5 }: {
  until: number;
  serverNow: () => number;
  tick: () => void;
  from?: number;
}) {
  const left = useCountdown(until, serverNow);
  useEffect(() => {
    if (left > 0 && left <= from) tick();
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * The top of the join page: the hosting school's logo and name once the PIN is known, otherwise the Quizplayo mark,
 * with the four answer shapes drifting behind it.
 */
export function JoinHero({ brand, title, subtitle }: { brand?: ShownBrand | null; title: string; subtitle?: string }) {
  const school = brand?.owner === "school";
  return (
    <div className="gl-hero">
      <div className="gl-hero-shapes" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={"s" + i}><AnswerShape index={i} size={44} color={`var(--a${i + 1})`} /></span>
        ))}
      </div>
      {school && brand?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="gl-hero-logo" src={brand.logoUrl} alt={brand.name ?? ""} />
      ) : school ? (
        <span className="gl-hero-name">{brand?.name}</span>
      ) : (
        <span className="gl-hero-mark">
          <LogoMark size={88} />
          <span className="logo-word gl-hero-word" aria-label="Quizplayo">Quiz<span className="logo-play">playo</span></span>
        </span>
      )}
      <h1 className="gl-hero-title">{title}</h1>
      {subtitle && <p className="gl-hero-sub">{subtitle}</p>}
    </div>
  );
}
