"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { AnswerShape } from "@/components/AnswerShape";
import { GAME_MODES, TeamBadge } from "@/components/Stage";
import { api, ApiError } from "@/lib/api";
import { tabKey } from "@/lib/tab";
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
    team: number | null }[];
  /** CLASSIC, TEAM or ACCURACY. */
  mode: string;
  /** Team games: teams by their members' average score. */
  teams: { rank: number; team: number; score: number; players: number }[];
  questions: { number: number; text: string; type: string | null; choices: string[]; correctIndex: number; counts: number[];
    answered: number; correct: number; percentCorrect: number }[];
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

  /** The CSV goes through api()'s tab key, so it downloads as this tab's person. */
  async function download() {
    const key = tabKey();
    const r = await fetch("/api/v1/live/games/" + gameId + "/report.csv", {
      headers: key ? { Authorization: "Bearer " + key } : undefined, credentials: "same-origin",
    });
    if (!r.ok) {
      setError("Quizplayo could not prepare the file. Please try again.");
      return;
    }
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = (report?.quizTitle ?? "game").replace(/[^\w -]+/g, "").trim() + " results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error && !report) return <div className="alert alert-danger">{error}</div>;
  if (!report) return <LoadingState rows={6} label="Loading the report" />;
  const s = report.summary;
  const finished = report.status === "FINISHED";

  return (
    <div className="stack">
      <PageHeader title={report.quizTitle}
                  description={<>{report.startedAt ? new Date(report.startedAt).toLocaleString() : "Not started"}
                    {" · "}{report.requireSignIn ? "Signed-in students" + (report.classCode ? " of " + report.classCode : "") : "Anyone with the PIN"}
                    {" · "}{GAME_MODES.find((m) => m.value === report.mode)?.label ?? "Classic"} game</>}
                  action={finished && report.players.length > 0
                    ? <button type="button" className="btn btn-light" onClick={download}>Download CSV</button> : undefined} />
      {error && <div className="alert alert-danger">{error}</div>}
      {!finished && (
        <EmptyState title="This game hasn't finished yet">The report appears when the game reaches the podium.</EmptyState>
      )}
      {finished && (
        <>
          <div className="report-cards">
            <div className="card"><span className="muted">Players</span><strong>{s.players}</strong>
              {s.guests > 0 && <span className="muted">{s.guests} with a nickname</span>}</div>
            <div className="card"><span className="muted">Average correct</span><strong>{s.averageCorrectPercent}%</strong></div>
            <div className="card"><span className="muted">Average score</span><strong>{s.averageScore}</strong></div>
            <div className="card"><span className="muted">Hardest question</span>
              <strong>{s.hardestQuestion ? "Question " + s.hardestQuestion : "–"}</strong></div>
          </div>

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
                        <td><TeamBadge team={t.team} /></td>
                        <td>{t.players}</td>
                        <td>{t.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h2>Players</h2>
          <div className="table-scroll">
            <table>
              <thead><tr><th>Rank</th><th>Name</th>{report.teams.length > 0 && <th>Team</th>}<th>Score</th><th>Correct</th><th>Answered</th></tr></thead>
              <tbody>
                {report.players.map((p) => (
                  <tr key={p.rank + p.name}>
                    <td>{p.rank}</td>
                    <td>{p.name} {p.guest && <span className="chip">Guest</span>}</td>
                    {report.teams.length > 0 && <td>{p.team ? <TeamBadge team={p.team} /> : "–"}</td>}
                    <td>{p.score}</td>
                    <td>{p.correct} of {p.questions}</td>
                    <td>{p.answered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>Questions</h2>
          <ol className="question-list">
            {report.questions.map((q) => {
              const most = Math.max(1, ...q.counts);
              return (
                <li key={q.number} className="card stack" style={{ gap: 8 }}>
                  <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
                    <strong>{q.text}</strong>
                    <span className={"chip " + (q.percentCorrect >= 70 ? "chip-ok" : q.percentCorrect >= 40 ? "chip-warn" : "chip-danger")}>
                      {q.percentCorrect}% correct
                    </span>
                  </div>
                  <ul className="report-answers">
                    {q.choices.map((c, i) => (
                      <li key={i} className={i === q.correctIndex ? "correct" : ""}>
                        <AnswerShape index={i} size={16} />
                        <span className="report-answer-text">{c}{i === q.correctIndex && <strong> ✓</strong>}</span>
                        <span className="report-bar" aria-hidden="true">
                          <span style={{ width: (100 * (q.counts[i] ?? 0)) / most + "%", background: `var(--a${(i % 4) + 1})` }} />
                        </span>
                        <span className="report-count">{q.counts[i] ?? 0}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="muted">{q.answered} of {s.players} answered</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}
