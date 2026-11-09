"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameTile, GameTimer, ordinal, TeamBadge, useCountdown } from "./Stage";
import { AnswerShape, shapeNumber } from "./AnswerShape";
import { OrderList } from "./ActivityRound";
import { CategoriseForm, type CategoriseShown, FreeTextForm, IdeasForm, MultiSelectForm, ScaleForm, type ScaleShown, type SliderShown,
  SliderForm, TypeAnswerForm, VotesForm } from "./AnswerInputs";
import { type AnswerKey, formatNumber, keyText, outcomeOf, type Pick, pickOf } from "@/lib/questionTypes";
import { GameLook } from "@/components/live/GameLook";
import { PinForm, QuestionImageView } from "@/components/ImageQuestion";
import { Buddy, Confetti } from "@/components/live/LookArt";
import { LastSecondsTicks, PlayerBadge, SoundToggle, TalkCountdown } from "@/components/live/GameBits";
import { lookBand, lookWords } from "@/lib/gameLook";
import { type GameSoundName, useGameSound } from "@/lib/gameSound";
import { connectLive, LiveConnection, LiveMessage, LiveStatus } from "@/lib/live";
import { OwnerBrandMark, useOwnerBrand } from "@/components/OwnerBrand";
import { Picture } from "@/components/Picture";
import { ReactionButtons } from "@/components/live/SlideExtras";
import { type ShownPicture } from "@/lib/media";
import { questionSpeech, ReadAloudButton } from "@/lib/readAloud";
import type { ShownBrand } from "@/lib/me";
import { CharacterAvatar } from "@/components/live/CharacterAvatar";
import { isCharacter } from "@/lib/characters";

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
  /** Confidence (Wave 2c): the boosts this question takes (50, 75, 100); missing when it takes none. */
  boosts?: number[];
  /** Team talk (Wave 2d): answers open (and the timer starts) at this server time. */
  talkEndsAt?: number;
  /** SCALE (Wave 2e): its ends and labels. */
  scale?: ScaleShown;
  /** WORD_CLOUD, OPEN_ENDED: the longest answer in characters. */
  maxLength?: number;
  /** Wave 2f: the question's picture (pin questions draw on it) and each answer's picture (null where an answer has none). */
  image?: ShownPicture;
  choiceImages?: (ShownPicture | null)[];
  /** Wave 2h: whether the picture uncovers in steps (quiz, type answer). */
  reveal?: boolean;
  /** Wave 2i: a brainstorm's limits. */
  brainstorm?: { maxIdeas: number; maxLength: number; maxVotes: number };
}

/** A brainstorm's votes round, as the server sends it to this player (their own ideas marked). */
interface VoteRound {
  index: number;
  ideas: { id: string; text: string; mine: boolean }[];
  maxVotes: number;
  closesAt: number;
  voted?: boolean;
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
  /** Team games: the player's team, its name, its place and its average score. */
  team?: number;
  teamName?: string;
  teamRank?: number;
  teamScore?: number;
  teams?: number;
  /** Wave 1b: the judged share from 0 to 1 (partial points), and false for a poll, which is never right or wrong. */
  fraction?: number;
  counted?: boolean;
  /** Wave 2c: the Confidence boost won (positive) or lost (negative); false for a Lecture, which has no ranks. */
  boost?: number;
  ranked?: boolean;
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
  teamName?: string;
  teamRank?: number;
  teams?: number;
  /** False for a Lecture: no ranks and no points. */
  ranked?: boolean;
}

type View = "connecting" | "lobby" | "intro" | "question" | "slide" | "answered" | "result" | "final" | "out";

/**
 * A student's device in a live game. The question and options come from the server without the key;
 * after the question closes the server says whether the answer was right and how many points it earned.
 */
export function PlayerGame({ url, pin, ticket, name, quizTitle, brand, lookGrade = null, compact = false, backUrl = null, character = null }: {
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
  /** The player's built-in character (0 to 23) from the join page; the game server confirms it. Null for none. */
  character?: number | null;
}) {
  useOwnerBrand(brand);
  const [myCharacter, setMyCharacter] = useState<number | null>(isCharacter(character) ? character : null);
  // The game server may add a number to a guest's nickname to keep names different ("Sam 2").
  const [shownName, setShownName] = useState(name);
  const [view, setView] = useState<View>("connecting");
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState(quizTitle ?? "");
  const [score, setScore] = useState(0);
  const [team, setTeam] = useState(0);
  const [teamName, setTeamName] = useState<string | null>(null);
  // Team talk: true until answers open on this question (the server refuses answers before then anyway).
  const [talking, setTalking] = useState(false);
  const [intro, setIntro] = useState<{ index: number; total: number; startsAt: number } | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [final, setFinal] = useState<Final | null>(null);
  // The right answer of the question that just closed, so a wrong answer can show it.
  const [closedKey, setClosedKey] = useState<ClosedKey | null>(null);
  // Confidence: the answer is in and the boost not chosen yet (null: no choice to make); the boost once chosen.
  const [boostPending, setBoostPending] = useState(false);
  const [boost, setBoost] = useState<number | null>(null);
  // A Lecture has no points or ranks.
  const [ranked, setRanked] = useState(true);
  // Free text the server refused (a rude word, too long): its reason and what was sent, to change and send again.
  const [refused, setRefused] = useState<{ message: string; text: string } | null>(null);
  const [votes, setVotes] = useState<VoteRound | null>(null);
  // The reaction this player chose on the slide on screen (part 2g): one each, a new one replaces it.
  const [reaction, setReaction] = useState<number | null>(null);
  // The question on screen, for the message handler (a slide's closing sends no result to show).
  const shownQuestion = useRef<Question | null>(null);
  // The text of the last free-text answer sent, for the message handler.
  const sentText = useRef("");
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
      setBoostPending(false);
      setBoost(null);
      setRefused(null);
      setVotes(null);
      setTalking(!!q.talkEndsAt && q.talkEndsAt > (live.current?.serverNow() ?? Date.now()));
      setReaction(null);
      setView(pickFor(q) === "none" ? "slide" : "question");
    };
    switch (m.type) {
      case "joined":
        if (m.name) setShownName(String(m.name));
        if (isCharacter(m.character)) setMyCharacter(m.character);
        setTitle(String(m.quizTitle ?? ""));
        setScore(Number(m.score ?? 0));
        setTeam(Number(m.team ?? 0));
        setTeamName((m.teamName as string) ?? null);
        setRanked(m.ranked !== false);
        setReaction(typeof m.reaction === "number" ? m.reaction : null);
        if (m.votes && !(m.votes as VoteRound).voted) {
          // Rejoined during a brainstorm's votes round.
          setQuestion(m.question as unknown as Question);
          shownQuestion.current = m.question as unknown as Question;
          setVotes(m.votes as unknown as VoteRound);
          setSent(null);
          setView("question");
        } else if (m.question && !m.answered) {
          opened(m.question as unknown as Question);
        } else if (m.question && m.answered) {
          setQuestion(m.question as unknown as Question);
          shownQuestion.current = m.question as unknown as Question;
          setBoostPending(m.boostPending === true);
          setView("answered");
        } else {
          setView(m.phase === "PODIUM" ? "final" : "lobby");
        }
        break;
      case "team":
        // The teacher moved this player to another team in the lobby.
        setTeam(Number(m.team ?? 0));
        setTeamName((m.teamName as string) ?? null);
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
        if (m.accepted === false && m.rejected === true) {
          // Back to the question with the reason, so the player can change the answer (W10, W11).
          setRefused({ message: String(m.message ?? "Try a different answer."), text: sentText.current });
          setSent(null);
          setView("question");
          break;
        }
        if (m.accepted === false && m.message) setMessage(String(m.message));
        if (m.accepted === true) setBoostPending(m.boostPending === true);
        break;
      case "reactAck":
        if (m.accepted === false && m.message) setMessage(String(m.message));
        break;
      case "votes":
        // A brainstorm's votes round has started.
        setVotes(m as unknown as VoteRound);
        setQuestion((q) => (q ? { ...q, closesAt: Number(m.closesAt), openedAt: q.closesAt } : q));
        setSent(null);
        setMessage(null);
        setView("question");
        break;
      case "boostAck":
        if (m.accepted === true) {
          setBoost(Number(m.boost));
          setBoostPending(false);
        } else if (m.message) {
          setMessage(String(m.message));
          setBoostPending(false);
        }
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
    sentText.current = shown.text;
    live.current?.send({ type: "answer", index: question.index, ...given });
    setView("answered");
  }

  /** Confidence: sends this player's boost (0 is "No boost") for the question they just answered. */
  function chooseBoost(value: number) {
    if (!question || !boostPending) return;
    sound("tap");
    setBoostPending(false);
    setBoost(value);
    live.current?.send({ type: "boost", index: question.index, boost: value });
  }

  const pick = question ? pickFor(question) : "one";
  const outcome = result ? outcomeOf(result) : null;
  const key = result && closedKey && question && closedKey.index === result.index && question.index === result.index ? closedKey : null;
  const oneRight = key && key.correctIndexes.length === 1 && pickOf(key.qtype) === "one" ? key.correctIndexes[0] : null;
  const shownAnswer = key && question && (outcome === "wrong" || outcome === "partial" || outcome === "none")
    ? keyText(key.qtype, key.key, question.choices, key.correctIndexes, question.slider?.step ?? 1) : null;

  return (
    <GameLook grade={lookGrade} kind={compact ? "compact" : "player"} background={brand?.backgroundUrl}>
      <header className="gl-bar">
        {compact ? <span className="brand">{shownName}</span> : <OwnerBrandMark brand={brand} />}
        <span className="gl-spacer" />
        {!compact && <span className="gl-who">{shownName}</span>}
        {team > 0 && <TeamBadge team={team} name={teamName} />}
        {ranked && <span className="gl-pill">{score.toLocaleString()} pts</span>}
        {status === "reconnecting" && <span className="gl-pill" role="status">Reconnecting…</span>}
        {!compact && <SoundToggle muted={muted} onToggle={toggle} compact />}
        {!compact && (
          <a className="gl-quiet" href="/home"
             onClick={(e) => { if (!window.confirm("Leave this game? Your score so far is kept.")) e.preventDefault(); }}>
            Leave
          </a>
        )}
      </header>
      {view === "final" && final && final.ranked !== false && final.rank <= 3 && <Confetti band={band} />}
      <main className="gl-main">
        {message && <div className="gl-alert" role="alert">{message}</div>}
        {view === "connecting" && <div className="gl-center"><p className="gl-sub">Joining game {pin}…</p></div>}
        {view === "lobby" && (
          <div className="gl-center gl-in">
            {myCharacter !== null ? <CharacterAvatar character={myCharacter} size={120} className="gl-char-big" />
              : lookGrade !== null && lookGrade <= 5 ? <Buddy grade={lookGrade} /> : <PlayerBadge name={shownName} size={96} />}
            <div>
              <div className="gl-sub">You&apos;re in!</div>
              <div className="gl-big gl-name">{shownName}</div>
            </div>
            {team > 0 && <TeamBadge team={team} name={teamName} big />}
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
              {question.timed !== false && !talking && (
                <GameTimer band={band} openedAt={question.talkEndsAt ?? question.openedAt} closesAt={question.closesAt} serverNow={serverNow} />
              )}
            </div>
            {talking && question.talkEndsAt && (
              <TalkUntil until={question.talkEndsAt} serverNow={serverNow} onDone={() => setTalking(false)} />
            )}
            {question.timed !== false && !compact && <LastSecondsTicks until={question.closesAt} serverNow={serverNow} tick={() => sound("tick")} />}
            {!compact && (
              <div className="gl-q-with-speaker">
                <h1 className="gl-card gl-q">
                  {question.visual && <span className="gl-visual" aria-hidden="true">{question.visual}</span>}{question.text}
                </h1>
                <ReadAloudButton text={questionSpeech(question.text, question.choices, question.choiceImages)} />
              </div>
            )}
            {question.image && pick !== "point" && !compact && (question.reveal
              ? <QuestionImageView image={question.image} reveal openedAt={question.talkEndsAt ?? question.openedAt}
                                   closesAt={question.closesAt} serverNow={serverNow} />
              : <Picture picture={question.image} className="gl-q-picture" main />)}
            {pick === "point" && question.image && (
              <PinForm key={question.index} variant="game" image={question.image}
                       onSubmit={(point) => send({ answer: { point } }, { shape: null, text: `Pin at ${Math.round(point.x * 100)}% across, ${Math.round(point.y * 100)}% down` })} />
            )}
            {pick === "one" && (
              <div className="gl-tiles gl-in" data-count={question.choices.length}>
                {question.choices.map((c, i) => (
                  <GameTile key={i} index={i} text={compact ? "" : c} picture={compact ? null : question.choiceImages?.[i]}
                            onClick={talking ? undefined : () => send({ choice: i }, { shape: i, text: c })} />
                ))}
              </div>
            )}
            {!talking && pick === "many" && (
              <MultiSelectForm variant="game" choices={question.choices} compact={compact} pictures={compact ? undefined : question.choiceImages}
                               onSubmit={(choices) => send({ answer: { choices } },
                                 { shape: null, text: choices.map((i) => question.choices[i]).join(", ") })} />
            )}
            {!talking && pick === "text" && (
              <TypeAnswerForm variant="game" onSubmit={(text) => send({ answer: { text } }, { shape: null, text })} />
            )}
            {!talking && pick === "number" && question.slider && (
              <SliderForm variant="game" slider={question.slider}
                          onSubmit={(value) => send({ answer: { value } },
                            { shape: null, text: formatNumber(value, question.slider!.step, question.slider!.unit ?? "") })} />
            )}
            {!talking && pick === "order" && (
              <OrderList key={question.index} items={question.choices} busy={false} className="gl-card gl-order stack"
                         submitLabel="Lock in my order"
                         onSubmit={(order) => send({ answer: { order } }, { shape: null, text: order.map((i) => question.choices[i]).join(" → ") })} />
            )}
            {pick === "scale" && question.scale && (
              <ScaleForm key={question.index} variant="game" scale={question.scale}
                         onSubmit={(value) => send({ answer: { value } }, { shape: null, text: String(value) })} />
            )}
            {pick === "ideas" && !votes && (
              <IdeasForm key={question.index + (refused ? ":" + refused.message : "")} variant="game"
                         max={question.brainstorm?.maxIdeas ?? 3} maxLength={question.brainstorm?.maxLength ?? 40}
                         error={refused?.message ?? null} initial={refused ? refused.text.split("\n") : []}
                         onSubmit={(ideas) => send({ answer: { ideas } }, { shape: null, text: ideas.join("\n") })} />
            )}
            {pick === "ideas" && votes && (
              <VotesForm key={"v" + question.index} variant="game" ideas={votes.ideas} max={votes.maxVotes}
                         onSubmit={(ids) => send({ answer: { votes: ids } },
                           { shape: null, text: ids.map((id) => votes.ideas.find((i) => i.id === id)?.text ?? "").join(", ") })} />
            )}
            {(pick === "word" || pick === "long") && (
              <FreeTextForm key={question.index + (refused ? ":" + refused.message + refused.text : "")} variant="game"
                            long={pick === "long"} max={question.maxLength ?? (pick === "long" ? 250 : 20)}
                            error={refused?.message ?? null} initial={refused?.text ?? ""}
                            onSubmit={(text) => send({ answer: { text } }, { shape: null, text })} />
            )}
            {!talking && pick === "categorise" && question.categorise && (
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
            {!compact && (
              <ReactionButtons current={reaction} onReact={(r) => {
                setReaction(r);
                live.current?.send({ type: "react", index: question.index, reaction: r });
              }} />
            )}
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
            {boostPending && question?.boosts && question.boosts.length > 0 && (
              <fieldset className="gl-card gl-boost">
                <legend className="gl-sub">How sure are you?</legend>
                <p id="boost-rule" className="gl-boost-rule">Bet extra points: you win them if you&apos;re right, and lose them if you&apos;re wrong.</p>
                <div className="gl-row center" style={{ flexWrap: "wrap" }}>
                  {question.boosts.map((b) => (
                    <button key={b} type="button" className="gl-btn gl-btn-big" aria-describedby="boost-rule"
                            onClick={() => chooseBoost(b)}>+{b}</button>
                  ))}
                  <button type="button" className="gl-quiet" onClick={() => chooseBoost(0)}>No boost</button>
                </div>
              </fieldset>
            )}
            {boost !== null && boost > 0 && <div className="gl-pill" role="status">Boost: {boost} points at stake</div>}
            {!boostPending && (
              <div className="gl-sub">Waiting for the others<span className="gl-dots" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></div>
            )}
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
                {outcome === "correct" ? words.correct : outcome === "partial" ? "Partly right"
                  : outcome === "vote" ? (question && pickFor(question) !== "one" ? "Thanks for sharing" : "Thanks for voting")
                  : outcome === "wrong" ? words.wrong : words.timeUp}
              </div>
              {outcome === "partial" && result.fraction !== undefined && (
                <div className="gl-sub">{Math.round(result.fraction * 100)}% of the way there</div>
              )}
              {(outcome === "correct" || outcome === "partial") && result.ranked !== false && (
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
              {result.boost !== undefined && result.boost !== 0 && (
                <div className={"gl-boost-result " + (result.boost > 0 ? "won" : "lost")}>
                  {result.boost > 0 ? `Boost won: +${result.boost}` : `Boost lost: ${result.boost}`}
                </div>
              )}
              {result.ranked !== false && (
                <div className="gl-sub">You are {ordinal(result.rank)} of {result.players} · {result.score.toLocaleString()} points</div>
              )}
              {result.team && result.teamRank && (
                <div className="gl-sub"><TeamBadge team={result.team} name={result.teamName} /> is {ordinal(result.teamRank)} of {result.teams} teams</div>
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
            {myCharacter !== null ? <CharacterAvatar character={myCharacter} size={96} className="gl-char-big" />
              : <Buddy grade={lookGrade} mood="happy" />}
            <div className="gl-sub">You finished</div>
            {final.ranked === false ? (
              <div className="gl-big">{final.correct} of {final.questions} right</div>
            ) : (
              <>
                <div className="gl-place">{ordinal(final.rank)}</div>
                <div className="gl-sub">of {final.players} · {final.score.toLocaleString()} points · {final.correct} of {final.questions} correct</div>
                {final.rank <= 3 && band !== "h912" && <span className="gl-pill">🏅 On the podium!</span>}
              </>
            )}
            {final.team && final.teamRank && (
              <div className="gl-sub">
                <TeamBadge team={final.team} name={final.teamName} /> finished {ordinal(final.teamRank)} of {final.teams} teams{final.teamRank === 1 ? " 🏆" : ""}
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

/** Team talk on the phone: a countdown, then the answers unlock. */
function TalkUntil({ until, serverNow, onDone }: { until: number; serverNow: () => number; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, Math.max(0, until - serverNow()));
    return () => clearTimeout(id);
  }, [until]); // eslint-disable-line react-hooks/exhaustive-deps
  return <TalkCountdown until={until} serverNow={serverNow} />;
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
