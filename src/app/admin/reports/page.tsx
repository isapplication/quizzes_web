"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";
import { api, ApiError, downloadFile } from "@/lib/api";
import { gradeLabel } from "@/lib/content";
import { isSchoolAdmin, useMe } from "@/lib/me";
import { defaultRange, NEEDS_HELP_BELOW, percentTone, rangeQuery, SchoolReport, withQuery } from "@/lib/reports";

export default function SchoolReportsRoute() {
  return (
    <AppFrame>
      <Suspense>
        <SchoolReports />
      </Suspense>
    </AppFrame>
  );
}

/**
 * The school admin's view (wave3-plan.md, W44): how much Quizplayo is used by teacher, class and grade, how many students
 * are active, and the classes under 50%. Counts and percentages only: a child's own answers stay in the teacher's game
 * report. Each class opens its class report.
 */
function SchoolReports() {
  const me = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const initial = defaultRange();
  const from = params.get("from") ?? initial.from;
  const to = params.get("to") ?? initial.to;
  const [report, setReport] = useState<SchoolReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const admin = isSchoolAdmin(me);
  const query = rangeQuery({ from, to });

  useEffect(() => {
    if (!admin) return;
    setReport(null);
    setError(null);
    api<SchoolReport>(withQuery("/api/v1/reports/school", query)).then(setReport)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load the school report."));
  }, [admin, query]);

  function set(next: Record<string, string>) {
    router.replace("/admin/reports?" + new URLSearchParams({ from, to, ...next }).toString(), { scroll: false });
  }

  async function download(kind: "csv" | "xlsx") {
    try {
      await downloadFile(withQuery("/api/v1/reports/school/report." + kind, query), "School report." + kind);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not prepare the file. Please try again.");
    }
  }

  if (!admin) {
    return <div className="alert alert-danger" role="alert">Only school admins can see the school report. Teachers see their own classes under Reports.</div>;
  }

  return (
    <div className="stack">
      <PageHeader title="School reports"
                  description="How Quizplayo is used across your school, and which classes are finding it hard."
                  action={report && <div className="row" style={{ gap: 8 }}>
                    <button type="button" className="btn btn-light" onClick={() => download("csv")}>Download CSV</button>
                    <button type="button" className="btn btn-light" onClick={() => download("xlsx")}>Download Excel</button>
                  </div>} />
      <form className="report-filters" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="sc-from">From</label>
          <input id="sc-from" type="date" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sc-to">To</label>
          <input id="sc-to" type="date" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} />
        </div>
      </form>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!report && !error && <LoadingState rows={5} label="Loading the school report" />}
      {report && (
        <>
          <div className="report-cards">
            <div className="card"><span className="muted">Games finished</span><strong>{report.totals.games}</strong></div>
            <div className="card"><span className="muted">Assignments made</span><strong>{report.totals.assignments}</strong></div>
            <div className="card"><span className="muted">Active students</span><strong>{report.totals.students}</strong></div>
            <div className="card"><span className="muted">Accuracy</span><strong>{report.totals.answers ? report.totals.percent + "%" : "–"}</strong></div>
          </div>

          {report.classesBelow.length > 0 && (
            <div className="alert" role="status">
              <strong>{report.classesBelow.length === 1 ? "1 class is" : report.classesBelow.length + " classes are"} under {NEEDS_HELP_BELOW}%:</strong>{" "}
              {report.classesBelow.map((c, i) => (
                <span key={c}>{i > 0 && ", "}<Link href={"/teacher/reports?class=" + encodeURIComponent(c) + "&" + query}>{c}</Link></span>
              ))}
            </div>
          )}

          <h2>Classes</h2>
          {report.classes.length === 0 ? (
            <EmptyState title="No class results in these days">Results appear when signed-in students of a class do a game or an assignment.</EmptyState>
          ) : (
            <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="sc-classes">
              <table className="sticky-head">
                <caption id="sc-classes" className="sr-only">Classes by accuracy, lowest first</caption>
                <thead><tr><th>Class</th><th>Grade</th><th>Games and assignments</th><th>Students</th><th>Answers</th><th>Accuracy</th></tr></thead>
                <tbody>
                  {report.classes.map((c) => (
                    <tr key={c.classCode}>
                      <th scope="row"><Link href={"/teacher/reports?class=" + encodeURIComponent(c.classCode) + "&" + query}>{c.name}</Link>{" "}
                        <span className="muted">{c.classCode}</span></th>
                      <td>{c.grade === null ? "–" : gradeLabel(c.grade)}</td>
                      <td>{c.sessions}</td>
                      <td>{c.students}</td>
                      <td>{c.answers}</td>
                      <td><span className={"chip chip-" + percentTone(c.percent)}>{c.percent}%</span>{c.below && <> <span className="chip chip-danger">Under {NEEDS_HELP_BELOW}%</span></>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2>Teachers</h2>
          {report.teachers.length === 0 ? (
            <EmptyState title="No games or assignments in these days">Nothing was finished or made in this range.</EmptyState>
          ) : (
            <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="sc-teachers">
              <table className="sticky-head">
                <caption id="sc-teachers" className="sr-only">Use by teacher</caption>
                <thead><tr><th>Teacher</th><th>Games</th><th>Assignments</th><th>Students who answered</th></tr></thead>
                <tbody>
                  {report.teachers.map((t) => (
                    <tr key={t.userId}><th scope="row">{t.name}</th><td>{t.games}</td><td>{t.assignments}</td><td>{t.students}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {report.grades.length > 0 && (
            <>
              <h2>Grades</h2>
              <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="sc-grades">
                <table>
                  <caption id="sc-grades" className="sr-only">Use and accuracy by grade</caption>
                  <thead><tr><th>Grade</th><th>Classes</th><th>Games and assignments</th><th>Students</th><th>Accuracy</th></tr></thead>
                  <tbody>
                    {report.grades.map((g) => (
                      <tr key={String(g.grade)}>
                        <th scope="row">{g.grade === null ? "No grade" : gradeLabel(g.grade)}</th>
                        <td>{g.classes}</td><td>{g.sessions}</td><td>{g.students}</td>
                        <td><span className={"chip chip-" + percentTone(g.percent)}>{g.percent}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
