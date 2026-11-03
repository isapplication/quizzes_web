"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerTile, ordinal, TeamBadge, TimerBar, useCountdown } from "./Stage";
import { connectLive, LiveConnection, LiveMessage, LiveStatus } from "@/lib/live";
import { OwnerBrandMark, useOwnerBrand } from "@/components/OwnerBrand";
import type { ShownBrand } from "@/lib/me";

interface Question {
  index: number;
  total: number;
  text: string;
  visual?: string | null;
  choices: string[];
  openedAt: number;
  closesAt: number;
  /** False in an accuracy game: there is no countdown. */
  timed?: boolean;
}

interface Result {
  index: number;
  answered: boolean;
  correct: boolean;
  points: number;
  streakBonus: number;
  streak: number;
  score: number;
  rank: number;
  players: number;
  /** Team games: the player's team, its place and its average score. */
  team?: number;
  teamRank?: number;
  teamScore?: number;
  teams?: number;
}

interface Final {
  rank: number;
  players: number;
  score: number;
  correct: number;
  questions: number;
  top: { rank: number; name: string; score: number }[];
  team?: number;
  teamRank?: number;
  teams?: number;
}

type View = "connecting" | "lobby" | "intro" | "question" | "answered" | "result" | "final" | "out";

/**
 * A student's device in a live game. The question and options come from the server without the key;
 * after the question closes the server says whether the answer was right and how many points it earned.
 */
export function PlayerGame({ url, pin, ticket, name, quizTitle, brand, compact = false }: {
  url: string;
  pin: string;
  ticket: string;
  name: string;
  quizTitle?: string;
  /** The hosting school's look (or Quizplayo's): a game follows whoever hosts it. */
  brand?: ShownBrand | null;
  compact?: boolean;
}) {
  useOwnerBrand(brand);
  // The game server may add a number to a guest's nickname to keep names different ("Sam 2").
  const [shownName, setShownName] = useState(name);
  const [view, setView] = useState<View>("connecting");
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState(quizTitle ?? "");
  const [score, setScore] = useState(0);
  const [team, setTeam] = useState(0);
  const [intro, setIntro] = useState<{ index: number; total: number; startsAt: number } | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [final, setFinal] = useState<Final | null>(null);
  const live = useRef<LiveConnection | null>(null);
  const serverNow = useCallback(() => live.current?.serverNow() ?? Date.now(), []);

  const onMessage = useCallback((m: LiveMessage) => {
    switch (m.type) {
      case "joined":
        if (m.name) setShownName(String(m.name));
        setTitle(String(m.quizTitle ?? ""));
        setScore(Number(m.score ?? 0));
        setTeam(Number(m.team ?? 0));
        if (m.question && !m.answered) {
          setQuestion(m.question as unknown as Question);
          setChosen(null);
          setView("question");
        } else if (m.question && m.answered) {
          setView("answered");
        } else {
          setView(m.phase === "PODIUM" ? "final" : "lobby");
        }
        break;
      case "intro":
        setIntro({ index: Number(m.index), total: Number(m.total), startsAt: Number(m.startsAt) });
        setResult(null);
        setView("intro");
        break;
      case "question":
        setQuestion(m as unknown as Question);
        setChosen(null);
        setView("question");
        break;
      case "answerAck":
        if (m.accepted === false && m.message) setMessage(String(m.message));
        break;
      case "result":
        setResult(m as unknown as Result);
        setScore(Number(m.score));
        setView("result");
        break;
      case "final":
        setFinal(m as unknown as Final);
        setView("final");
        break;
      case "kicked":
        setMessage(String(m.message));
        setView("out");
        live.current?.close();
        break;
      case "error":
        setMessage(String(m.message));
        if (m.code === "join_refused" || m.code === "no_game") {
          setView("out");
          live.current?.close();
        }
        break;
    }
  }, []);

  useEffect(() => {
    let connection: LiveConnection | null = null;
    let cancelled = false;
    connectLive({
      url, pin, ticket, role: "player", onMessage,
      onStatus: (s, msg) => {
        setStatus(s);
        if (s === "failed") {
          setMessage(msg ?? null);
          setView("out");
        }
      },
    }).then((c) => {
      if (cancelled) c.close();
      connection = c;
      live.current = c;
    });
    return () => {
      cancelled = true;
      connection?.close();
    };
  }, [url, pin, ticket, onMessage]);

  function answer(i: number) {
    if (!question || chosen !== null) return;
    setChosen(i);
    setMessage(null);
    live.current?.send({ type: "answer", index: question.index, choice: i });
    setView("answered");
  }

  return (
    <div className={"stage" + (compact ? " compact" : "")} style={compact ? { minHeight: "100%" } : undefined}>
      <div className="stage-bar">
        {compact ? <span className="brand">{shownName}</span> : <OwnerBrandMark brand={brand} />}
        <span className="spacer" />
        {!compact && <span>{shownName}</span>}
        {team > 0 && <TeamBadge team={team} />}
        <span className="status-pill">{score} pts</span>
        {status === "reconnecting" && <span className="status-pill">Reconnecting…</span>}
        {!compact && (
          <a className="btn btn-light" style={{ padding: "4px 12px" }} href="/home"
             onClick={(e) => { if (!window.confirm("Leave this game? Your score so far is kept.")) e.preventDefault(); }}>
            Leave game
          </a>
        )}
      </div>
      <main className="stage-main">
        {message && <div className="alert alert-warning">{message}</div>}
        {view === "connecting" && <p>Joining game {pin}…</p>}
        {view === "lobby" && (
          <div className="feedback neutral">
            You&apos;re in, {shownName}!<br />
            {team > 0 && <div style={{ margin: "10px 0" }}><TeamBadge team={team} big /></div>}
            <span style={{ fontSize: 16, fontWeight: 400 }}>{title} · Look for your name on the big screen.</span>
          </div>
        )}
        {view === "intro" && intro && <IntroCountdown intro={intro} serverNow={serverNow} />}
        {view === "question" && question && (
          <>
            {question.timed !== false && <TimerBar openedAt={question.openedAt} closesAt={question.closesAt} serverNow={serverNow} />}
            {!compact && (
              <div className="question-text" style={{ fontSize: 22 }}>
                {question.visual && <span aria-hidden="true">{question.visual} </span>}{question.text}
              </div>
            )}
            <div className="answer-grid" style={compact ? { gridTemplateColumns: "1fr 1fr", gap: 6 } : undefined}>
              {question.choices.map((c, i) => (
                <AnswerTile key={i} index={i} text={compact ? "" : c} onClick={() => answer(i)} />
              ))}
            </div>
          </>
        )}
        {view === "answered" && <div className="feedback neutral">Answer received ✓<br /><span style={{ fontSize: 16, fontWeight: 400 }}>Waiting for the others…</span></div>}
        {view === "result" && result && (
          <div className={"feedback " + (result.correct ? "ok" : "no")}>
            {result.correct ? "✓ Correct" : result.answered ? "✕ Not quite" : "⏱ Time's up"}
            {result.correct && (
              <div style={{ fontSize: 18 }}>
                +{result.points} points{result.streakBonus > 0 && <> · streak {result.streak} 🔥 +{result.streakBonus}</>}
              </div>
            )}
            <div style={{ fontSize: 16, fontWeight: 400 }}>
              You are {ordinal(result.rank)} of {result.players} · {result.score} points
            </div>
            {result.team && result.teamRank && (
              <div style={{ fontSize: 16, fontWeight: 400, marginTop: 6 }}>
                <TeamBadge team={result.team} /> is {ordinal(result.teamRank)} of {result.teams} teams
              </div>
            )}
          </div>
        )}
        {view === "final" && final && (
          <div className="feedback neutral">
            {final.rank <= 3 ? "🏆 " : ""}You finished {ordinal(final.rank)} of {final.players}
            <div style={{ fontSize: 18, fontWeight: 400 }}>
              {final.score} points · {final.correct} of {final.questions} correct
            </div>
            {final.team && final.teamRank && (
              <div style={{ fontSize: 18, fontWeight: 400, marginTop: 8 }}>
                <TeamBadge team={final.team} /> finished {ordinal(final.teamRank)} of {final.teams} teams{final.teamRank === 1 ? " 🏆" : ""}
              </div>
            )}
          </div>
        )}
        {view === "out" && !message && <div className="feedback neutral">This game has ended.</div>}
      </main>
    </div>
  );
}

function IntroCountdown({ intro, serverNow }: { intro: { index: number; total: number; startsAt: number }; serverNow: () => number }) {
  const left = useCountdown(intro.startsAt, serverNow);
  return (
    <div className="feedback neutral">
      Question {intro.index + 1} of {intro.total}
      <div className="big-number" style={{ margin: 12 }}>{left || "…"}</div>
      Get ready
    </div>
  );
}
