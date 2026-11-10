"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { QuestionResult, type ReportQuestion } from "@/components/QuestionResult";
import { GAME_MODES, TeamBadge } from "@/components/Stage";
import { api, ApiError } from "@/lib/api";
import { ReportActions } from "@/components/ReportActions";
import { hardQuestions } from "@/lib/reports";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";

interface Report {
  gameId: string;
  quizTitle: string;
  pin: string;
  status: string;
  classCode: string | null;
  requireSignIn: boolean;
  startedAt: string | null;
  endedAt: string | null;
  summary: { players: number; guests: number; averageScore: number; averageCorrectPercent: number; hardestQuestion: number | null };
  players: { rank: number; name: string; guest: boolean; score: number; correct: number; answered: number; questions: number;
    team: number | null; members?: string[] | null }[];
  /** CLASSIC, TEAM, ACCURACY, LECTURE or UNPLUGGED. */
  mode: string;
  /** False for a Lecture: no ranks (each rank is 0, players in name order). Missing from an older API: true. */
  ranked?: boolean;
  /** Team games: teams by their members' average score. */
  teams: { rank: number; team: number; score: number; players: number; name?: string }[];
  questions: ReportQuestion[];
}

export default function GameReportPage() {
  return (
    <AppFrame>
      <GameReport />
    </AppFrame>
  );
}

/** One game's results: how the class did, every player (guests marked) and each question's answers. */
function GameReport() {
  const { gameId } = useParams<{ gameId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Report>("/api/v1/live/games/" + gameId + "/report")
      .then(setReport)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load this report."));
  }, [gameId]);

  if (error && !report) return <div className="alert alert-danger">{error}</div>;
  if (!report) return <LoadingState rows={6} label="Loading the report" />;
  const s = report.summary;
  const finished = report.status === "FINISHED";
  const ranked = report.ranked !== false;
  const unplugged = report.mode === "UNPLUGGED";

  return (
    <div className="stack">
      <PageHeader title={report.quizTitle}
                  description={<>{report.startedAt ? new Date(report.startedAt).toLocaleString() : "Not started"}
                    {" · "}{unplugged ? "Played together on the classroom screen"
                      : report.requireSignIn ? "Signed-in students" + (report.classCode ? " of " + report.classCode : "") : "Anyone with the PIN"}
                    {" · "}{GAME_MODES.find((m) => m.value === report.mode)?.label ?? "Classic"} game</>}
                  action={finished && report.players.length > 0
                    ? <ReportActions filePath={{ csv: "/api/v1/live/games/" + gameId + "/report.csv", xlsx: "/api/v1/live/games/" + gameId + "/report.xlsx" }}
                                     fileName={report.quizTitle} reteachPath={"/api/v1/live/games/" + gameId + "/reteach"}
                                     aiReteachPath={"/api/v1/live/games/" + gameId + "/reteach-ai"}
                                     hard={hardQuestions(report.questions).length} onError={setError} /> : undefined} />
      {error && <div className="alert alert-danger">{error}</div>}
      {!finished && (
        <EmptyState title="This game hasn't finished yet">The report appears when the game reaches the podium.</EmptyState>
      )}
      {finished && (
        <>
          {!unplugged && (<div className="report-cards">
            <div className="card"><span className="muted">Players</span><strong>{s.players}</strong>
              {s.guests > 0 && <span className="muted">{s.guests} with a nickname</span>}</div>
            <div className="card"><span className="muted">Average correct</span><strong>{s.averageCorrectPercent}%</strong></div>
            {ranked && <div className="card"><span className="muted">Average score</span><strong>{s.averageScore}</strong></div>}
            <div className="card"><span className="muted">Hardest question</span>
              <strong>{s.hardestQuestion ? "Question " + s.hardestQuestion : "–"}</strong></div>
          </div>)}
          {unplugged && report.players[0] && (
            <div className="report-cards">
              <div className="card"><span className="muted">The class scored</span><strong>{report.players[0].score}</strong></div>
              <div className="card"><span className="muted">Right answers</span>
                <strong>{report.players[0].correct} of {report.players[0].questions}</strong></div>
            </div>
          )}

          {report.teams.length > 0 && (
            <>
              <h2>Teams</h2>
              <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="report-teams-caption">
                <table className="sticky-head">
                  <caption id="report-teams-caption" className="sr-only">Teams by their average score</caption>
                  <thead><tr><th>Rank</th><th>Team</th><th>Players</th><th>Average score</th></tr></thead>
                  <tbody>
                    {report.teams.map((t) => (
                      <tr key={t.team}>
                        <td>{t.rank}</td>
                        <td><TeamBadge team={t.team} name={t.name} /></td>
                        <td>{t.players}</td>
                        <td>{t.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!unplugged && (
            <>
              <h2>Players</h2>
              <div className="table-scroll">
                <table>
                  <thead><tr>{ranked && <th>Rank</th>}<th>Name</th>{report.teams.length > 0 && <th>Team</th>}{ranked && <th>Score</th>}<th>Correct</th><th>Answered</th></tr></thead>
                  <tbody>
                    {report.players.map((p, i) => (
                      <tr key={i + p.name}>
                        {ranked && <td>{p.rank}</td>}
                        <td>
                          {p.name} {p.guest && <span className="chip">Guest</span>}
                          {p.members && p.members.length > 0 && <div className="muted">{p.members.join(", ")}</div>}
                        </td>
                        {report.teams.length > 0 && <td>{p.team
                          ? <TeamBadge team={p.team} name={report.teams.find((t) => t.team === p.team)?.name} /> : "–"}</td>}
                        {ranked && <td>{p.score}</td>}
                        <td>{p.correct} of {p.questions}</td>
                        <td>{p.answered}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h2>Questions</h2>
          <ol className="question-list">
            {report.questions.map((q) => <QuestionResult key={q.number} q={q} people={s.players} />)}
          </ol>
        </>
      )}
    </div>
  );
}
