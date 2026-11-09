"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Picture } from "@/components/Picture";
import { embedUrl, newFloaters, type ReactionCounts, REACTIONS, type ShownPicture } from "@/lib/media";

/**
 * A slide's picture and video (wave2-plan.md parts 2f and 2g). The video is a YouTube clip in a youtube-nocookie.com frame
 * with its start and end; nothing autoplays (the frame is not allowed to), so the teacher presses play. The frame has a
 * title for screen readers.
 */
export function SlideMedia({ picture, video, title }: {
  picture?: ShownPicture | null;
  video?: { id: string; start?: number | null; end?: number | null } | null;
  title: string;
}) {
  if (!picture && !video) return null;
  return (
    <div className="slide-media">
      {picture && <Picture picture={picture} className="slide-picture" main />}
      {video && (
        <div className="slide-video">
          <iframe src={embedUrl(video)} title={"Video: " + title} loading="lazy" allowFullScreen
                  allow="encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin"
                  sandbox="allow-scripts allow-same-origin allow-presentation" />
        </div>
      )}
    </div>
  );
}

interface Floater {
  key: number;
  reaction: number;
  left: number;
}

/**
 * The classroom screen's reactions: a count under each of the five (always shown as numbers and words), and an icon that
 * floats up for each new tap. Floating is motion, so it only runs where the person has not asked for less of it.
 */
export function ReactionWall({ reactions }: { reactions: ReactionCounts }) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const previous = useRef<number[]>(reactions.taps);
  const counter = useRef(0);

  useEffect(() => {
    const fresh = newFloaters(previous.current, reactions.taps);
    previous.current = reactions.taps;
    if (fresh.length === 0) return;
    const made = fresh.map((reaction) => ({ key: ++counter.current, reaction, left: 5 + Math.random() * 90 }));
    setFloaters((all) => [...all, ...made].slice(-24));
    const gone = setTimeout(() => setFloaters((all) => all.filter((f) => !made.some((m) => m.key === f.key))), 3000);
    return () => clearTimeout(gone);
  }, [reactions.taps]);

  return (
    <section className="reaction-wall" aria-label="Reactions from the class">
      <ul className="reaction-counts">
        {REACTIONS.map((r, i) => (
          <li key={i}>
            <span className="reaction-icon" aria-hidden="true">{r.icon}</span>
            <span className="reaction-word">{r.word}</span>
            <b className="reaction-count">{reactions.counts[i]}<span className="sr-only"> {reactions.counts[i] === 1 ? "student" : "students"}</span></b>
          </li>
        ))}
      </ul>
      <div className="reaction-sky" aria-hidden="true">
        {floaters.map((f) => (
          <span key={f.key} className="reaction-floater" style={{ left: f.left + "%" } as CSSProperties}>{REACTIONS[f.reaction].icon}</span>
        ))}
      </div>
    </section>
  );
}

/** How long a player waits between reactions: the game server accepts one a second. */
const COOLDOWN_MS = 1000;

/**
 * A player's five reactions to the slide on the screen. One reaction each: the one chosen stays marked, and a new tap
 * replaces it. Each button has its word as well as its icon. After a tap the buttons rest for a second.
 */
export function ReactionButtons({ current, onReact }: { current: number | null; onReact: (reaction: number) => void }) {
  const [resting, setResting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function tap(i: number) {
    if (resting) return;
    onReact(i);
    setResting(true);
    timer.current = setTimeout(() => setResting(false), COOLDOWN_MS);
  }

  return (
    <div className="reaction-buttons" role="group" aria-label="How do you feel about this slide?">
      {REACTIONS.map((r, i) => (
        <button key={i} type="button" className={"reaction-button" + (current === i ? " is-chosen" : "")} aria-pressed={current === i}
                disabled={resting && current !== i} onClick={() => tap(i)}>
          <span className="reaction-icon" aria-hidden="true">{r.icon}</span>
          <span className="reaction-word">{r.word}</span>
        </button>
      ))}
      <p className="sr-only" role="status">{current === null ? "" : "You chose: " + REACTIONS[current].word}</p>
    </div>
  );
}
