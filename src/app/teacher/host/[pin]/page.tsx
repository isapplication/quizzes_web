"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { GAME_MODES, GameTimer, TeamBadge, useCountdown } from "@/components/Stage";
import { GameLook } from "@/components/live/GameLook";
import { Buddy, Confetti } from "@/components/live/LookArt";
import { LastSecondsTicks, PlayerBadge, SoundToggle, TalkCountdown } from "@/components/live/GameBits";
import { lookBand, lookWords, type Band } from "@/lib/gameLook";
import { useGameSound, useLobbyMusic } from "@/lib/gameSound";
import { CharacterAvatar } from "@/components/live/CharacterAvatar";
import { LobbyMusic } from "@/components/live/LobbyMusic";
import { api } from "@/lib/api";
import { connectLive, LiveConnection, LiveMessage, LiveStatus } from "@/lib/live";
import { MeProvider, ownBrand, ShownBrand, useMe } from "@/lib/me";
import { formatPin } from "@/lib/pin";
import { isCharacter } from "@/lib/characters";
import { OwnerBrandMark, useOwnerBrand } from "@/components/OwnerBrand";
import { JoinQr, RoomPatternCard } from "@/components/live/JoinExtras";
import { HostOpenAnswers, HostQuestionPicture, HostResults, HostSlide, type HostClosed, type HostQuestion } from "@/components/live/HostQuestion";
import { NO_REACTIONS, reactionCounts, type ReactionCounts } from "@/lib/media";
import { questionSpeech, ReadAloudButton, useAutoRead, useReadAloudSetting } from "@/lib/readAloud";
import { type Pick, pickOf } from "@/lib/questionTypes";
import { BrainstormResults, BrainstormWall, ClassAnswerPanel, type IdeasState, LectureSummary, type SummaryRow }
  from "@/components/live/ClassAnswer";
import { QuestionImageView } from "@/components/ImageQuestion";

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
  /** A shared team device: the first names of the people on it. */
  members?: string[];
  /** The player's built-in character (0 to 23); missing for none. */
  character?: number;
}

interface TeamStanding {
  rank: number;
  team: number;
  score: number;
  members: number;
  /** Wave 2d: the team's name. */
  name?: string;
}

/** One device per player: each team's best player, shown on the podium. */
interface BestPlayer {
  team: number;
  teamName: string;
  name: string;
  score: number;
}

interface Ranked {
  rank: number;
  id: string;
  name: string;
  score: number;
  /** The player's built-in character (0 to 23); missing for none. */
  character?: number;
}

interface Question extends HostQuestion {
  total: number;
  visual?: string | null;
  openedAt: number;
  closesAt: number;
  /** False in an accuracy game: no countdown, the teacher closes the question. */
  timed?: boolean;
  /** Team talk: answers open (and the timer starts) at this server time. */
  talkEndsAt?: number;
}

interface Closed extends HostClosed {
  answered: number;
  leaderboard: Ranked[];
  teams?: TeamStanding[];
  last: boolean;
}

const pickFor = (q: { pick?: Pick; qtype?: string }): Pick => q.pick ?? pickOf(q.qtype);

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
  const [podium, setPodium] = useState<{ top: Ranked[]; leaderboard: Ranked[]; teams?: TeamStanding[];
    ranked?: boolean; summary?: SummaryRow[]; bestPlayers?: BestPlayer[] } | null>(null);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const [teamDevices, setTeamDevices] = useState("EACH");
  const [teamTalk, setTeamTalk] = useState(0);
  // A brainstorm question's wall (Wave 2i).
  const [ideas, setIdeas] = useState<IdeasState | null>(null);
  const [mode, setMode] = useState("CLASSIC");
  // Unplugged: nobody joins; the teacher answers for the class. Confidence: players may boost their answers.
  const [playersJoin, setPlayersJoin] = useState(true);
  const [confidence, setConfidence] = useState(false);
  const [teamCount, setTeamCount] = useState(0);
  // After a question closes: its answers first, then the leaderboard when the teacher asks for it.
  const [showBoard, setShowBoard] = useState(false);
  // How the class reacts to the slide on screen (part 2g), and whether questions are read aloud (part 2f; off until chosen).
  const [reactions, setReactions] = useState<ReactionCounts>(NO_REACTIONS);
  const [readAloud, setReadAloud] = useReadAloudSetting();
  const look = game?.lookGrade ?? null;
  const band = lookBand(look);
  const words = lookWords(band);
  const { sound, muted, toggle } = useGameSound(band);
  const lobbyMusic = useLobbyMusic(band, view === "lobby" && !!game, muted);
  const live = useRef<LiveConnection | null>(null);
  const serverNow = useCallback(() => live.current?.serverNow() ?? Date.now(), []);

  const onMessage = useCallback((m: LiveMessage) => {
    switch (m.type) {
      case "state": {
        setMode(String(m.mode ?? "CLASSIC"));
        setTeamCount(Number(m.teamCount ?? 0));
        setPlayersJoin(m.playersJoin !== false);
        setConfidence(m.confidence === true);
        setTeamNames((m.teamNames as string[]) ?? []);
        setTeamDevices(String(m.teamDevices ?? "EACH"));
        setTeamTalk(Number(m.teamTalkSeconds ?? 0));
        setPlayers((m.players as Player[]) ?? []);
        setPlayerCount(Number(m.count ?? (m.players as Player[] | undefined)?.length ?? 0));
        const phase = String(m.phase);
        if (phase === "LOBBY") setView("lobby");
        if (phase === "QUESTION" && m.question) {
          setIdeas((m.ideas as IdeasState | undefined) ?? null);
          setQuestion(m.question as unknown as Question);
          setReactions(reactionCounts(m.reactions));
          setAnswered({ answered: Number(m.answered ?? 0), expected: Number(m.expected ?? 0) });
          setView("question");
        }
        if ((phase === "RESULTS" || phase === "INTRO") && m.lastQuestion) {
          const lq = m.lastQuestion as Record<string, unknown>;
          setQuestion({ index: Number(lq.index), total: Number(m.total), text: String(lq.text), visual: (lq.visual as string) ?? null,
            choices: (lq.choices as string[]) ?? [], openedAt: 0, closesAt: 0, qtype: lq.qtype as string | undefined,
            pick: lq.pick as Pick | undefined, slider: lq.slider as HostQuestion["slider"], title: lq.title as string | undefined,
            scale: lq.scale as HostQuestion["scale"], image: lq.image as HostQuestion["image"], reveal: lq.reveal === true,
            choiceImages: lq.choiceImages as HostQuestion["choiceImages"] });
          setClosed({ index: Number(lq.index), correctIndex: Number(lq.correctIndex), explanation: (lq.explanation as string) ?? null,
            counts: (lq.counts as number[]) ?? [], answered: 0, leaderboard: (m.leaderboard as Ranked[]) ?? [],
            teams: (m.teams as TeamStanding[]) ?? undefined, last: Number(lq.index) + 1 >= Number(m.total),
            qtype: lq.qtype as string | undefined, correctIndexes: lq.correctIndexes as number[] | undefined,
            key: lq.key as HostClosed["key"], stats: lq.stats as HostClosed["stats"],
            shown: typeof lq.shown === "boolean" ? lq.shown : undefined });
          setView("results");
        }
        if (phase === "PODIUM") {
          setPodium({ top: ((m.leaderboard as Ranked[]) ?? []).slice(0, 3), leaderboard: (m.leaderboard as Ranked[]) ?? [],
            teams: (m.teams as TeamStanding[]) ?? undefined, ranked: m.ranked !== false, summary: m.summary as SummaryRow[] | undefined,
            bestPlayers: m.bestPlayers as BestPlayer[] | undefined });
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
        setIdeas(null);
        setQuestion(m as unknown as Question);
        setReactions(NO_REACTIONS);
        setAnswered({ answered: 0, expected: Number(m.expected ?? 0) });
        setView("question");
        break;
      case "answers":
        setAnswered({ answered: Number(m.answered), expected: Number(m.expected) });
        break;
      case "reactions":
        setReactions(reactionCounts(m));
        break;
      case "closed":
        // A slide has no results: the server moves straight on to the next question.
        if (m.qtype === "SLIDE") break;
        setClosed(m as unknown as Closed);
        setShowBoard(false);
        setView("results");
        break;
      case "ideas":
        setIdeas(m as unknown as IdeasState);
        break;
      case "moderated":
        // The teacher hid an answer: the stats come again without it.
        setClosed((c) => (c && c.index === Number(m.index) ? { ...c, stats: m.stats as HostClosed["stats"], answered: Number(m.answered) } : c));
        break;
      case "shown":
        setClosed((c) => (c && c.index === Number(m.index) ? { ...c, shown: true } : c));
        break;
      case "podium":
        setPodium({ top: (m.top as Ranked[]) ?? [], leaderboard: (m.leaderboard as Ranked[]) ?? [], teams: (m.teams as TeamStanding[]) ?? undefined,
          ranked: m.ranked !== false, summary: m.summary as SummaryRow[] | undefined, bestPlayers: m.bestPlayers as BestPlayer[] | undefined });
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

  // The family's sounds: the reveal, and a fanfare for the podium. The lobby music is useLobbyMusic's.
  useEffect(() => {
    if (view === "results") sound("reveal");
    if (view === "podium") sound("fanfare");
  }, [view, sound]);

  // The host's option "Read questions aloud": each new question is read on this screen, in this person's language.
  const spoken = view === "question" && question && pickFor(question) !== "none"
    ? questionSpeech(question.text, question.choices, question.choiceImages) : null;
  const canSpeak = useAutoRead(readAloud && view === "question", spoken, me.locale);

  const joinUrl = typeof window === "undefined" ? "" : window.location.host + "/play";
  const lastQuestion = closed?.last ?? false;

  return (
    <GameLook grade={look} kind="host" background={shown.backgroundUrl}>
      <header className="gl-bar">
        <OwnerBrandMark brand={shown} />
        <span className="gl-spacer" />
        {game && <span className="gl-pill">{game.quizTitle}{game.classCode && <> · Class {game.classCode}</>}</span>}
        <span className="gl-pill" role="status">{status === "connected" ? "● Live" : status === "reconnecting" ? "Reconnecting…" : status}</span>
        <SoundToggle muted={muted} onToggle={toggle} />
        {canSpeak && (
          <label className="gl-quiet gl-read-aloud-option">
            <input type="checkbox" checked={readAloud} onChange={(e) => setReadAloud(e.target.checked)} /> Read questions aloud
          </label>
        )}
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

        {view === "lobby" && game && !playersJoin && (
          <div className="gl-center gl-in">
            <Buddy grade={look} />
            <h1 className="gl-title">Unplugged game</h1>
            <p style={{ margin: 0, maxWidth: 640, textAlign: "center" }}>
              No devices for students: show each question, let the class talk it over, then tap the class&apos;s answer
              on this screen and reveal it. Nobody joins with a PIN.
            </p>
            <button type="button" className="gl-btn gl-btn-big" onClick={() => send("start")}>Start game</button>
          </div>
        )}

        {view === "lobby" && game && playersJoin && (
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
              {mode === "TEAM" && teamDevices !== "SHARED" && <> · {teamCount} teams, filled as players join</>}
              {mode === "TEAM" && teamDevices === "SHARED" && <> · {teamCount} teams, one device each</>}
              {mode === "TEAM" && teamTalk > 0 && <> · {teamTalk} seconds of team talk per question</>}
              {mode === "ACCURACY" && <> · no timer: you close each question</>}
              {mode === "LECTURE" && <> · no timer, no points: you close each question</>}
              {confidence && <> · Confidence on: players may boost their answers</>}
            </p>
            {mode === "TEAM" && teamCount > 0 && (
              <div className="gl-row center">
                {Array.from({ length: teamCount }, (_, i) => i + 1).map((t) => (
                  <span key={t} className="gl-row" style={{ gap: 6 }}>
                    <TeamBadge team={t} name={teamNames[t - 1]} /> {players.filter((p) => p.team === t).length}
                  </span>
                ))}
              </div>
            )}
            <LobbyMusic tune={lobbyMusic.tune} volume={lobbyMusic.volume} muted={muted}
                        onTune={lobbyMusic.setTune} onVolume={lobbyMusic.setVolume} />
            <div className="gl-row">
              <span className="gl-pill">{playerCount} {playerCount === 1 ? "player" : "players"}</span>
              <span className="gl-spacer" />
              <button type="button" className="gl-btn gl-btn-big" disabled={playerCount === 0} onClick={() => send("start")}>
                Start game
              </button>
            </div>
            {mode === "TEAM" && teamCount > 0 && players.length > 0 && (
              <TeamLobby players={players} teamCount={teamCount} names={teamNames} canMove={teamDevices !== "SHARED"}
                         onMove={(playerId, team) => send("moveTeam", { playerId, team })}
                         onKick={(p) => window.confirm(`Remove ${p.name} from the game?`) && send("kick", { playerId: p.id })} />
            )}
            <ul className="gl-chips gl-in" aria-label="Players" hidden={mode === "TEAM" && teamCount > 0}>
              {players.map((p, i) => (
                <li key={p.id} className={"gl-chip" + (p.connected ? "" : " away")} style={{ "--i": Math.min(i, 20) } as CSSProperties}>
                  {isCharacter(p.character) ? <CharacterAvatar character={p.character} size={30} /> : <PlayerBadge name={p.name} size={26} />}
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

        {view === "question" && question && pickFor(question) === "none" && (
          <HostSlide question={question} last={question.index + 1 >= question.total} onNext={() => send("next")} reactions={reactions} />
        )}

        {view === "question" && question && pickFor(question) !== "none" && (
          <>
            <div className="gl-row">
              <span className="gl-pill">Question {question.index + 1} of {question.total}</span>
              <span className="gl-spacer" />
              {question.timed !== false && band !== "h912" && (
                <GameTimer band={band} openedAt={question.openedAt} closesAt={question.closesAt} serverNow={serverNow} />
              )}
              {playersJoin && <div className="gl-answered" aria-live="polite"><b>{answered.answered}</b>of {answered.expected} answered</div>}
              {!playersJoin ? <button type="button" className="gl-quiet" onClick={() => send("skip")}>Skip</button>
                : question.timed === false
                ? <button type="button" className="gl-btn" onClick={() => send("skip")}>Close question</button>
                : <button type="button" className="gl-quiet" onClick={() => send("skip")}>Skip</button>}
            </div>
            {question.timed !== false && band === "h912" && (
              <GameTimer band={band} openedAt={question.openedAt} closesAt={question.closesAt} serverNow={serverNow} />
            )}
            {question.timed !== false && <LastSecondsTicks until={question.closesAt} serverNow={serverNow} tick={() => sound("tick")} />}
            {question.talkEndsAt && <TalkCountdown until={question.talkEndsAt} serverNow={serverNow} host />}
            <div className="gl-q-row gl-in">
              <h1 className="gl-card gl-q">
                {question.visual && <span className="gl-visual" aria-hidden="true">{question.visual}</span>}{question.text}
              </h1>
              <ReadAloudButton text={questionSpeech(question.text, question.choices, question.choiceImages)} locale={me.locale} />
              <Buddy grade={look} className="gl-buddy-side" />
            </div>
            {question.image && pickFor(question) !== "point" && (question.reveal
              ? <QuestionImageView image={question.image} reveal openedAt={question.talkEndsAt ?? question.openedAt}
                                   closesAt={question.closesAt} serverNow={serverNow} />
              : <HostQuestionPicture question={question} />)}
            {pickFor(question) === "ideas" && playersJoin && ideas && ideas.index === question.index ? (
              <BrainstormWall state={ideas} onHide={(id) => send("hide", { index: question.index, id })}
                              onMerge={(ids) => send("merge", { index: question.index, ids })}
                              onShow={() => send("show", { index: question.index })} onNext={() => send("next")} />
            ) : playersJoin ? <HostOpenAnswers question={question} />
              : <ClassAnswerPanel key={question.index} question={question}
                                  onAnswer={(answer) => send("classAnswer", { index: question.index, answer })} />}
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
            {pickFor(question) !== "point" && <HostQuestionPicture question={question} />}
            {(closed.qtype ?? question.qtype) === "BRAINSTORM" ? (
              <BrainstormResults ideas={((closed.stats as { ideas?: { id: string; text: string; votes: number }[] } | undefined)?.ideas) ?? []} />
            ) : <HostResults question={question} closed={closed}
                         moderation={{ onHide: (id) => send("hide", { index: closed.index, id }), onShow: () => send("show", { index: closed.index }) }} />}
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

        {view === "podium" && podium && podium.ranked === false && (
          <>
            <h1 className="gl-title">That&apos;s the end of the lecture</h1>
            <LectureSummary rows={podium.summary ?? []} />
            <div className="gl-row center">
              {game && <Link className="gl-btn" href={"/teacher/games/" + game.gameId}>See the full report</Link>}
            </div>
          </>
        )}

        {view === "podium" && podium && podium.ranked !== false && (
          <>
            <Confetti band={band} />
            <h1 className="gl-title">{!playersJoin ? "The class finished!" : words.podium}</h1>
            {podium.teams && podium.teams.length > 0 && (
              <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
                <TeamStandings teams={podium.teams.slice(0, 3)}
                               title={(podium.teams[0].name ?? "Team " + podium.teams[0].team) + " wins!"} />
                {podium.bestPlayers && podium.bestPlayers.length > 0 && (
                  <>
                    <h2 style={{ margin: "16px 0 8px" }}>Each team&apos;s best player</h2>
                    <ul className="team-standings">
                      {podium.bestPlayers.map((b) => (
                        <li key={b.team}>
                          <TeamBadge team={b.team} name={b.teamName} />
                          <span>{b.name}</span>
                          <span className="spacer" />
                          <span>{b.score.toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
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
          <span className="nm">{isCharacter(r.character) && <CharacterAvatar character={r.character} size={36} className="gl-char-row" />}{r.name}</span>
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
          {isCharacter(top[i].character) ? <CharacterAvatar character={top[i].character} size={96} className="gl-char-podium" />
            : i === 0 && band === "k2" && <Buddy grade={grade} mood="happy" />}
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
            <TeamBadge team={t.team} name={t.name} big />
            <span style={{ opacity: 0.8, fontSize: 16 }}>{t.members} {t.members === 1 ? "player" : "players"}</span>
            <span className="spacer" />
            <span>{t.score} <span style={{ fontSize: 14 }}>average</span></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * One device per player: the lobby grouped by team, with a "Move to" menu (a native select, so it works from the
 * keyboard and a screen reader) on each player. One device per team: each device with its first names.
 */
function TeamLobby({ players, teamCount, names, canMove, onMove, onKick }: {
  players: Player[];
  teamCount: number;
  names: string[];
  canMove: boolean;
  onMove: (playerId: string, team: number) => void;
  onKick: (p: Player) => void;
}) {
  return (
    <div className="gl-team-lobby gl-in">
      {Array.from({ length: teamCount }, (_, i) => i + 1).map((t) => {
        const here = players.filter((p) => p.team === t);
        const name = names[t - 1] ?? "Team " + t;
        return (
          <section key={t} className="gl-card gl-team-col" aria-label={name}>
            <h2><TeamBadge team={t} name={name} /> <span className="gl-sub">{here.length}</span></h2>
            <ul>
              {here.map((p) => (
                <li key={p.id} className={p.connected ? "" : "away"}>
                  {isCharacter(p.character) && <CharacterAvatar character={p.character} size={30} />}
                  <span className="nm">{p.name}</span>
                  {p.members && p.members.length > 0 && <span className="gl-sub">{p.members.join(", ")}</span>}
                  {canMove && (
                    <select aria-label={"Move " + p.name + " to another team"} value={t}
                            onChange={(e) => onMove(p.id, Number(e.target.value))}>
                      {Array.from({ length: teamCount }, (_, k) => k + 1).map((o) => (
                        <option key={o} value={o}>{o === t ? "Move to…" : names[o - 1] ?? "Team " + o}</option>
                      ))}
                    </select>
                  )}
                  <button type="button" className="gl-quiet" aria-label={"Remove " + p.name} onClick={() => onKick(p)}>×</button>
                </li>
              ))}
              {here.length === 0 && <li className="gl-sub">Nobody yet</li>}
            </ul>
          </section>
        );
      })}
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
