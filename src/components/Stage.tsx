"use client";

import { useEffect, useState } from "react";
import { AnswerShape } from "./AnswerShape";

/** One answer option in the IS answer colours, always with its shape and text (never colour alone). */
export function AnswerTile({
  index,
  text,
  onClick,
  disabled,
  state,
  count,
}: {
  index: number;
  text: string;
  onClick?: () => void;
  disabled?: boolean;
  state?: "correct" | "wrong" | "chosen" | "dim";
  count?: number;
}) {
  const n = (index % 4) + 1;
  return (
    <button
      type="button"
      className={"answer-tile " + (state ?? "")}
      style={{ background: `var(--a${n})`, color: `var(--a${n}-text)` }}
      onClick={onClick}
      disabled={disabled || !onClick}
      aria-pressed={state === "chosen"}
    >
      <AnswerShape index={index} size={34} color="currentColor" />
      <span className="answer-text">{text}</span>
      {state === "correct" && <span className="answer-mark">✓ Correct</span>}
      {count !== undefined && <span className="answer-count">{count}</span>}
    </button>
  );
}

/** Seconds left until `closesAt` on the game server's clock, updated 10 times a second. */
export function useCountdown(closesAt: number | null, serverNow: () => number): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!closesAt) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((closesAt - serverNow()) / 1000)));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [closesAt, serverNow]);
  return left;
}

export function TimerBar({ openedAt, closesAt, serverNow }: { openedAt: number; closesAt: number; serverNow: () => number }) {
  const [fraction, setFraction] = useState(1);
  useEffect(() => {
    const tick = () => setFraction(Math.max(0, Math.min(1, (closesAt - serverNow()) / (closesAt - openedAt))));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [openedAt, closesAt, serverNow]);
  return (
    <div className="timer-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
      <div style={{ width: `${fraction * 100}%`, background: fraction < 0.25 ? "var(--warning)" : "var(--pc)" }} />
    </div>
  );
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
