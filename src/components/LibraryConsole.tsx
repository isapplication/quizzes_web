"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { gradeLabel } from "@/lib/content";
import { LoadingState } from "@/components/ui/States";

interface CourseRow {
  courseId: string;
  grade: number;
  subject: string;
  name: string;
  /** Quizzes; activities are counted apart. */
  published: number;
  activities: number;
  hidden: number;
}

interface RunRow {
  runId: string;
  kind: "BANK_LOAD" | "SYLLABUS" | "QUIZZES" | "ACTIVITIES" | "RECHECK";
  mode: "LIVE" | "SAMPLE" | "NONE";
  status: string;
  phase: string | null;
  course: string | null;
  target: number | null;
  requested: number;
  published: number;
  estimateUsd: number | null;
  budgetUsd: number | null;
  costUsd: number;
  startedBy: string | null;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
}

interface Overview {
  enabled: boolean;
  writer: "LIVE" | "SAMPLE";
  canGenerate: boolean;
  defaultBudgetUsd: number;
  courses: CourseRow[];
  runs: RunRow[];
  openReports: number;
}

interface UnitRow {
  unitId: string;
  position: number;
  title: string;
  removed: boolean;
  quizzes: number;
  benchmarks: { code: string; description: string | null; sourceUrl: string | null }[];
}

interface ItemRow {
  itemId: string;
  unit: string | null;
  status: string;
  attempt: number;
  kept: number;
  dropped: number;
  quizTitle: string | null;
  reason: string | null;
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

type Kind = "SYLLABUS" | "QUIZZES" | "ACTIVITIES" | "RECHECK";

/** What is about to start, waiting for "Start" after its estimate. */
interface Pending {
  kind: Kind;
  courseId: string | null;
  label: string;
  target: number;
  budget: number;
  estimate: { quizzes: number; usd: number; mode: string } | null;
}

const REASON_WORDS: Record<string, string> = {
  WRONG_ANSWER: "wrong answer", UNCLEAR: "unclear", NOT_SUITABLE: "not suitable", OTHER: "other",
};

const RUN_WORDS: Record<string, string> = {
  BANK_LOAD: "Question bank loaded", SYLLABUS: "Syllabus map", QUIZZES: "Quizzes", ACTIVITIES: "Activities", RECHECK: "Bank re-check",
};

function message(e: unknown): string {
  return e instanceof ApiError ? e.message : "That did not work. Please try again.";
}

function money(n: number | null | undefined): string {
  return n == null ? "–" : "$" + Number(n).toFixed(2);
}

/**
 * The platform console's Library tab: what the shared library holds per grade and course, making syllabus maps and
 * quizzes (each run shows its estimate first and stops at its budget), the bank load ($0), and reported questions.
 */
export function LibraryConsole({ onError, onNotice }: { onError: (m: string | null) => void; onNotice: (m: string | null) => void }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [openCourse, setOpenCourse] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Overview>("/api/v1/platform/library").then(setOverview).catch((e: unknown) => onError(message(e)));
    api<ReportRow[]>("/api/v1/platform/library/reports").then(setReports).catch((e: unknown) => onError(message(e)));
  }, [onError]);
  useEffect(load, [load]);

  // While a run is going, look again every few seconds.
  const running = overview?.runs.some((r) => r.status === "QUEUED" || r.status === "RUNNING") ?? false;
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => {
      api<Overview>("/api/v1/platform/library").then(setOverview).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(t);
  }, [running]);

  async function prepare(kind: Kind, courseId: string | null, label: string) {
    if (!overview) return;
    const p: Pending = { kind, courseId, label, target: 5, budget: Number(overview.defaultBudgetUsd), estimate: null };
    setPending(p);
    onError(null);
    await estimate(p);
  }

  async function estimate(p: Pending) {
    try {
      const e = await api<{ quizzes: number; usd: number; mode: string }>("/api/v1/platform/library/estimate", {
        method: "POST", body: { kind: p.kind, courseId: p.courseId, target: p.target },
      });
      setPending({ ...p, estimate: e });
    } catch (e) {
      onError(message(e));
    }
  }

  async function start() {
    if (!pending) return;
    setBusy("start");
    onError(null);
    onNotice(null);
    try {
      const runs = await api<RunRow[]>("/api/v1/platform/library/runs", {
        method: "POST",
        body: { kind: pending.kind, courseId: pending.courseId, target: pending.target, budgetUsd: pending.budget },
      });
      onNotice(`${runs.length === 1 ? "1 run" : runs.length + " runs"} started. They move on about once a minute.`);
      setPending(null);
      load();
    } catch (e) {
      onError(message(e));
    }
    setBusy(null);
  }

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

  async function cancel(r: RunRow) {
    setBusy(r.runId);
    onError(null);
    try {
      await api("/api/v1/platform/library/runs/" + r.runId + "/cancel", { method: "POST" });
      onNotice("Run cancelled.");
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
  const sample = overview.writer === "SAMPLE";

  return (
    <div className="stack">
      <section className="card stack" aria-labelledby="lib-summary">
        <h2 id="lib-summary" style={{ margin: 0 }}>Library (FLVS)</h2>
        <p style={{ margin: 0 }}>
          <strong>{published}</strong> published quizzes in <strong>{overview.courses.length}</strong> courses
          {hidden > 0 && <>, <strong>{hidden}</strong> hidden while they&apos;re fixed</>}.
          {" "}{overview.enabled ? "Teachers see it now." : "It's switched off, so teachers don't see it yet (ISQUIZ_LIBRARY_ENABLED)."}
        </p>
        <p className={sample ? "alert" : "muted"} style={{ margin: 0 }}>
          {sample
            ? <>Writer: <strong>stand-in (no AI, $0)</strong>. Runs write sample quizzes marked &ldquo;Sample&rdquo;, for testing.
              {!overview.canGenerate && " They're switched off here (ISQUIZ_LIBRARY_ALLOW_SAMPLE)."} Set ANTHROPIC_API_KEY on the server for real quizzes.</>
            : <>Writer: <strong>Claude</strong>. Every run shows its estimate first and stops at its budget.</>}
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-light" onClick={loadBank} disabled={busy !== null}>
            {busy === "bank" ? "Loading…" : "Load the question bank ($0)"}
          </button>
          {overview.canGenerate && (
            <>
              <button type="button" className="btn btn-light" disabled={busy !== null}
                      onClick={() => prepare("SYLLABUS", null, "Syllabus maps for every course")}>Make every syllabus map</button>
              <button type="button" className="btn btn-light" disabled={busy !== null}
                      onClick={() => prepare("QUIZZES", null, "Quizzes for every course with a map")}>Fill every course</button>
              <button type="button" className="btn btn-light" disabled={busy !== null}
                      onClick={() => prepare("ACTIVITIES", null, "Activities for every course with a map")}>Fill every course with activities</button>
              {!sample && (
                <button type="button" className="btn btn-light" disabled={busy !== null}
                        onClick={() => prepare("RECHECK", null, "Re-check the bank's quizzes")}>Re-check the bank</button>
              )}
            </>
          )}
        </div>
        {pending && (
          <form className="card stack library-start" aria-labelledby="lib-start"
                onSubmit={(e) => { e.preventDefault(); start(); }}>
            <h3 id="lib-start" style={{ margin: 0 }}>{pending.label}</h3>
            <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              {(pending.kind === "QUIZZES" || pending.kind === "ACTIVITIES") && (
                <div className="field">
                  <label htmlFor="lib-target">{pending.kind === "ACTIVITIES" ? "Activities per course" : "Quizzes per course"}</label>
                  <input id="lib-target" type="number" min={1} max={100} value={pending.target}
                         onChange={(e) => setPending({ ...pending, target: Number(e.target.value), estimate: null })}
                         onBlur={() => estimate(pending)} />
                </div>
              )}
              <div className="field">
                <label htmlFor="lib-budget">Budget per run (US$)</label>
                <input id="lib-budget" type="number" min={0.01} max={500} step={0.01} value={pending.budget}
                       onChange={(e) => setPending({ ...pending, budget: Number(e.target.value) })} />
              </div>
            </div>
            <p style={{ margin: 0 }} aria-live="polite">
              {pending.estimate
                ? <>Estimate: <strong>{money(pending.estimate.usd)}</strong>
                  {pending.kind !== "SYLLABUS" && <> for {pending.estimate.quizzes} {pending.kind === "ACTIVITIES" ? "activities" : "quizzes"}</>}
                  {pending.estimate.mode === "SAMPLE" && " (pretend cost: the stand-in spends nothing)"}.</>
                : "Working out the estimate…"}
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button type="submit" className="btn btn-primary" disabled={busy !== null || !pending.estimate}>
                {busy === "start" ? "Starting…" : "Start"}
              </button>
              <button type="button" className="btn btn-light" onClick={() => setPending(null)}>Cancel</button>
            </div>
          </form>
        )}
      </section>

      <section className="card stack" aria-labelledby="lib-runs">
        <h2 id="lib-runs" style={{ margin: 0 }}>Runs</h2>
        {overview.runs.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing has run yet.</p>}
        {overview.runs.length > 0 && (
          <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="lib-runs-caption">
            <table className="sticky-head">
              <caption id="lib-runs-caption" className="sr-only">Library runs, newest first</caption>
              <thead><tr><th>When</th><th>What</th><th>Status</th><th>Made</th><th>Cost</th><th /></tr></thead>
              <tbody>
                {overview.runs.map((r) => {
                  const open = r.status === "QUEUED" || r.status === "RUNNING";
                  return (
                    <tr key={r.runId}>
                      <td>{new Date(r.createdAt).toLocaleString()}</td>
                      <td>
                        {RUN_WORDS[r.kind] ?? r.kind}{r.course && <> · {r.course}</>}
                        {r.mode === "SAMPLE" && <span className="chip chip-warn" style={{ marginLeft: 6 }}>stand-in</span>}
                      </td>
                      <td>
                        {r.status.toLowerCase()}{open && r.phase && <span className="muted"> · {r.phase === "DRAFT" ? "drafting" : "checking"}</span>}
                        {r.error && <div className="muted">{r.error}</div>}
                      </td>
                      <td>{r.kind === "QUIZZES" || r.kind === "ACTIVITIES" || r.kind === "BANK_LOAD" || r.kind === "RECHECK" ? <>{r.published}{r.requested > 0 && <> of {r.requested}</>}</> : r.kind === "SYLLABUS" ? <>{r.published} units</> : ""}</td>
                      <td>{money(r.costUsd)}{r.budgetUsd != null && <span className="muted"> of {money(r.budgetUsd)}</span>}</td>
                      <td>
                        <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                          {(r.kind === "QUIZZES" || r.kind === "ACTIVITIES" || r.kind === "RECHECK") && (
                            <button type="button" className="btn btn-light" aria-expanded={openRun === r.runId}
                                    onClick={() => setOpenRun(openRun === r.runId ? null : r.runId)}>Details</button>
                          )}
                          {open && <button type="button" className="btn btn-light" disabled={busy !== null} onClick={() => cancel(r)}>Cancel</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {openRun && <RunItems runId={openRun} onError={onError} />}
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
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="lib-courses-caption">
          <table className="sticky-head">
            <caption id="lib-courses-caption" className="sr-only">Library courses by grade</caption>
            <thead><tr><th>Grade</th><th>Course</th><th>Subject</th><th>Quizzes</th><th>Activities</th><th>Hidden</th><th /></tr></thead>
            <tbody>
              {overview.courses.map((c) => (
                <Fragment key={c.courseId}>
                <tr>
                  <td>{gradeLabel(c.grade)}</td>
                  <td>{c.name}</td>
                  <td>{c.subject}</td>
                  <td>{c.published}</td>
                  <td>{c.activities}</td>
                  <td>{c.hidden || ""}</td>
                  <td>
                    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                      <button type="button" className="btn btn-light" aria-expanded={openCourse === c.courseId}
                              onClick={() => setOpenCourse(openCourse === c.courseId ? null : c.courseId)}>
                        Map<span className="sr-only"> of {c.name}</span>
                      </button>
                      {overview.canGenerate && (
                        <>
                          <button type="button" className="btn btn-light" disabled={busy !== null}
                                  onClick={() => prepare("SYLLABUS", c.courseId, "Syllabus map: " + c.name)}>
                            Make map<span className="sr-only"> for {c.name}</span>
                          </button>
                          <button type="button" className="btn btn-light" disabled={busy !== null}
                                  onClick={() => prepare("QUIZZES", c.courseId, "Quizzes: " + gradeLabel(c.grade) + " · " + c.name)}>
                            Quizzes<span className="sr-only"> for {c.name}</span>
                          </button>
                          <button type="button" className="btn btn-light" disabled={busy !== null}
                                  onClick={() => prepare("ACTIVITIES", c.courseId, "Activities: " + gradeLabel(c.grade) + " · " + c.name)}>
                            Activities<span className="sr-only"> for {c.name}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {openCourse === c.courseId && (
                  <tr>
                    <td colSpan={7}><CourseMap courseId={c.courseId} onError={onError} /></td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** A course's syllabus map: units with their benchmarks. A removed unit gets no new quizzes. */
function CourseMap({ courseId, onError }: { courseId: string; onError: (m: string | null) => void }) {
  const [units, setUnits] = useState<UnitRow[] | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(() => {
    api<{ course: CourseRow; units: UnitRow[] }>("/api/v1/platform/library/courses/" + courseId)
      .then((d) => { setUnits(d.units); setName(d.course.name); })
      .catch((e: unknown) => onError(message(e)));
  }, [courseId, onError]);
  useEffect(load, [load]);

  async function toggle(u: UnitRow) {
    try {
      await api("/api/v1/platform/library/units/" + u.unitId + (u.removed ? "/restore" : "/remove"), { method: "POST" });
      load();
    } catch (e) {
      onError(message(e));
    }
  }

  if (!units) return <LoadingState rows={2} label="Loading the map" />;
  const mapped = units.filter((u) => u.benchmarks.some((b) => b.description));
  return (
    <div className="stack" aria-label={"Syllabus map of " + name} role="region">
      <h3 style={{ margin: 0 }}>{name}: syllabus map</h3>
      {mapped.length === 0 && <p className="muted" style={{ margin: 0 }}>No map yet: only the bank&apos;s standards. Make the map first.</p>}
      <ol className="library-map">
        {mapped.map((u) => (
          <li key={u.unitId} className={u.removed ? "removed" : undefined}>
            <div className="row" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>{u.title}</strong>
              <span className="row" style={{ gap: 8 }}>
                <span className="muted">{u.quizzes} quizzes{u.removed && " · removed"}</span>
                <button type="button" className="btn btn-light" onClick={() => toggle(u)}>
                  {u.removed ? "Restore" : "Remove"}<span className="sr-only"> unit {u.title}</span>
                </button>
              </span>
            </div>
            <ul>
              {u.benchmarks.map((b) => (
                <li key={b.code}>
                  <code>{b.code}</code> {b.description}
                  {b.sourceUrl && <> · <a href={b.sourceUrl} target="_blank" rel="noopener noreferrer">source</a></>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** One run's quizzes: rounds used, questions kept and dropped, and the latest reason a question was dropped. */
function RunItems({ runId, onError }: { runId: string; onError: (m: string | null) => void }) {
  const [items, setItems] = useState<ItemRow[] | null>(null);

  useEffect(() => {
    api<{ items: ItemRow[] }>("/api/v1/platform/library/runs/" + runId).then((d) => setItems(d.items))
      .catch((e: unknown) => onError(message(e)));
  }, [runId, onError]);

  if (!items) return <LoadingState rows={2} label="Loading the run" />;
  if (items.length === 0) return <p className="muted" style={{ margin: 0 }}>This run has no quizzes yet.</p>;
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="lib-items-caption">
      <table className="sticky-head">
        <caption id="lib-items-caption" className="sr-only">Quizzes in this run</caption>
        <thead><tr><th>Unit</th><th>Status</th><th>Round</th><th>Kept</th><th>Dropped</th><th>Quiz or last reason</th></tr></thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.itemId}>
              <td>{i.unit ?? "–"}</td>
              <td>{i.status.toLowerCase()}</td>
              <td>{i.attempt}</td>
              <td>{i.kept}</td>
              <td>{i.dropped}</td>
              <td>{i.quizTitle ?? <span className="muted">{i.reason ?? ""}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
