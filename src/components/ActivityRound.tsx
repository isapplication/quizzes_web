"use client";

import { useId, useState } from "react";
import type { ActivityAnswer, Answered, PlayQuestion } from "@/lib/assignments";

/**
 * One activity round in an assignment: put in order (PUZZLE), match the pairs (MATCH) or a flashcard (CARD). The
 * round keeps the student's own arrangement while it is answered, and once {@code feedback} arrives shows it against
 * the right answer. Mount it with a key per round so each round starts fresh.
 */
export function ActivityRound({ q, feedback, busy, onAnswer }: {
  q: PlayQuestion;
  feedback: Answered | null;
  busy: boolean;
  onAnswer: (answer: ActivityAnswer) => void;
}) {
  if (q.type === "PUZZLE") return <OrderRound q={q} feedback={feedback} busy={busy} onAnswer={onAnswer} />;
  if (q.type === "MATCH") return <MatchRound q={q} feedback={feedback} busy={busy} onAnswer={onAnswer} />;
  return <CardRound q={q} busy={busy} onAnswer={onAnswer} />;
}

type RoundProps = { q: PlayQuestion; feedback: Answered | null; busy: boolean; onAnswer: (answer: ActivityAnswer) => void };

/** Put in order: each item has its own Move up and Move down buttons; the new place is announced. */
function OrderRound({ q, feedback, busy, onAnswer }: RoundProps) {
  // places[k]: which shown item is now k-th.
  const [places, setPlaces] = useState(() => q.items.map((_, i) => i));
  const [said, setSaid] = useState("");
  const solution = (feedback?.solution ?? null) as string[] | null;

  function move(from: number, to: number) {
    if (to < 0 || to >= places.length) return;
    const next = [...places];
    [next[from], next[to]] = [next[to], next[from]];
    setPlaces(next);
    setSaid(q.items[next[to]] + " moved to place " + (to + 1) + " of " + next.length + ".");
  }

  return (
    <form className="activity-panel stack" onSubmit={(e) => { e.preventDefault(); onAnswer({ order: places }); }}>
      <ol className="order-list">
        {places.map((item, k) => {
          const text = q.items[item];
          const right = solution ? solution[k] === text : null;
          return (
            <li key={item} className={right === null ? "" : right ? "right" : "wrong"}>
              <span className="order-place" aria-hidden="true">{k + 1}</span>
              <span className="order-text">
                {text}
                {right === false && solution && <span className="order-fix"> — goes {placeName(solution.indexOf(text))}</span>}
                {right !== null && <span className="sr-only">{right ? " (right place)" : " (wrong place)"}</span>}
              </span>
              {!feedback && (
                <span className="order-moves">
                  <button type="button" className="btn btn-light" onClick={() => move(k, k - 1)} disabled={k === 0}>
                    <span aria-hidden="true">↑</span><span className="sr-only">Move {text} up</span>
                  </button>
                  <button type="button" className="btn btn-light" onClick={() => move(k, k + 1)} disabled={k === places.length - 1}>
                    <span aria-hidden="true">↓</span><span className="sr-only">Move {text} down</span>
                  </button>
                </span>
              )}
              {right !== null && <span className="order-mark" aria-hidden="true">{right ? "✓" : "✕"}</span>}
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">{said}</p>
      {!feedback && (
        <button type="submit" className="btn btn-primary activity-check" disabled={busy}>
          {busy ? "Checking…" : "Check my order"}
        </button>
      )}
    </form>
  );
}

function placeName(index: number): string {
  return ["first", "second", "third", "fourth", "fifth", "sixth"][index] ?? "at place " + (index + 1);
}

/**
 * Match the pairs: a native select per left item, choosing from the shuffled right side. Each right item is used
 * once: choosing one that another row has moves it here and clears that row.
 */
function MatchRound({ q, feedback, busy, onAnswer }: RoundProps) {
  const id = useId();
  const [chosen, setChosen] = useState<(number | null)[]>(() => q.left.map(() => null));
  const solution = (feedback?.solution ?? null) as [string, string][] | null;

  function choose(row: number, value: string) {
    const pick = value === "" ? null : Number(value);
    setChosen(chosen.map((c, r) => (r === row ? pick : c === pick ? null : c)));
  }

  return (
    <form className="activity-panel stack" onSubmit={(e) => { e.preventDefault(); onAnswer({ matches: chosen as number[] }); }}>
      <p className="hint" id={id + "-hint"} style={{ margin: 0 }}>Each answer goes with one item only.</p>
      <ul className="match-list">
        {q.left.map((left, row) => {
          const pick = chosen[row];
          const right = solution ? pick !== null && solution[row]?.[1] === q.right[pick] : null;
          return (
            <li key={row} className={right === null ? "" : right ? "right" : "wrong"}>
              <label htmlFor={id + "-" + row} className="match-left">{left}</label>
              <select id={id + "-" + row} required value={pick === null ? "" : String(pick)} disabled={feedback !== null}
                      aria-describedby={id + "-hint"} onChange={(e) => choose(row, e.target.value)}>
                <option value="" disabled>Choose…</option>
                {q.right.map((r, i) => <option key={i} value={i}>{r}</option>)}
              </select>
              {right !== null && (
                <span className="match-mark">
                  <span aria-hidden="true">{right ? "✓" : "✕"}</span>
                  <span className="sr-only">{right ? "Right" : "Not right"}</span>
                  {!right && solution && <span> Goes with {solution[row][1]}</span>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {!feedback && (
        <button type="submit" className="btn btn-primary activity-check" disabled={busy}>
          {busy ? "Checking…" : "Check my matches"}
        </button>
      )}
    </form>
  );
}

/**
 * A flashcard (its front is the round's text, shown above): think of the answer, show the back, then say honestly
 * whether you knew it. No points.
 */
function CardRound({ q, busy, onAnswer }: Omit<RoundProps, "feedback">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="activity-panel stack flash-card">
      <div aria-live="polite">
        {shown && <p className="flash-back"><span className="sr-only">Answer: </span>{q.back}</p>}
      </div>
      {!shown ? (
        <button type="button" className="btn btn-primary activity-check" onClick={() => setShown(true)}>Show the answer</button>
      ) : (
        <div className="row" style={{ justifyContent: "center", flexWrap: "wrap", gap: 10 }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onAnswer({ knew: true })} autoFocus>
            I knew it
          </button>
          <button type="button" className="btn btn-light" disabled={busy} onClick={() => onAnswer({ knew: false })}>
            Not yet
          </button>
        </div>
      )}
    </div>
  );
}
