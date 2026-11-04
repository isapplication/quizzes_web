"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { AnswerShape } from "@/components/AnswerShape";
import { GAME_MODES, TeamBadge } from "@/components/Stage";
import { api, ApiError } from "@/lib/api";
import { tabKey } from "@/lib/tab";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";
import { type AnswerKey, formatNumber, keyText, percent, QTYPE_LABEL, type QType } from "@/lib/questionTypes";

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
  questions: ReportQuestion[];
}

/** One question's results. Wave 1b adds every correct choice, whether it is scored (a poll isn't), its answer key and per-type stats. */
interface ReportQuestion {
  number: number;
  text: string;
  type: string | null;
  choices: string[];
  correctIndex: number;
  correctIndexes?: number[];
  counts: number[];
  answered: number;
  correct: number;
  percentCorrect: number;
  counted?: boolean;
  key?: AnswerKey;
  stats?: { answered?: number; exactlyRight?: number; fullyRight?: number; mean?: number; min?: number; max?: number;
    top?: { text: string; count: number }[] };
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
            {report.questions.map((q) => <QuestionResult key={q.number} q={q} players={s.players} />)}
          </ol>
        </>
      )}
    </div>
  );
}

const CHOICE_REPORT_TYPES = ["QUIZ", "TRUE_FALSE", "MULTI_SELECT", "POLL"];
const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

/**
 * One question's results, by type: answer bars for choice questions (every right answer marked, none for a poll), the
 * most common texts for a typed answer, the spread for a slider and the share fully right for a puzzle.
 */
function QuestionResult({ q, players }: { q: ReportQuestion; players: number }) {
  const type = (q.type ?? "QUIZ") as QType;
  const counted = q.counted !== false;
  const right = q.correctIndexes ?? (q.correctIndex >= 0 ? [q.correctIndex] : []);
  const stats = q.stats ?? {};
  const answered = stats.answered ?? q.answered;
  const answer = keyText(type, q.key, q.choices, right);
  const most = Math.max(1, ...q.counts);
  return (
    <li className="card stack" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <strong>{q.text}</strong>
        <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <span className="chip">{QTYPE_LABEL[type] ?? type}</span>
          {counted ? (
            <span className={"chip " + (q.percentCorrect >= 70 ? "chip-ok" : q.percentCorrect >= 40 ? "chip-warn" : "chip-danger")}>
              {q.percentCorrect}% correct
            </span>
          ) : <span className="chip">No right answer</span>}
        </span>
      </div>

      {CHOICE_REPORT_TYPES.includes(type) && (
        <ul className="report-answers">
          {q.choices.map((c, i) => {
            const isRight = counted && right.includes(i);
            return (
              <li key={i} className={isRight ? "correct" : ""}>
                <AnswerShape index={i} size={16} />
                <span className="report-answer-text">{c}{isRight && <strong> ✓<span className="sr-only"> right answer</span></strong>}</span>
                <span className="report-bar" aria-hidden="true">
                  <span style={{ width: (100 * (q.counts[i] ?? 0)) / most + "%", background: `var(--a${(i % 6) + 1})` }} />
                </span>
                <span className="report-count">{q.counts[i] ?? 0}</span>
              </li>
            );
          })}
        </ul>
      )}
      {type === "MULTI_SELECT" && stats.exactlyRight !== undefined && (
        <div>{stats.exactlyRight} of {answered} picked exactly the right answers ({percent(stats.exactlyRight, answered)}%)</div>
      )}

      {type === "TYPE_ANSWER" && (
        <>
          {answer && <div>Accepted: <strong>{answer}</strong></div>}
          {stats.top && stats.top.length > 0 && (
            <ul className="report-answers">
              {stats.top.map((t) => (
                <li key={t.text} className="report-typed">
                  <span className="report-answer-text">{t.text}</span>
                  <span className="report-bar" aria-hidden="true">
                    <span style={{ width: (100 * t.count) / Math.max(1, stats.top![0].count) + "%", background: "var(--a1)" }} />
                  </span>
                  <span className="report-count">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {type === "SLIDER" && (
        <>
          {answer && <div>The answer: <strong>{answer}</strong></div>}
          {stats.mean !== undefined && answered > 0 && (
            <div>Average {formatNumber(stats.mean, 0.1, q.key?.unit ?? "")} · lowest {num(stats.min ?? 0)} · highest {num(stats.max ?? 0)}</div>
          )}
        </>
      )}

      {type === "PUZZLE" && (
        <>
          {answer && <div>The right order: <strong>{answer}</strong></div>}
          {stats.fullyRight !== undefined && (
            <div>{stats.fullyRight} of {answered} got the whole order right ({percent(stats.fullyRight, answered)}%)</div>
          )}
        </>
      )}

      <div className="muted">{q.answered} of {players} answered</div>
    </li>
  );
}
