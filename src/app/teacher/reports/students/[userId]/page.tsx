"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Trend } from "@/components/Trend";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";
import { api, ApiError } from "@/lib/api";
import { gradeLabel } from "@/lib/content";
import { defaultRange, percentTone, rangeQuery, sourceLink, StudentReport, withQuery } from "@/lib/reports";

export default function StudentTimelineRoute() {
  return (
    <AppFrame>
      <Suspense>
        <StudentTimeline />
      </Suspense>
    </AppFrame>
  );
}

/** One student's games and assignments over time, for their teachers and the school admin. */
function StudentTimeline() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const params = useSearchParams();
  const initial = defaultRange();
  const from = params.get("from") ?? initial.from;
  const to = params.get("to") ?? initial.to;
  const [report, setReport] = useState<StudentReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setReport(null);
    setError(null);
    api<StudentReport>(withQuery("/api/v1/reports/students/" + userId, rangeQuery({ from, to }))).then(setReport)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load this student's report."));
  }, [userId, from, to]);

  function set(next: Record<string, string>) {
    router.replace("/teacher/reports/students/" + userId + "?" + new URLSearchParams({ from, to, ...next }).toString(), { scroll: false });
  }

  if (error && !report) {
    return (
      <div className="stack">
        <div className="alert alert-danger" role="alert">{error}</div>
        <Link className="btn btn-light" href="/teacher/reports">Back to class reports</Link>
      </div>
    );
  }
  if (!report) return <LoadingState rows={5} label="Loading the student's report" />;

  return (
    <div className="stack">
      <PageHeader title={report.name}
                  description={<>{report.grade !== null && <>{gradeLabel(report.grade)} · </>}Games and assignments your classes did</>}
                  action={<Link className="btn btn-light" href="/teacher/reports">All class reports</Link>} />
      <form className="report-filters" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="st-from">From</label>
          <input id="st-from" type="date" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="st-to">To</label>
          <input id="st-to" type="date" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} />
        </div>
      </form>
      <div className="report-cards">
        <div className="card"><span className="muted">Games and assignments</span><strong>{report.sessions}</strong></div>
        <div className="card"><span className="muted">Accuracy</span><strong>{report.sessions ? report.percent + "%" : "–"}</strong></div>
        <div className="card"><span className="muted">Last 5</span><strong>{report.sessions ? report.recentPercent + "%" : "–"}</strong>
          {report.needsHelp && <span className="chip chip-danger">Needs help</span>}</div>
        <div className="card"><span className="muted">Trend</span><Trend values={report.trend} label={"Accuracy of " + report.name} width={160} height={44} /></div>
      </div>
      {report.timeline.length === 0 ? (
        <EmptyState title="No results in these days">Nothing from your games and assignments with {report.name} in this range. Try a longer one.</EmptyState>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="timeline-caption">
          <table className="sticky-head">
            <caption id="timeline-caption" className="sr-only">Games and assignments, newest first</caption>
            <thead><tr><th>When</th><th>What</th><th>Kind</th><th>Class</th><th>Answers</th><th>Accuracy</th></tr></thead>
            <tbody>
              {report.timeline.map((s, i) => {
                const href = sourceLink(s);
                return (
                  <tr key={i}>
                    <td>{new Date(s.at).toLocaleDateString()}</td>
                    <th scope="row">{href ? <Link href={href}>{s.title}</Link> : s.title}</th>
                    <td>{s.source === "GAME" ? "Game" : "Assignment"}</td>
                    <td>{s.classCode ?? "–"}</td>
                    <td>{s.answers}</td>
                    <td><span className={"chip chip-" + percentTone(s.percent)}>{s.percent}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
