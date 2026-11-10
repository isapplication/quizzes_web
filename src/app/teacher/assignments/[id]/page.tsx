"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { QuestionResult } from "@/components/QuestionResult";
import { api, ApiError } from "@/lib/api";
import { AssignmentResults, AssignmentSummary, dueText, rightText } from "@/lib/assignments";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import { ReportActions } from "@/components/ReportActions";
import { hardQuestions } from "@/lib/reports";
import { ShareLinks } from "@/components/ShareLinks";

export default function AssignmentResultsRoute() {
  return (
    <AppFrame>
      <Results />
    </AppFrame>
  );
}

/** Who has done an assignment and how, and how each question went. */
function Results() {
  const { id } = useParams<{ id: string }>();
  const [results, setResults] = useState<AssignmentResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api<AssignmentResults>("/api/v1/assignments/" + id + "/results").then(setResults)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load the results."));
  }, [id]);
  useEffect(load, [load]);

  async function close() {
    if (!window.confirm("Close this assignment? Nobody can start or carry on after that; the results stay.")) return;
    try {
      await api<AssignmentSummary>("/api/v1/assignments/" + id + "/close", { method: "POST" });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not close the assignment.");
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (error && !results) return <ErrorState message={error} />;
  if (!results) return <LoadingState rows={5} label="Loading the results" />;
  const a = results.assignment;
  const done = results.attempts.filter((t) => t.finishedAt).length;

  return (
    <div className="stack">
      <PageHeader title={a.title}
                  description={<>{a.classCode ? "Class " + a.classCode : "Anyone with the link"}
                    {a.requireSignIn && " · signed-in students only"}{a.dueAt && <> · {dueText(a.dueAt)}</>}
                    {" · "}{a.open ? "Open" : "Closed"}{a.practice && " · practice"}</>}
                  action={a.open ? <button type="button" className="btn btn-light" onClick={close}>Close it</button> : undefined} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {results.attempts.length > 0 && (
        <ReportActions filePath={{ csv: "/api/v1/assignments/" + id + "/results.csv", xlsx: "/api/v1/assignments/" + id + "/results.xlsx" }}
                       fileName={a.title} reteachPath={"/api/v1/assignments/" + id + "/reteach"}
                       aiReteachPath={"/api/v1/assignments/" + id + "/reteach-ai"}
                       hard={hardQuestions(results.questions).length} onError={setError} />
      )}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input type="text" readOnly value={a.link} aria-label="Assignment link" style={{ flex: "1 1 260px", minWidth: 0 }}
               onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn-light" onClick={() => copy(a.link)}>{copied ? "Copied" : "Copy link"}</button>
      </div>
      {a.open && <ShareLinks link={a.link} />}
      <div className="report-cards">
        <div className="card"><span className="muted">Started</span><strong>{results.attempts.length}</strong></div>
        <div className="card"><span className="muted">Finished</span><strong>{done}</strong></div>
      </div>

      <h2>Students</h2>
      {results.attempts.length === 0 ? (
        <EmptyState title="Nobody has started yet">Share the link{a.classCode && <>, or tell class {a.classCode} to look on their home page</>}.</EmptyState>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="attempts-caption">
          <table className="sticky-head">
            <caption id="attempts-caption" className="sr-only">Students and their scores</caption>
            <thead><tr><th>Name</th><th>Score</th><th>Right{a.practice && " (first try)"}</th>
              {a.practice && <th>Right by the third try</th>}<th>Answered</th><th>Finished</th></tr></thead>
            <tbody>
              {results.attempts.map((t, i) => (
                <tr key={i}>
                  <td>{t.name} {t.guest && <span className="chip">Guest</span>}</td>
                  <td>{t.score}</td>
                  <td>{rightText(t) ?? <span className="muted">Nothing to mark</span>}</td>
                  {a.practice && <td>{t.rightInTheEnd ?? t.correct}{t.scored ? " of " + t.scored : ""}</td>}
                  <td>{t.answered} of {t.questions}</td>
                  <td>{t.finishedAt ? new Date(t.finishedAt).toLocaleString() : <span className="muted">Not yet</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Questions</h2>
      <ol className="question-list">
        {results.questions.map((q) => (
          <QuestionResult key={q.number} q={q} people={results.attempts.length} who="students"
                          note={a.practice && q.counted !== false
                            ? "First tries: " + q.correct + " of " + q.answered + " right · right by the third try: " + (q.rightInTheEnd ?? q.correct)
                            : undefined} />
        ))}
      </ol>
    </div>
  );
}
