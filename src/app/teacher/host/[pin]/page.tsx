"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnswerTile, TimerBar, useCountdown } from "@/components/Stage";
import { api } from "@/lib/api";
import { connectLive, LiveConnection, LiveMessage, LiveStatus } from "@/lib/live";
import { MeProvider, ownBrand, ShownBrand, useMe } from "@/lib/me";
import { formatPin } from "@/lib/pin";
import { OwnerBrandMark, useOwnerBrand } from "@/components/OwnerBrand";

interface Hosted {
  gameId: string;
  pin: string;
  quizTitle: string;
  classCode: string | null;
  cometdUrl: string;
  ticket: string;
  questionCount: number;
  brand: ShownBrand;
}

interface Player {
  id: string;
  name: string;
  connected: boolean;
  score: number;
}

interface Ranked {
  rank: number;
  id: string;
  name: string;
  score: number;
}

interface Question {
  index: number;
  total: number;
  text: string;
  choices: string[];
  openedAt: number;
  closesAt: number;
}

interface Closed {
  index: number;
  correctIndex: number;
  explanation: string | null;
  counts: number[];
  answered: number;
  leaderboard: Ranked[];
  last: boolean;
}

type View = "lobby" | "intro" | "question" | "results" | "podium";

export default function HostPage() {
  return (
    <MeProvider>
      <HostScreen />
    </MeProvider>
  );
}

function HostScreen() {
  const { pin } = useParams<{ pin: string }>();
  const me = useMe();
  const [game, setGame] = useState<Hosted | null>(null);
  // The game's host school's look; your own school's until the game has loaded.
  const shown = game?.brand ?? ownBrand(me);
  useOwnerBrand(game?.brand);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("lobby");
  const [players, setPlayers] = useState<Player[]>([]);
  // The server lists at most 200 names; the count is always the full number.
  const [playerCount, setPlayerCount] = useState(0);
  const [intro, setIntro] = useState<{ index: number; total: number; startsAt: number } | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [answered, setAnswered] = useState({ answered: 0, expected: 0 });
  const [closed, setClosed] = useState<Closed | null>(null);
  const [podium, setPodium] = useState<{ top: Ranked[]; leaderboard: Ranked[] } | null>(null);
  const live = useRef<LiveConnection | null>(null);
  const serverNow = useCallback(() => live.current?.serverNow() ?? Date.now(), []);

  const onMessage = useCallback((m: LiveMessage) => {
    switch (m.type) {
      case "state": {
        setPlayers((m.players as Player[]) ?? []);
        setPlayerCount(Number(m.count ?? (m.players as Player[] | undefined)?.length ?? 0));
        const phase = String(m.phase);
        if (phase === "LOBBY") setView("lobby");
        if (phase === "QUESTION" && m.question) {
          setQuestion(m.question as unknown as Question);
          setAnswered({ answered: Number(m.answered ?? 0), expected: Number(m.expected ?? 0) });
          setView("question");
        }
        if ((phase === "RESULTS" || phase === "INTRO") && m.lastQuestion) {
          const lq = m.lastQuestion as Record<string, unknown>;
          setQuestion({ index: Number(lq.index), total: Number(m.total), text: String(lq.text), choices: lq.choices as string[], openedAt: 0, closesAt: 0 });
          setClosed({ index: Number(lq.index), correctIndex: Number(lq.correctIndex), explanation: (lq.explanation as string) ?? null,
            counts: lq.counts as number[], answered: 0, leaderboard: (m.leaderboard as Ranked[]) ?? [], last: Number(lq.index) + 1 >= Number(m.total) });
          setView("results");
        }
        if (phase === "PODIUM") {
          setPodium({ top: ((m.leaderboard as Ranked[]) ?? []).slice(0, 3), leaderboard: (m.leaderboard as Ranked[]) ?? [] });
          setView("podium");
        }
        break;
      }
      case "lobby":
        setPlayers((m.players as Player[]) ?? []);
        setPlayerCount(Number(m.count ?? (m.players as Player[] | undefined)?.length ?? 0));
        break;
      case "intro":
        setIntro({ index: Number(m.index), total: Number(m.total), startsAt: Number(m.startsAt) });
        setView("intro");
        break;
      case "question":
        setQuestion(m as unknown as Question);
        setAnswered({ answered: 0, expected: Number(m.expected ?? 0) });
        setView("question");
        break;
      case "answers":
        setAnswered({ answered: Number(m.answered), expected: Number(m.expected) });
        break;
      case "closed":
        setClosed(m as unknown as Closed);
        setView("results");
        break;
      case "podium":
        setPodium({ top: (m.top as Ranked[]) ?? [], leaderboard: (m.leaderboard as Ranked[]) ?? [] });
        setView("podium");
        break;
      case "error":
        setError(String(m.message));
        break;
    }
  }, []);

  useEffect(() => {
    let connection: LiveConnection | null = null;
    let cancelled = false;
    api<Hosted>(`/api/v1/live/games/${pin}/host`)
      .then(async (g) => {
        if (cancelled) return;
        setGame(g);
        connection = await connectLive({
          url: g.cometdUrl,
          pin: g.pin,
          ticket: g.ticket,
          role: "host",
          onMessage,
          onStatus: (s, message) => {
            setStatus(s);
            if (message && s === "failed") setError(message);
          },
        });
        live.current = connection;
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      connection?.close();
    };
  }, [pin, onMessage]);

  const send = (type: string, extra: Record<string, unknown> = {}) => {
    setError(null);
    live.current?.send({ type, ...extra });
  };

  const joinUrl = typeof window === "undefined" ? "" : window.location.host + "/play";

  return (
    <div className="stage">
      <div className="stage-bar">
        <OwnerBrandMark brand={shown} />
        <span className="spacer" />
        {game && <span>{game.quizTitle}{game.classCode && <> · Class {game.classCode}</>}</span>}
        <span className="status-pill">{status === "connected" ? `Live · ${live.current?.transport() ?? ""}` : status}</span>
        {view !== "podium" && view !== "lobby" && (
          <button className="btn btn-light" onClick={() => window.confirm("End the game now and show the podium?") && send("end")}>
            End game
          </button>
        )}
        {(view === "podium" || view === "lobby") && (
          <a className="btn btn-light" href="/home?tab=games"
             onClick={(e) => { if (view === "lobby" && !window.confirm("Leave the lobby? Players who joined will be sent away.")) e.preventDefault(); }}>
            Back to My quizzes
          </a>
        )}
      </div>
      <main className="stage-main">
        {error && <div className="alert alert-danger">{error}</div>}

        {view === "lobby" && game && (
          <>
            <div className="row" style={{ justifyContent: "center", gap: 24 }}>
              <div className="pin-box">
                <div>Join at <strong>{joinUrl}</strong></div>
                <div className="muted" style={{ color: "var(--muted)" }}>Game PIN</div>
                <div className="pin">{formatPin(game.pin)}</div>
              </div>
            </div>
            <div className="row">
              <h2>{playerCount} {playerCount === 1 ? "player" : "players"}</h2>
              <span className="spacer" />
              <button className="btn btn-primary" style={{ fontSize: 20 }} disabled={playerCount === 0} onClick={() => send("start")}>
                Start game
              </button>
            </div>
            <div className="player-chips">
              {players.map((p) => (
                <span key={p.id} className={"player-chip" + (p.connected ? "" : " away")}>
                  {p.name}
                  <button type="button" title={"Remove " + p.name} aria-label={"Remove " + p.name}
                    onClick={() => window.confirm(`Remove ${p.name} from the game?`) && send("kick", { playerId: p.id })}>
                    ×
                  </button>
                </span>
              ))}
              {playerCount > players.length && <span className="player-chip away">+{playerCount - players.length} more</span>}
              {playerCount === 0 && <p className="muted">Waiting for students to join with the PIN…</p>}
            </div>
          </>
        )}

        {view === "intro" && intro && <Intro intro={intro} serverNow={serverNow} />}

        {view === "question" && question && (
          <>
            <div className="row">
              <span>Question {question.index + 1} of {question.total}</span>
              <span className="spacer" />
              <Countdown closesAt={question.closesAt} serverNow={serverNow} />
              <button className="btn btn-light" onClick={() => send("skip")}>Skip</button>
            </div>
            <TimerBar openedAt={question.openedAt} closesAt={question.closesAt} serverNow={serverNow} />
            <div className="question-text">{question.text}</div>
            <div className="row" style={{ justifyContent: "center" }}>
              <div className="big-number">{answered.answered}</div>
              <div>of {answered.expected} answered</div>
            </div>
            <div className="answer-grid">
              {question.choices.map((c, i) => (
                <AnswerTile key={i} index={i} text={c} />
              ))}
            </div>
          </>
        )}

        {view === "results" && closed && question && (
          <>
            <div className="row">
              <span>Question {closed.index + 1} of {question.total}</span>
              <span className="spacer" />
              <button className="btn btn-primary" style={{ fontSize: 20 }} onClick={() => send("next")}>
                {closed.last ? "Show podium" : "Next question"}
              </button>
            </div>
            <div className="question-text">{question.text}</div>
            <div className="answer-grid">
              {question.choices.map((c, i) => (
                <AnswerTile key={i} index={i} text={c} count={closed.counts[i]}
                  state={i === closed.correctIndex ? "correct" : "wrong"} />
              ))}
            </div>
            {closed.explanation && <div className="card">{closed.explanation}</div>}
            {closed.leaderboard.length > 0 && (
              <div>
                <h2 style={{ marginBottom: 10 }}>Leaderboard</h2>
                <ol className="leaderboard">
                  {closed.leaderboard.map((r) => (
                    <li key={r.id}><span>{r.rank}. {r.name}</span><span>{r.score}</span></li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}

        {view === "podium" && podium && (
          <>
            <h1 style={{ textAlign: "center" }}>Podium</h1>
            <div className="podium">
              {[1, 0, 2].map((i) => podium.top[i] && (
                <div key={podium.top[i].id}>
                  <div className="name">{podium.top[i].name}</div>
                  <div>{podium.top[i].score} points</div>
                  <div className="block" style={{ height: [200, 150, 110][i] }}>{podium.top[i].rank}</div>
                </div>
              ))}
            </div>
            <p className="muted" style={{ textAlign: "center" }}>
              {game && <Link className="btn btn-light" href={"/teacher/games/" + game.gameId}>See the full report</Link>}
            </p>
            <ol className="leaderboard" style={{ maxWidth: 700, margin: "0 auto", width: "100%" }}>
              {podium.leaderboard.map((r) => (
                <li key={r.id}><span>{r.rank}. {r.name}</span><span>{r.score}</span></li>
              ))}
            </ol>
          </>
        )}
      </main>
    </div>
  );
}

function Intro({ intro, serverNow }: { intro: { index: number; total: number; startsAt: number }; serverNow: () => number }) {
  const left = useCountdown(intro.startsAt, serverNow);
  return (
    <div style={{ textAlign: "center", marginTop: 80 }}>
      <h2>Question {intro.index + 1} of {intro.total}</h2>
      <div className="big-number" style={{ fontSize: 120, margin: 30 }}>{left || "…"}</div>
      <p className="muted">Get ready</p>
    </div>
  );
}

function Countdown({ closesAt, serverNow }: { closesAt: number; serverNow: () => number }) {
  const left = useCountdown(closesAt, serverNow);
  return <div className="big-number" aria-label={left + " seconds left"}>{left}</div>;
}
