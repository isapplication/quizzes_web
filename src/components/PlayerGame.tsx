"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameTile, GameTimer, ordinal, TeamBadge, useCountdown } from "./Stage";
import { AnswerShape } from "./AnswerShape";
import { GameLook } from "@/components/live/GameLook";
import { Buddy, Confetti } from "@/components/live/LookArt";
import { lookBand, lookWords } from "@/lib/gameLook";
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
export function PlayerGame({ url, pin, ticket, name, quizTitle, brand, lookGrade = null, compact = false }: {
  url: string;
  pin: string;
  ticket: string;
  name: string;
  quizTitle?: string;
  /** The hosting school's look (or Quizplayo's): a game follows whoever hosts it. */
  brand?: ShownBrand | null;
  /** The grade (0 to 12) whose game look this game uses; null shows the default look. */
  lookGrade?: number | null;
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
  // The right answer of the question that just closed, so a wrong answer can show it.
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);
  const band = lookBand(lookGrade);
  const words = lookWords(band);
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
      case "closed":
        setCorrectIndex(Number(m.correctIndex));
        break;
      case "answerAck":
        if (m.accepted === false && m.message) setMessage(String(m.message));
        break;
      case "result":
        setResult(m as unknown as Result);
        setMessage(null);
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

  const shownAnswer = result && !result.correct && question && correctIndex !== null && question.index === result.index
    ? { index: correctIndex, text: question.choices[correctIndex] } : null;

  return (
    <GameLook grade={lookGrade} kind={compact ? "compact" : "player"}>
      <header className="gl-bar">
        {compact ? <span className="brand">{shownName}</span> : <OwnerBrandMark brand={brand} />}
        <span className="gl-spacer" />
        {!compact && <span className="gl-who">{shownName}</span>}
        {team > 0 && <TeamBadge team={team} />}
        <span className="gl-pill">{score.toLocaleString()} pts</span>
        {status === "reconnecting" && <span className="gl-pill" role="status">Reconnecting…</span>}
        {!compact && (
          <a className="gl-quiet" href="/home"
             onClick={(e) => { if (!window.confirm("Leave this game? Your score so far is kept.")) e.preventDefault(); }}>
            Leave
          </a>
        )}
      </header>
      <main className="gl-main">
        {message && <div className="gl-alert" role="alert">{message}</div>}
        {view === "connecting" && <div className="gl-center"><p className="gl-sub">Joining game {pin}…</p></div>}
        {view === "lobby" && (
          <div className="gl-center gl-in">
            <Buddy grade={lookGrade} />
            <div className="gl-big">You&apos;re in, {shownName}!</div>
            {team > 0 && <TeamBadge team={team} big />}
            <div className="gl-sub">{title}<br />Look for your name on the big screen.</div>
          </div>
        )}
        {view === "intro" && intro && <IntroCountdown intro={intro} serverNow={serverNow} />}
        {view === "question" && question && (
          <>
            <div className="gl-row" style={{ justifyContent: "space-between" }}>
              <span className="gl-pill">{question.index + 1} of {question.total}</span>
              {question.timed !== false && <GameTimer band={band} openedAt={question.openedAt} closesAt={question.closesAt} serverNow={serverNow} />}
            </div>
            {!compact && (
              <h1 className="gl-card gl-q">
                {question.visual && <span className="gl-visual" aria-hidden="true">{question.visual}</span>}{question.text}
              </h1>
            )}
            <div className="gl-tiles gl-in">
              {question.choices.map((c, i) => <GameTile key={i} index={i} text={compact ? "" : c} onClick={() => answer(i)} />)}
            </div>
          </>
        )}
        {view === "answered" && (
          <div className="gl-center gl-in">
            <Buddy grade={lookGrade} />
            <div className="gl-big">Answer in!</div>
            <div className="gl-sub">Waiting for the others…</div>
          </div>
        )}
        {view === "result" && result && (
          <div className="gl-center gl-in">
            <Buddy grade={lookGrade} mood={result.correct ? "happy" : "sad"} />
            <div className={"gl-card gl-result " + (result.correct ? "ok" : "no")} role="status">
              <div className="gl-result-icon gl-on-large" aria-hidden="true">{result.correct ? "✓" : result.answered ? "✕" : "⏱"}</div>
              <div className="gl-big">{result.correct ? words.correct : result.answered ? words.wrong : words.timeUp}</div>
              {result.correct && (
                <>
                  <div className="pts">+{result.points.toLocaleString()} points</div>
                  {result.streakBonus > 0 && <div>🔥 Streak {result.streak} · +{result.streakBonus} bonus</div>}
                </>
              )}
              {shownAnswer && (
                <div className="gl-sub">
                  The answer was{" "}
                  <span className="gl-answer">
                    <AnswerShape index={shownAnswer.index} color={`var(--a${(shownAnswer.index % 4) + 1})`} />{shownAnswer.text}
                  </span>
                </div>
              )}
              <div className="gl-sub">You are {ordinal(result.rank)} of {result.players} · {result.score.toLocaleString()} points</div>
              {result.team && result.teamRank && (
                <div className="gl-sub"><TeamBadge team={result.team} /> is {ordinal(result.teamRank)} of {result.teams} teams</div>
              )}
            </div>
          </div>
        )}
        {view === "final" && final && (
          <div className="gl-center gl-in">
            {final.rank <= 3 && <Confetti band={band} />}
            <Buddy grade={lookGrade} mood="happy" />
            <div className="gl-sub">You finished</div>
            <div className="gl-place">{ordinal(final.rank)}</div>
            <div className="gl-sub">of {final.players} · {final.score.toLocaleString()} points · {final.correct} of {final.questions} correct</div>
            {final.rank <= 3 && band !== "h912" && <span className="gl-pill">🏅 On the podium!</span>}
            {final.team && final.teamRank && (
              <div className="gl-sub">
                <TeamBadge team={final.team} /> finished {ordinal(final.teamRank)} of {final.teams} teams{final.teamRank === 1 ? " 🏆" : ""}
              </div>
            )}
          </div>
        )}
        {view === "out" && !message && <div className="gl-center"><div className="gl-big">This game has ended.</div></div>}
      </main>
    </GameLook>
  );
}

function IntroCountdown({ intro, serverNow }: { intro: { index: number; total: number; startsAt: number }; serverNow: () => number }) {
  const left = useCountdown(intro.startsAt, serverNow);
  return (
    <div className="gl-intro gl-in">
      <h2>Question {intro.index + 1} of {intro.total}</h2>
      <div className="n" aria-live="polite">{left || "…"}</div>
      <p style={{ margin: 0 }}>Get ready</p>
    </div>
  );
}
