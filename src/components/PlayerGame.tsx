"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameTile, GameTimer, ordinal, TeamBadge, useCountdown } from "./Stage";
import { AnswerShape, shapeNumber } from "./AnswerShape";
import { OrderList } from "./ActivityRound";
import { CategoriseForm, type CategoriseShown, MultiSelectForm, type SliderShown, SliderForm, TypeAnswerForm } from "./AnswerInputs";
import { type AnswerKey, formatNumber, keyText, outcomeOf, type Pick, pickOf } from "@/lib/questionTypes";
import { GameLook } from "@/components/live/GameLook";
import { Buddy, Confetti } from "@/components/live/LookArt";
import { LastSecondsTicks, PlayerBadge, SoundToggle } from "@/components/live/GameBits";
import { lookBand, lookWords } from "@/lib/gameLook";
import { type GameSoundName, useGameSound } from "@/lib/gameSound";
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
  /** Wave 1b: the question's type and how it is answered; missing from an older game server (a quiz question). */
  qtype?: string;
  pick?: Pick;
  /** SLIDER: the scale, without the answer. */
  slider?: SliderShown;
  /** CATEGORISE: categories and shuffled items, without the correct assignments. */
  categorise?: CategoriseShown;
  /** SLIDE: its title (the text is the body). */
  title?: string;
}

/** How this question is answered, read from {@code pick}, else from its type. */
const pickFor = (q: Question): Pick => q.pick ?? pickOf(q.qtype);

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
  /** Wave 1b: the judged share from 0 to 1 (partial points), and false for a poll, which is never right or wrong. */
  fraction?: number;
  counted?: boolean;
}

/** The key of the question that just closed (Wave 1b "closed" message). */
interface ClosedKey {
  index: number;
  qtype: string;
  correctIndexes: number[];
  key: AnswerKey;
  /** Wave 3: the worked solution, sent only once the question has closed; null when there is none. */
  solution: string | null;
}

/** What this player sent, shown while they wait: a shape for a single choice, otherwise words. */
interface Sent {
  shape: number | null;
  text: string;
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

type View = "connecting" | "lobby" | "intro" | "question" | "slide" | "answered" | "result" | "final" | "out";

/**
 * A student's device in a live game. The question and options come from the server without the key;
 * after the question closes the server says whether the answer was right and how many points it earned.
 */
export function PlayerGame({ url, pin, ticket, name, quizTitle, brand, lookGrade = null, compact = false, backUrl = null }: {
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
  /** For a student who came from their school's own system: their dashboard there, offered when the game ends. */
  backUrl?: string | null;
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
  const [sent, setSent] = useState<Sent | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [final, setFinal] = useState<Final | null>(null);
  // The right answer of the question that just closed, so a wrong answer can show it.
  const [closedKey, setClosedKey] = useState<ClosedKey | null>(null);
  // The question on screen, for the message handler (a slide's closing sends no result to show).
  const shownQuestion = useRef<Question | null>(null);
  const band = lookBand(lookGrade);
  const words = lookWords(band);
  const { sound: playSound, buzz, muted, toggle } = useGameSound(band);
  // The class simulator shows many players on one screen: they stay silent.
  const sound = useCallback((name: GameSoundName) => { if (!compact) playSound(name); }, [compact, playSound]);
  const live = useRef<LiveConnection | null>(null);
  const serverNow = useCallback(() => live.current?.serverNow() ?? Date.now(), []);

  const onMessage = useCallback((m: LiveMessage) => {
    // A question opens: a slide shows "Look at the screen"; everything else is answered.
    const opened = (q: Question) => {
      setQuestion(q);
      shownQuestion.current = q;
      setSent(null);
      setView(pickFor(q) === "none" ? "slide" : "question");
    };
    switch (m.type) {
      case "joined":
        if (m.name) setShownName(String(m.name));
        setTitle(String(m.quizTitle ?? ""));
        setScore(Number(m.score ?? 0));
        setTeam(Number(m.team ?? 0));
        if (m.question && !m.answered) {
          opened(m.question as unknown as Question);
        } else if (m.question && m.answered) {
          setQuestion(m.question as unknown as Question);
          shownQuestion.current = m.question as unknown as Question;
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
        opened(m as unknown as Question);
        break;
      case "closed": {
        const ci = Number(m.correctIndex);
        setClosedKey({
          index: Number(m.index),
          qtype: String(m.qtype ?? "QUIZ"),
          correctIndexes: Array.isArray(m.correctIndexes) ? (m.correctIndexes as number[]) : ci >= 0 ? [ci] : [],
          key: (m.key as AnswerKey) ?? {},
          solution: typeof m.solution === "string" && m.solution.trim() ? m.solution : null,
        });
        break;
      }
      case "answerAck":
        if (m.accepted === false && m.message) setMessage(String(m.message));
        break;
      case "result": {
        setScore(Number(m.score));
        // Nobody answers a slide: if a result comes for one, there is nothing to show.
        const q = shownQuestion.current;
        if (q && q.index === Number(m.index) && pickFor(q) === "none") break;
        setResult(m as unknown as Result);
        setMessage(null);
        setView("result");
        break;
      }
      case "final":
        setFinal(m as unknown as Final);
        setScore(Number(m.score ?? 0));
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

  // Each player's own sounds: joining, their answer's result, and how they finished.
  useEffect(() => {
    if (view === "lobby") sound("joined");
    if (view === "result" && result) {
      const o = outcomeOf(result);
      if (o === "vote") sound("tap");
      else sound(o === "correct" || o === "partial" ? "correct" : "wrong");
      if (!compact && o !== "vote") buzz(o === "correct" || o === "partial" ? 60 : [40, 60, 40]);
    }
    if (view === "final" && final) sound(final.rank <= 3 ? "fanfare" : "joined");
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Sends one answer in its contract form: {choice} for one pick, {answer: {...}} for the other kinds. */
  function send(given: { choice: number } | { answer: Record<string, unknown> }, shown: Sent) {
    if (!question || sent !== null) return;
    sound("tap");
    setSent(shown);
    setMessage(null);
    live.current?.send({ type: "answer", index: question.index, ...given });
    setView("answered");
  }

  const pick = question ? pickFor(question) : "one";
  const outcome = result ? outcomeOf(result) : null;
  const key = result && closedKey && question && closedKey.index === result.index && question.index === result.index ? closedKey : null;
  const oneRight = key && key.correctIndexes.length === 1 && pickOf(key.qtype) === "one" ? key.correctIndexes[0] : null;
  const shownAnswer = key && question && (outcome === "wrong" || outcome === "partial" || outcome === "none")
    ? keyText(key.qtype, key.key, question.choices, key.correctIndexes, question.slider?.step ?? 1) : null;

  return (
    <GameLook grade={lookGrade} kind={compact ? "compact" : "player"}>
      <header className="gl-bar">
        {compact ? <span className="brand">{shownName}</span> : <OwnerBrandMark brand={brand} />}
        <span className="gl-spacer" />
        {!compact && <span className="gl-who">{shownName}</span>}
        {team > 0 && <TeamBadge team={team} />}
        <span className="gl-pill">{score.toLocaleString()} pts</span>
        {status === "reconnecting" && <span className="gl-pill" role="status">Reconnecting…</span>}
        {!compact && <SoundToggle muted={muted} onToggle={toggle} compact />}
        {!compact && (
          <a className="gl-quiet" href="/home"
             onClick={(e) => { if (!window.confirm("Leave this game? Your score so far is kept.")) e.preventDefault(); }}>
            Leave
          </a>
        )}
      </header>
      {view === "final" && final && final.rank <= 3 && <Confetti band={band} />}
      <main className="gl-main">
        {message && <div className="gl-alert" role="alert">{message}</div>}
        {view === "connecting" && <div className="gl-center"><p className="gl-sub">Joining game {pin}…</p></div>}
        {view === "lobby" && (
          <div className="gl-center gl-in">
            {lookGrade !== null && lookGrade <= 5 ? <Buddy grade={lookGrade} /> : <PlayerBadge name={shownName} size={96} />}
            <div>
              <div className="gl-sub">You&apos;re in!</div>
              <div className="gl-big gl-name">{shownName}</div>
            </div>
            {team > 0 && <TeamBadge team={team} big />}
            <div className="gl-card gl-waiting">
              <span className="gl-waiting-title">{title}</span>
              <span>Look for your name on the big screen. The game starts soon<span className="gl-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></span>
            </div>
          </div>
        )}
        {view === "intro" && intro && <IntroCountdown intro={intro} serverNow={serverNow} tick={() => sound("tick")} />}
        {view === "question" && question && (
          <>
            <div className="gl-row" style={{ justifyContent: "space-between" }}>
              <span className="gl-pill">{question.index + 1} of {question.total}</span>
              {question.timed !== false && <GameTimer band={band} openedAt={question.openedAt} closesAt={question.closesAt} serverNow={serverNow} />}
            </div>
            {question.timed !== false && !compact && <LastSecondsTicks until={question.closesAt} serverNow={serverNow} tick={() => sound("tick")} />}
            {!compact && (
              <h1 className="gl-card gl-q">
                {question.visual && <span className="gl-visual" aria-hidden="true">{question.visual}</span>}{question.text}
              </h1>
            )}
            {pick === "one" && (
              <div className="gl-tiles gl-in" data-count={question.choices.length}>
                {question.choices.map((c, i) => (
                  <GameTile key={i} index={i} text={compact ? "" : c} onClick={() => send({ choice: i }, { shape: i, text: c })} />
                ))}
              </div>
            )}
            {pick === "many" && (
              <MultiSelectForm variant="game" choices={question.choices} compact={compact}
                               onSubmit={(choices) => send({ answer: { choices } },
                                 { shape: null, text: choices.map((i) => question.choices[i]).join(", ") })} />
            )}
            {pick === "text" && (
              <TypeAnswerForm variant="game" onSubmit={(text) => send({ answer: { text } }, { shape: null, text })} />
            )}
            {pick === "number" && question.slider && (
              <SliderForm variant="game" slider={question.slider}
                          onSubmit={(value) => send({ answer: { value } },
                            { shape: null, text: formatNumber(value, question.slider!.step, question.slider!.unit ?? "") })} />
            )}
            {pick === "order" && (
              <OrderList key={question.index} items={question.choices} busy={false} className="gl-card gl-order stack"
                         submitLabel="Lock in my order"
                         onSubmit={(order) => send({ answer: { order } }, { shape: null, text: order.map((i) => question.choices[i]).join(" → ") })} />
            )}
            {pick === "categorise" && question.categorise && (
              <CategoriseForm key={question.index} variant="game" data={question.categorise}
                              onSubmit={(categories) => send({ answer: { categories } },
                                { shape: null, text: Object.keys(categories).length + " items sorted" })} />
            )}
          </>
        )}
        {view === "slide" && question && (
          <div className="gl-center gl-in">
            <Buddy grade={lookGrade} />
            <div className="gl-big">Look at the screen</div>
            {question.title && <div className="gl-card gl-waiting"><span className="gl-waiting-title">{question.title}</span></div>}
            <div className="gl-sub">Your teacher moves on when everyone has read it.</div>
          </div>
        )}
        {view === "answered" && (
          <div className="gl-center gl-in">
            <Buddy grade={lookGrade} />
            <div className="gl-big">Answer in!</div>
            {sent && (
              <div className="gl-card gl-chosen">
                <span className="gl-sub">Your answer</span>
                <span className="gl-answer">
                  {sent.shape !== null && <AnswerShape index={sent.shape} color={`var(--a${shapeNumber(sent.shape)})`} />}{sent.text}
                </span>
              </div>
            )}
            <div className="gl-sub">Waiting for the others<span className="gl-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></div>
          </div>
        )}
        {view === "result" && result && outcome && (
          <div className="gl-center gl-in">
            <Buddy grade={lookGrade} mood={outcome === "wrong" || outcome === "none" ? "sad" : "happy"} />
            <div className={"gl-card gl-result " + (outcome === "correct" ? "ok" : outcome === "partial" ? "partial" : outcome === "vote" ? "vote" : "no")}
                 role="status">
              <div className="gl-result-icon gl-on-large" aria-hidden="true">
                {outcome === "correct" ? "✓" : outcome === "partial" ? "◐" : outcome === "vote" ? "★" : outcome === "wrong" ? "✕" : "⏱"}
              </div>
              <div className="gl-big">
                {outcome === "correct" ? words.correct : outcome === "partial" ? "Partly right" : outcome === "vote" ? "Thanks for voting"
                  : outcome === "wrong" ? words.wrong : words.timeUp}
              </div>
              {outcome === "partial" && result.fraction !== undefined && (
                <div className="gl-sub">{Math.round(result.fraction * 100)}% of the way there</div>
              )}
              {(outcome === "correct" || outcome === "partial") && (
                <>
                  <div className="pts">+{result.points.toLocaleString()} points</div>
                  {result.streakBonus > 0 && <div>🔥 Streak {result.streak} · +{result.streakBonus} bonus</div>}
                </>
              )}
              {shownAnswer && (
                <div className="gl-sub">
                  The answer was{" "}
                  <span className="gl-answer">
                    {oneRight !== null && <AnswerShape index={oneRight} color={`var(--a${shapeNumber(oneRight)})`} />}{shownAnswer}
                  </span>
                </div>
              )}
              <div className="gl-sub">You are {ordinal(result.rank)} of {result.players} · {result.score.toLocaleString()} points</div>
              {result.team && result.teamRank && (
                <div className="gl-sub"><TeamBadge team={result.team} /> is {ordinal(result.teamRank)} of {result.teams} teams</div>
              )}
            </div>
            {key?.solution && (
              <details className="gl-card steps">
                <summary>Show the steps</summary>
                <ol className="steps-list">
                  {key.solution.split("\n").map((line) => line.trim()).filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
                </ol>
              </details>
            )}
          </div>
        )}
        {view === "final" && final && (
          <div className="gl-center gl-in">
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
            {backUrl && <a className="gl-btn gl-btn-big" href={backUrl}>Back to my dashboard</a>}
          </div>
        )}
        {view === "out" && !message && (
          <div className="gl-center">
            <div className="gl-big">This game has ended.</div>
            {backUrl && <a className="gl-btn gl-btn-big" href={backUrl}>Back to my dashboard</a>}
          </div>
        )}
      </main>
    </GameLook>
  );
}

function IntroCountdown({ intro, serverNow, tick }: {
  intro: { index: number; total: number; startsAt: number };
  serverNow: () => number;
  tick: () => void;
}) {
  const left = useCountdown(intro.startsAt, serverNow);
  useEffect(() => {
    if (left > 0) tick();
  }, [left]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="gl-intro gl-in">
      <h2>Question {intro.index + 1} of {intro.total}</h2>
      <div className="n" aria-live="polite">{left || "…"}</div>
      <p style={{ margin: 0 }}>Get ready</p>
    </div>
  );
}
