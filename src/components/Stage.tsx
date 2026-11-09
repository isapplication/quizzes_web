"use client";

import { type CSSProperties, useEffect, useState } from "react";
import type { Band } from "@/lib/gameLook";
import { AnswerShape, shapeName, shapeNumber } from "./AnswerShape";

/** One answer option in the school's answer colours, always with its shape and text (never colour alone). */
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
  const n = shapeNumber(index);
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

/**
 * An answer in a live game, drawn in the game's look (game-looks.css): always its colour, its shape and its text, so
 * colour is never the only cue. After the question closes it shows how many chose it and marks the right one.
 */
export function GameTile({ index, text, onClick, state, count, share }: {
  index: number;
  text: string;
  onClick?: () => void;
  state?: "correct" | "dim" | "chosen";
  count?: number;
  /** Results: this answer's bar, 0 to 100 against the most chosen (the count says the number). */
  share?: number;
}) {
  const label = shapeName(index) + ": " + text + (state === "correct" ? ", the right answer" : "")
    + (count !== undefined ? `, ${count} chose it` : "");
  return (
    <button type="button" className={"gl-tile" + (state === "dim" ? " is-dim" : state === "chosen" ? " is-chosen" : "")}
            data-n={shapeNumber(index)} style={{ "--i": index } as CSSProperties} onClick={onClick} disabled={!onClick}
            aria-label={label} aria-pressed={onClick ? state === "chosen" : undefined}>
      <span className="gl-shape"><AnswerShape index={index} color="currentColor" /></span>
      {text && <span className="gl-tile-text">{text}</span>}
      {count !== undefined && <span className="gl-count">{count}</span>}
      {share !== undefined && <span className="gl-tile-bar" aria-hidden="true"><span style={{ width: share + "%" }} /></span>}
      {state === "correct" && <span className="gl-mark" aria-hidden="true">✓ Correct</span>}
    </button>
  );
}

/**
 * A multi-select answer in a live game: the tile is the checkbox's label, so a tap, Space or a screen reader all toggle
 * it. The tick box and the shape show the choice, never colour alone.
 */
export function GameCheckTile({ index, text, checked, onChange, disabled }: {
  index: number;
  text: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={"gl-tile gl-check" + (checked ? " is-chosen" : "")} data-n={shapeNumber(index)}
           style={{ "--i": index } as CSSProperties}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)}
             aria-label={shapeName(index) + ": " + text} />
      <span className="gl-shape"><AnswerShape index={index} color="currentColor" /></span>
      <span className="gl-tile-text">{text}</span>
    </label>
  );
}

/** The question's countdown in the family's style: a ring (K–5), segments (6–8) or a thin line (9–12). */
export function GameTimer({ band, openedAt, closesAt, serverNow }: {
  band: Band;
  openedAt: number;
  closesAt: number;
  serverNow: () => number;
}) {
  const [fraction, setFraction] = useState(1);
  const left = useCountdown(closesAt, serverNow);
  useEffect(() => {
    const tick = () => setFraction(Math.max(0, Math.min(1, (closesAt - serverNow()) / Math.max(1, closesAt - openedAt))));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [openedAt, closesAt, serverNow]);
  const low = fraction < 0.25 ? " low" : "";
  const a11y = { role: "timer", "aria-label": `${left} ${left === 1 ? "second" : "seconds"} left` };
  if (band === "m68") {
    const lit = Math.ceil(fraction * 10);
    return (
      <div className={"gl-seg" + low} {...a11y}>
        {Array.from({ length: 10 }, (_, i) => <i key={i} className={i < lit ? "" : "off"} />)}
        <span aria-hidden="true">{left}</span>
      </div>
    );
  }
  if (band === "h912") {
    return (
      <div className={"gl-line" + low} {...a11y}>
        <div className="bar"><div style={{ width: `${fraction * 100}%` }} /></div>
        <span aria-hidden="true">0:{String(left).padStart(2, "0")}</span>
      </div>
    );
  }
  return (
    <div className={"gl-ring" + low} {...a11y}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="track" cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.2" />
        <circle className="left" cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.2" pathLength={100}
                strokeDasharray="100" strokeDashoffset={100 - fraction * 100} />
      </svg>
      <span aria-hidden="true">{left}</span>
    </div>
  );
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * A team in a team game: its colour (from the school's theme) and always its name (or number), so colour is never the
 * only cue. {@code name}: the team's name (Wave 2d); a game from before names shows "Team 2".
 */
export function TeamBadge({ team, name, big = false }: { team: number; name?: string | null; big?: boolean }) {
  return <span className={"team-badge team-" + team + (big ? " big" : "")}>{name || "Team " + team}</span>;
}

/** The team-talk pauses a teacher can choose (seconds; 0 is none). */
export const TEAM_TALK_SECONDS = [0, 5, 10, 15];

export type GameModeValue = "CLASSIC" | "TEAM" | "ACCURACY" | "LECTURE" | "UNPLUGGED";

/** The game modes a teacher can host, with the one-line description shown when choosing (wave2-contract.md). */
export const GAME_MODES: { value: GameModeValue; label: string; text: string }[] = [
  { value: "CLASSIC", label: "Classic", text: "Everyone for themselves. Faster right answers earn more points." },
  { value: "TEAM", label: "Team", text: "Players are put in even teams as they join. A team scores its members' average." },
  { value: "ACCURACY", label: "Accuracy", text: "No timer and no rush: every right answer earns the same. You close each question." },
  { value: "LECTURE", label: "Lecture", text: "Check understanding without a contest: no timer, no points, no leaderboard." },
  { value: "UNPLUGGED", label: "Unplugged", text: "No devices for students. The class talks it over and you tap their answer here." },
];

/** Players may add a boost to their answers in these modes (Confidence). */
export const CONFIDENCE_MODES: GameModeValue[] = ["CLASSIC", "TEAM", "ACCURACY"];
