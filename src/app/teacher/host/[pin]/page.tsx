"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { GAME_MODES, GameTile, GameTimer, TeamBadge, useCountdown } from "@/components/Stage";
import { GameLook } from "@/components/live/GameLook";
import { Buddy, Confetti } from "@/components/live/LookArt";
import { LastSecondsTicks, PlayerBadge, SoundToggle } from "@/components/live/GameBits";
import { lookBand, lookWords, type Band } from "@/lib/gameLook";
import { lobbyLength, useGameSound } from "@/lib/gameSound";
import { api } from "@/lib/api";
import { connectLive, LiveConnection, LiveMessage, LiveStatus } from "@/lib/live";
import { MeProvider, ownBrand, ShownBrand, useMe } from "@/lib/me";
import { formatPin } from "@/lib/pin";
import { OwnerBrandMark, useOwnerBrand } from "@/components/OwnerBrand";
import { JoinQr, RoomPatternCard } from "@/components/live/JoinExtras";

interface Hosted {
  gameId: string;
  pin: string;
  quizTitle: string;
  classCode: string | null;
  cometdUrl: string;
  ticket: string;
  questionCount: number;
  brand: ShownBrand;
  /** The grade (0 to 12) whose game look the screens use; null for a game from before game looks. */
  lookGrade: number | null;
  /** Players must tap the pattern on this screen to join with the PIN. */
  roomCheck?: boolean;
}

interface Player {
  id: string;
  name: string;
  connected: boolean;
  score: number;
  /** 1 to the team count in a team game; 0 otherwise. */
  team: number;
  /** Joined with the PIN and a nickname, not signed in. */
  guest?: boolean;
}

interface TeamStanding {
  rank: number;
  team: number;
  score: number;
  members: number;
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
  visual?: string | null;
  choices: string[];
  openedAt: number;
  closesAt: number;
  /** False in an accuracy game: no countdown, the teacher closes the question. */
  timed?: boolean;
}

interface Closed {
  index: number;
  correctIndex: number;
  explanation: string | null;
  counts: number[];
  answered: number;
  leaderboard: Ranked[];
  teams?: TeamStanding[];
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
  const [podium, setPodium] = useState<{ top: Ranked[]; leaderboard: Ranked[]; teams?: TeamStanding[] } | null>(null);
  const [mode, setMode] = useState("CLASSIC");
  const [teamCount, setTeamCount] = useState(0);
  // After a question closes: its answers first, then the leaderboard when the teacher asks for it.
  const [showBoard, setShowBoard] = useState(false);
  const look = game?.lookGrade ?? null;
  const band = lookBand(look);
  const words = lookWords(band);
  const { sound, muted, toggle } = useGameSound(band);
  const live = useRef<LiveConnection | null>(null);
  const serverNow = useCallback(() => live.current?.serverNow() ?? Date.now(), []);

  const onMessage = useCallback((m: LiveMessage) => {
    switch (m.type) {
      case "state": {
        setMode(String(m.mode ?? "CLASSIC"));
        setTeamCount(Number(m.teamCount ?? 0));
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
          setQuestion({ index: Number(lq.index), total: Number(m.total), text: String(lq.text), visual: (lq.visual as string) ?? null,
            choices: lq.choices as string[], openedAt: 0, closesAt: 0 });
          setClosed({ index: Number(lq.index), correctIndex: Number(lq.correctIndex), explanation: (lq.explanation as string) ?? null,
            counts: lq.counts as number[], answered: 0, leaderboard: (m.leaderboard as Ranked[]) ?? [],
            teams: (m.teams as TeamStanding[]) ?? undefined, last: Number(lq.index) + 1 >= Number(m.total) });
          setView("results");
        }
        if (phase === "PODIUM") {
          setPodium({ top: ((m.leaderboard as Ranked[]) ?? []).slice(0, 3), leaderboard: (m.leaderboard as Ranked[]) ?? [],
            teams: (m.teams as TeamStanding[]) ?? undefined });
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
        setShowBoard(false);
        setView("results");
        break;
      case "podium":
        setPodium({ top: (m.top as Ranked[]) ?? [], leaderboard: (m.leaderboard as Ranked[]) ?? [], teams: (m.teams as TeamStanding[]) ?? undefined });
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

  // The family's sounds: a lobby tune while players join, the reveal, and a fanfare for the podium.
  useEffect(() => {
    if (view !== "lobby" || !game) return;
    sound("lobby");
    const id = setInterval(() => sound("lobby"), lobbyLength(band) + 1500);
    return () => clearInterval(id);
  }, [view, game, band, sound]);
  useEffect(() => {
    if (view === "results") sound("reveal");
    if (view === "podium") sound("fanfare");
  }, [view, sound]);

  const joinUrl = typeof window === "undefined" ? "" : window.location.host + "/play";
  const lastQuestion = closed?.last ?? false;

  return (
    <GameLook grade={look} kind="host">
      <header className="gl-bar">
        <OwnerBrandMark brand={shown} />
        <span className="gl-spacer" />
        {game && <span className="gl-pill">{game.quizTitle}{game.classCode && <> · Class {game.classCode}</>}</span>}
        <span className="gl-pill" role="status">{status === "connected" ? "● Live" : status === "reconnecting" ? "Reconnecting…" : status}</span>
        <SoundToggle muted={muted} onToggle={toggle} />
        {view !== "podium" && view !== "lobby" && (
          <button type="button" className="gl-quiet" onClick={() => window.confirm("End the game now and show the podium?") && send("end")}>
            End game
          </button>
        )}
        {(view === "podium" || view === "lobby") && (
          <a className="gl-quiet" href="/home?tab=games"
             onClick={(e) => { if (view === "lobby" && !window.confirm("Leave the lobby? Players who joined will be sent away.")) e.preventDefault(); }}>
            Back to My quizzes
          </a>
        )}
      </header>
      <main className="gl-main">
        {error && <div className="gl-alert danger" role="alert">{error}</div>}

        {view === "lobby" && game && (
          <>
            <div className="gl-lobby-top gl-in">
              <div className="gl-card gl-join" style={{ "--i": 0 } as CSSProperties}>
                <span>Join on any device at</span>
                <b>{joinUrl}</b>
              </div>
              <div className="gl-card gl-pin-card" style={{ "--i": 1 } as CSSProperties}>
                <div className="lbl">Game PIN</div>
                <div className="gl-pin" aria-label={"Game PIN " + game.pin.split("").join(" ")}>{formatPin(game.pin)}</div>
              </div>
              <div className="gl-card gl-qr-card" style={{ "--i": 2 } as CSSProperties}>
                <JoinQr url={window.location.origin + "/play?pin=" + game.pin} pin={game.pin} />
              </div>
              {game.roomCheck && <RoomPatternCard pin={game.pin} />}
              <Buddy grade={look} className="gl-buddy-lobby" />
            </div>
            <p style={{ textAlign: "center", margin: 0 }}>
              {GAME_MODES.find((g) => g.value === mode)?.label ?? "Classic"} game
              {mode === "TEAM" && <> · {teamCount} teams, filled as players join</>}
              {mode === "ACCURACY" && <> · no timer: you close each question</>}
            </p>
            {mode === "TEAM" && teamCount > 0 && (
              <div className="gl-row center">
                {Array.from({ length: teamCount }, (_, i) => i + 1).map((t) => (
                  <span key={t} className="gl-row" style={{ gap: 6 }}>
                    <TeamBadge team={t} /> {players.filter((p) => p.team === t).length}
                  </span>
                ))}
              </div>
            )}
            <div className="gl-row">
              <span className="gl-pill">{playerCount} {playerCount === 1 ? "player" : "players"}</span>
              <span className="gl-spacer" />
              <button type="button" className="gl-btn gl-btn-big" disabled={playerCount === 0} onClick={() => send("start")}>
                Start game
              </button>
            </div>
            <ul className="gl-chips gl-in" aria-label="Players">
              {players.map((p, i) => (
                <li key={p.id} className={"gl-chip" + (p.connected ? "" : " away")} style={{ "--i": Math.min(i, 20) } as CSSProperties}>
                  <PlayerBadge name={p.name} size={26} />
                  {p.team > 0 && <TeamBadge team={p.team} />}
                  {p.name}
                  {p.guest && <span className="gl-guest">Guest</span>}
                  <button type="button" title={"Remove " + p.name} aria-label={"Remove " + p.name}
                    onClick={() => window.confirm(`Remove ${p.name} from the game?`) && send("kick", { playerId: p.id })}>
                    ×
                  </button>
                </li>
              ))}
              {playerCount > players.length && <li className="gl-chip away">+{playerCount - players.length} more</li>}
            </ul>
            {playerCount === 0 && <p style={{ textAlign: "center", margin: 0 }}>Waiting for students to join with the PIN…</p>}
          </>
        )}

        {view === "intro" && intro && <Intro intro={intro} serverNow={serverNow} grade={look} />}

        {view === "question" && question && (
          <>
            <div className="gl-row">
              <span className="gl-pill">Question {question.index + 1} of {question.total}</span>
              <span className="gl-spacer" />
              {question.timed !== false && band !== "h912" && (
                <GameTimer band={band} openedAt={question.openedAt} closesAt={question.closesAt} serverNow={serverNow} />
              )}
              <div className="gl-answered" aria-live="polite"><b>{answered.answered}</b>of {answered.expected} answered</div>
              {question.timed === false
                ? <button type="button" className="gl-btn" onClick={() => send("skip")}>Close question</button>
                : <button type="button" className="gl-quiet" onClick={() => send("skip")}>Skip</button>}
            </div>
            {question.timed !== false && band === "h912" && (
              <GameTimer band={band} openedAt={question.openedAt} closesAt={question.closesAt} serverNow={serverNow} />
            )}
            {question.timed !== false && <LastSecondsTicks until={question.closesAt} serverNow={serverNow} tick={() => sound("tick")} />}
            <div className="gl-q-row gl-in">
              <h1 className="gl-card gl-q">
                {question.visual && <span className="gl-visual" aria-hidden="true">{question.visual}</span>}{question.text}
              </h1>
              <Buddy grade={look} className="gl-buddy-side" />
            </div>
            <div className="gl-tiles gl-in">
              {question.choices.map((c, i) => <GameTile key={i} index={i} text={c} />)}
            </div>
          </>
        )}

        {view === "results" && closed && question && !showBoard && (
          <>
            <div className="gl-row">
              <span className="gl-pill">Question {closed.index + 1} of {question.total}</span>
              <span className="gl-spacer" />
              <button type="button" className="gl-btn gl-btn-big" onClick={() => (closed.leaderboard.length > 0 ? setShowBoard(true) : send("next"))}>
                {closed.leaderboard.length > 0 ? (band === "m68" ? "High scores" : "Leaderboard") : lastQuestion ? "Show podium" : "Next question"}
              </button>
            </div>
            <div className="gl-q-row gl-in">
              <h1 className="gl-card gl-q">
                {question.text}
                {closed.explanation && <span className="gl-explain">{closed.explanation}</span>}
              </h1>
              <Buddy grade={look} mood="happy" className="gl-buddy-side" />
            </div>
            <div className="gl-tiles gl-in">
              {question.choices.map((c, i) => (
                <GameTile key={i} index={i} text={c} count={closed.counts[i]} state={i === closed.correctIndex ? "correct" : "dim"} />
              ))}
            </div>
          </>
        )}

        {view === "results" && closed && question && showBoard && (
          <>
            <div className="gl-row">
              <span className="gl-pill">After question {closed.index + 1} of {question.total}</span>
              <span className="gl-spacer" />
              <button type="button" className="gl-btn gl-btn-big" onClick={() => send("next")}>
                {lastQuestion ? "Show podium" : "Next question"}
              </button>
            </div>
            {closed.teams && closed.teams.length > 0 && <TeamStandings teams={closed.teams} title="Teams" />}
            <h2 className="gl-title">{closed.teams && closed.teams.length > 0 ? "Top players" : words.leaderboard}</h2>
            <Board rows={closed.leaderboard} />
          </>
        )}

        {view === "podium" && podium && (
          <>
            <Confetti band={band} />
            <h1 className="gl-title">{words.podium}</h1>
            {podium.teams && podium.teams.length > 0 && (
              <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
                <TeamStandings teams={podium.teams} title={"Team " + podium.teams[0].team + " wins!"} />
              </div>
            )}
            <Podium top={podium.top} grade={look} band={band} />
            <div className="gl-row center">
              {game && <Link className="gl-btn" href={"/teacher/games/" + game.gameId}>See the full report</Link>}
            </div>
            {podium.leaderboard.length > 3 && <Board rows={podium.leaderboard} />}
          </>
        )}
      </main>
    </GameLook>
  );
}

function Board({ rows }: { rows: Ranked[] }) {
  return (
    <ol className="gl-board gl-in">
      {rows.map((r, i) => (
        <li key={r.id} style={{ "--i": Math.min(i, 10) } as CSSProperties}>
          <span className="rk gl-on">{r.rank}</span>
          <span className="nm">{r.name}</span>
          <span className="sc">{r.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

/** First place in the middle, second on the left, third on the right; each block says its place in words too. */
function Podium({ top, grade, band }: { top: Ranked[]; grade: number | null; band: Band }) {
  const places = ["First", "Second", "Third"];
  return (
    <div className="gl-podium gl-in">
      {[1, 0, 2].map((i) => top[i] && (
        <div key={top[i].id} className={"col p" + (i + 1)} style={{ "--i": [1, 0, 2][i] } as CSSProperties}>
          {i === 0 && band === "k2" && <Buddy grade={grade} mood="happy" />}
          <div className="who">{top[i].name}</div>
          <div className="pts">{top[i].score.toLocaleString()} points</div>
          <div className="block gl-on-large" aria-label={places[i] + " place"}>{top[i].rank}</div>
        </div>
      ))}
    </div>
  );
}

/** Teams in order of their average score; each row shows the team's badge, so colour is never the only cue. */
function TeamStandings({ teams, title }: { teams: TeamStanding[]; title: string }) {
  return (
    <div>
      <h2 style={{ marginBottom: 10 }}>{title}</h2>
      <ol className="team-standings">
        {teams.map((t) => (
          <li key={t.team}>
            <span>{t.rank}.</span>
            <TeamBadge team={t.team} big />
            <span style={{ opacity: 0.8, fontSize: 16 }}>{t.members} {t.members === 1 ? "player" : "players"}</span>
            <span className="spacer" />
            <span>{t.score} <span style={{ fontSize: 14 }}>average</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Intro({ intro, serverNow, grade }: { intro: { index: number; total: number; startsAt: number }; serverNow: () => number; grade: number | null }) {
  const left = useCountdown(intro.startsAt, serverNow);
  return (
    <div className="gl-intro gl-in">
      <h2>Question {intro.index + 1} of {intro.total}</h2>
      <div className="n" aria-live="polite">{left || "…"}</div>
      <p style={{ margin: 0 }}>Get ready</p>
      <Buddy grade={grade} className="gl-buddy-side" />
    </div>
  );
}
