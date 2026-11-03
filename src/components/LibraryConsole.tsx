"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { gradeLabel } from "@/lib/content";
import { LoadingState } from "@/components/ui/States";

interface CourseRow {
  courseId: string;
  grade: number;
  subject: string;
  name: string;
  published: number;
  hidden: number;
}

interface RunRow {
  runId: string;
  kind: string;
  mode: string;
  status: string;
  published: number;
  costUsd: number;
  startedBy: string | null;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
}

interface Overview {
  enabled: boolean;
  courses: CourseRow[];
  runs: RunRow[];
  openReports: number;
}

interface ReportRow {
  questionId: string;
  question: string;
  quizTitle: string;
  course: string;
  grade: number;
  hidden: boolean;
  reports: number;
  reasons: string[];
  notes: string[];
  schools: string[];
  lastAt: string;
}

const REASON_WORDS: Record<string, string> = {
  WRONG_ANSWER: "wrong answer", UNCLEAR: "unclear", NOT_SUITABLE: "not suitable", OTHER: "other",
};

const RUN_WORDS: Record<string, string> = {
  BANK_LOAD: "Question bank loaded", SYLLABUS: "Syllabus map", QUIZZES: "Quizzes generated", RECHECK: "Bank re-check",
};

function message(e: unknown): string {
  return e instanceof ApiError ? e.message : "That did not work. Please try again.";
}

/**
 * The platform console's Library tab: what the shared library holds per grade and course, its runs, loading the
 * question bank (no AI, no cost), and the questions teachers reported.
 */
export function LibraryConsole({ onError, onNotice }: { onError: (m: string | null) => void; onNotice: (m: string | null) => void }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Overview>("/api/v1/platform/library").then(setOverview).catch((e: unknown) => onError(message(e)));
    api<ReportRow[]>("/api/v1/platform/library/reports").then(setReports).catch((e: unknown) => onError(message(e)));
  }, [onError]);
  useEffect(load, [load]);

  async function loadBank() {
    setBusy("bank");
    onError(null);
    onNotice(null);
    try {
      const r = await api<{ quizzes: number; questions: number; skipped: number }>("/api/v1/platform/library/bank-load", { method: "POST" });
      onNotice(`Question bank loaded: ${r.quizzes} new quizzes (${r.questions} questions); ${r.skipped} were already in the library.`);
      load();
    } catch (e) {
      onError(message(e));
    }
    setBusy(null);
  }

  async function resolve(r: ReportRow, resolution: "KEPT" | "RETIRED") {
    setBusy(r.questionId);
    onError(null);
    onNotice(null);
    try {
      setReports(await api<ReportRow[]>("/api/v1/platform/library/questions/" + r.questionId + "/resolve", {
        method: "POST", body: { resolution },
      }));
      onNotice(resolution === "KEPT" ? "The question is shown again in every school." : "The question stays hidden until it's replaced.");
      load();
    } catch (e) {
      onError(message(e));
    }
    setBusy(null);
  }

  if (!overview) return <LoadingState rows={4} label="Loading the library" />;
  const published = overview.courses.reduce((n, c) => n + c.published, 0);
  const hidden = overview.courses.reduce((n, c) => n + c.hidden, 0);

  return (
    <div className="stack">
      <section className="card stack" aria-labelledby="lib-summary">
        <h2 id="lib-summary" style={{ margin: 0 }}>Library (FLVS)</h2>
        <p style={{ margin: 0 }}>
          <strong>{published}</strong> published quizzes in <strong>{overview.courses.length}</strong> courses
          {hidden > 0 && <>, <strong>{hidden}</strong> hidden while they&apos;re fixed</>}.
          {" "}{overview.enabled ? "Teachers see it now." : "It's switched off, so teachers don't see it yet (ISQUIZ_LIBRARY_ENABLED)."}
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={loadBank} disabled={busy !== null}>
            {busy === "bank" ? "Loading…" : "Load the question bank"}
          </button>
          <span className="muted">No AI and no cost. Quizzes already in the library are skipped.</span>
        </div>
      </section>

      <section className="card stack" aria-labelledby="lib-reports">
        <h2 id="lib-reports" style={{ margin: 0 }}>Reported questions ({overview.openReports})</h2>
        {!reports && <LoadingState rows={2} />}
        {reports && reports.length === 0 && <p className="muted" style={{ margin: 0 }}>No open reports.</p>}
        {reports && reports.length > 0 && (
          <ul className="workspace-list">
            {reports.map((r) => (
              <li key={r.questionId}>
                <div className="stack" style={{ gap: 4 }}>
                  <strong>{r.question}</strong>
                  <span className="muted">
                    {r.quizTitle} · {gradeLabel(r.grade)} · {r.course} · {r.reports} {r.reports === 1 ? "report" : "reports"}
                    {" "}({r.reasons.map((x) => REASON_WORDS[x] ?? x).join(", ")}) from {r.schools.join(", ")}
                  </span>
                  {r.notes.length > 0 && <span>“{r.notes[0]}”{r.notes.length > 1 && <span className="muted"> and {r.notes.length - 1} more notes</span>}</span>}
                  {r.hidden && <span className="chip chip-warn">Hidden from every school</span>}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className="btn btn-light" disabled={busy !== null} onClick={() => resolve(r, "KEPT")}>
                    Keep<span className="sr-only">: the question is fine</span>
                  </button>
                  <button type="button" className="btn btn-light" disabled={busy !== null} onClick={() => resolve(r, "RETIRED")}>
                    Retire<span className="sr-only">: keep it hidden</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="lib-courses">
        <h2 id="lib-courses" style={{ margin: 0 }}>Courses</h2>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Grade</th><th>Course</th><th>Subject</th><th>Published</th><th>Hidden</th></tr></thead>
            <tbody>
              {overview.courses.map((c) => (
                <tr key={c.courseId}>
                  <td>{gradeLabel(c.grade)}</td>
                  <td>{c.name}</td>
                  <td>{c.subject}</td>
                  <td>{c.published}</td>
                  <td>{c.hidden || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack" aria-labelledby="lib-runs">
        <h2 id="lib-runs" style={{ margin: 0 }}>Runs</h2>
        {overview.runs.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing has run yet.</p>}
        {overview.runs.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead><tr><th>When</th><th>What</th><th>Status</th><th>Published</th><th>Cost</th><th>By</th></tr></thead>
              <tbody>
                {overview.runs.map((r) => (
                  <tr key={r.runId}>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                    <td>{RUN_WORDS[r.kind] ?? r.kind}{r.mode === "SAMPLE" && " (stand-in, no AI)"}</td>
                    <td>{r.status.toLowerCase()}{r.error && <span className="muted"> · {r.error}</span>}</td>
                    <td>{r.published}</td>
                    <td>${Number(r.costUsd).toFixed(2)}</td>
                    <td>{r.startedBy ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
