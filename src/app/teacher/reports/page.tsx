"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { Trend } from "@/components/Trend";
import { AiReteachButton } from "@/components/AiReteachButton";
import { ReteachButton } from "@/components/ReteachButton";
import { ClassSummary } from "@/components/ClassSummary";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";
import { api, ApiError, downloadFile } from "@/lib/api";
import { isSchoolAdmin, useMe } from "@/lib/me";
import {
  ClassReport, classReteachPaths, countOf, defaultRange, percentTone, QuestionAccuracy, rangeQuery, SchoolReport, sourceLink, StudentRow, withQuery,
} from "@/lib/reports";
import { QTYPE_LABEL, type QType } from "@/lib/questionTypes";

export default function ReportsRoute() {
  return (
    <AppFrame>
      <Suspense>
        <Reports />
      </Suspense>
    </AppFrame>
  );
}

type TabId = "students" | "help" | "hard" | "standard";

/**
 * A class over time: pick a class and the days, then see each student's accuracy and trend, who needs help, the questions
 * the class found hardest and how they did by standard (wave3-plan.md, 3b and 3h). Teachers see the classes they teach; a
 * school admin any class of the school. Signed-in students only: a guest's answers stay in their own game's report.
 */
function Reports() {
  const me = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const initial = defaultRange();
  const classCode = params.get("class") ?? "";
  const from = params.get("from") ?? initial.from;
  const to = params.get("to") ?? initial.to;
  const [classes, setClasses] = useState<string[]>(me.classes);
  const [report, setReport] = useState<ClassReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("students");

  // A school admin can open any class of the school: the school report lists them.
  useEffect(() => {
    if (!isSchoolAdmin(me)) return;
    api<SchoolReport>("/api/v1/reports/school").then((s) =>
      setClasses([...new Set([...me.classes, ...s.classes.map((c) => c.classCode)])].sort()))
      .catch(() => undefined);
  }, [me]);

  function set(next: Record<string, string>) {
    const all = new URLSearchParams({ class: classCode, from, to, ...next });
    router.replace("/teacher/reports?" + all.toString(), { scroll: false });
  }

  const chosen = classCode || classes[0] || "";
  const query = rangeQuery({ from, to });
  useEffect(() => {
    if (!chosen) return;
    setReport(null);
    setError(null);
    api<ClassReport>(withQuery("/api/v1/reports/classes/" + encodeURIComponent(chosen), query)).then(setReport)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load this class report."));
  }, [chosen, query]);

  async function download(kind: "csv" | "xlsx") {
    try {
      await downloadFile(withQuery("/api/v1/reports/classes/" + encodeURIComponent(chosen) + "/report." + kind, query),
        "Class " + chosen + " report." + kind);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not prepare the file. Please try again.");
    }
  }

  if (classes.length === 0) {
    return (
      <div className="stack">
        <PageHeader title="Reports" />
        <EmptyState title="No class to report on yet">
          Reports follow the signed-in students of the classes you teach. Your school&apos;s system adds your classes when you sign in.
        </EmptyState>
      </div>
    );
  }

  const o = report?.overview;
  return (
    <div className="stack">
      <PageHeader title="Class reports"
                  description="How each class is doing over time, from the games and assignments its signed-in students did."
                  action={report && <div className="row" style={{ gap: 8 }}>
                    <button type="button" className="btn btn-light" onClick={() => download("csv")}>Download CSV</button>
                    <button type="button" className="btn btn-light" onClick={() => download("xlsx")}>Download Excel</button>
                  </div>} />
      <form className="report-filters" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="rep-class">Class</label>
          <select id="rep-class" value={chosen} onChange={(e) => set({ class: e.target.value })}>
            {classes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rep-from">From</label>
          <input id="rep-from" type="date" value={from} max={to} onChange={(e) => e.target.value && set({ from: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="rep-to">To</label>
          <input id="rep-to" type="date" value={to} min={from} onChange={(e) => e.target.value && set({ to: e.target.value })} />
        </div>
      </form>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!report && !error && <LoadingState rows={5} label="Loading the class report" />}
      {report && o && (
        <>
          <div className="report-cards">
            <div className="card"><span className="muted">Games and assignments</span><strong>{o.totals.sessions}</strong></div>
            <div className="card"><span className="muted">Students who answered</span><strong>{o.totals.students}</strong>
              <span className="muted">of {report.students.length} in the class</span></div>
            <div className="card"><span className="muted">Accuracy</span><strong>{o.totals.sessions ? o.totals.percent + "%" : "–"}</strong></div>
            <div className="card"><span className="muted">Need help</span><strong>{report.needsHelp.length}</strong>
              <span className="muted">under 50% over their last 5</span></div>
          </div>
          {o.totals.sessions === 0 ? (
            <EmptyState title="No results in these days">
              Host a game or assign a quiz to this class with &quot;Only signed-in students&quot;, and each student&apos;s answers appear here. Try a longer range if you played earlier.
            </EmptyState>
          ) : (
            <>
              <ClassSummary classCode={chosen} query={query} />
              <ReportTabs tab={tab} setTab={setTab} report={report}
                          reteach={classReteachPaths(chosen, query)}
                          onError={setError} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function ReportTabs({ tab, setTab, report, reteach, onError }: {
  tab: TabId; setTab: (t: TabId) => void; report: ClassReport; reteach: ReteachPaths; onError: (message: string) => void;
}) {
  const id = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tabs: { id: TabId; label: string }[] = [
    { id: "students", label: "Students (" + report.students.length + ")" },
    { id: "help", label: "Needs help (" + report.needsHelp.length + ")" },
    { id: "hard", label: "Difficult questions (" + report.overview.difficult.length + ")" },
    { id: "standard", label: "By standard (" + report.overview.byStandard.length + ")" },
  ];

  /** Arrow keys move between tabs (the tabs pattern); the panel follows. */
  function keys(e: React.KeyboardEvent, i: number) {
    const to = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const next = tabs[(to + tabs.length) % tabs.length];
    setTab(next.id);
    refs.current[next.id]?.focus();
  }

  return (
    <div className="stack">
      <div className="tabs" role="tablist" aria-label="Class report">
        {tabs.map((t, i) => (
          <button key={t.id} id={id + t.id} ref={(el) => { refs.current[t.id] = el; }} type="button" role="tab" aria-selected={tab === t.id}
                  aria-controls={id + "panel"} tabIndex={tab === t.id ? 0 : -1} className={tab === t.id ? "active" : ""}
                  onClick={() => setTab(t.id)} onKeyDown={(e) => keys(e, i)}>{t.label}</button>
        ))}
      </div>
      <div id={id + "panel"} role="tabpanel" aria-labelledby={id + tab} className="stack">
        {tab === "students" && <StudentsTable rows={report.students} caption="Every student of the class, those who need help first" />}
        {tab === "help" && (report.needsHelp.length === 0
          ? <EmptyState title="Nobody needs help right now">No student is under 50% over their last 5 games or assignments in these days.</EmptyState>
          : <StudentsTable rows={report.needsHelp} caption="Students under 50% over their last five scored games or assignments" />)}
        {tab === "hard" && <HardQuestions rows={report.overview.difficult} reteach={reteach} onError={onError} />}
        {tab === "standard" && <ByStandard report={report} />}
      </div>
    </div>
  );
}

function StudentsTable({ rows, caption }: { rows: StudentRow[]; caption: string }) {
  const cap = useId();
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-labelledby={cap}>
      <table className="sticky-head">
        <caption id={cap} className="sr-only">{caption}</caption>
        <thead>
          <tr><th>Student</th><th>Games and assignments</th><th>Answers</th><th>Accuracy</th><th>Last 5</th><th>Trend</th></tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.userId}>
              <th scope="row"><Link href={"/teacher/reports/students/" + s.userId}>{s.name}</Link>
                {s.needsHelp && <> <span className="chip chip-danger">Needs help</span></>}</th>
              <td>{s.sessions}</td>
              <td>{s.answers}</td>
              <td>{s.sessions ? <span className={"chip chip-" + percentTone(s.percent)}>{s.percent}%</span> : <span className="muted">No answers yet</span>}</td>
              <td>{s.sessions ? s.recentPercent + "%" : "–"}</td>
              <td><Trend values={s.trend} label={"Accuracy of " + s.name} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ReteachPaths = ReturnType<typeof classReteachPaths>;

function HardQuestions({ rows, reteach, onError }: { rows: QuestionAccuracy[]; reteach: ReteachPaths; onError: (message: string) => void }) {
  const hint = useId();
  if (rows.length === 0) {
    return <EmptyState title="No difficult questions">No question was under 35% fully right, with at least two answers, in these days.</EmptyState>;
  }
  return (
    <>
      <div className="row reteach-row">
        <ReteachButton path={reteach.reteach} hard={rows.length} onError={onError} describedBy={hint} />
        <AiReteachButton path={reteach.aiReteach} hard={rows.length} onError={onError} />
        <span id={hint} className="muted">Copies {rows.length === 1 ? "this question" : "these " + rows.length + " questions"} into a new draft quiz, or AI drafts new ones like them for you to review in AI Studio (that counts towards your school&apos;s monthly AI limit).</span>
      </div>
      <ol className="question-list">
        {rows.map((q) => <HardQuestion key={q.questionId} q={q} />)}
      </ol>
    </>
  );
}

function HardQuestion({ q }: { q: QuestionAccuracy }) {
  return (
    <li className="card stack" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong>{q.text}</strong>
        <span className="row" style={{ gap: 6 }}>
          <span className="chip">{QTYPE_LABEL[q.type as QType] ?? q.type}</span>
          <span className="chip chip-danger">{q.percentRight}% fully right</span>
        </span>
      </div>
      <p className="muted">{countOf(q.answered, "answer")} in these days</p>
      {q.sources.length > 0 && (
        <p className="muted">Asked in:{" "}
          {q.sources.map((s, i) => {
            const href = sourceLink(s);
            const text = s.title + " (" + (s.source === "GAME" ? "game" : "assignment") + ", " + new Date(s.at).toLocaleDateString() + ")";
            return <span key={i}>{i > 0 && ", "}{href ? <Link href={href}>{text}</Link> : text}</span>;
          })}
        </p>
      )}
    </li>
  );
}

function ByStandard({ report }: { report: ClassReport }) {
  const rows = report.overview.byStandard;
  if (rows.length === 0) {
    return (
      <EmptyState title="No standards in these results">
        Add a standard code to your questions in the quiz editor, and this tab shows how the class did on each code. Quizzes from the library already carry theirs.
      </EmptyState>
    );
  }
  return (
    <div className="stack">
      {rows.map((s) => (
        <details key={s.standard} className="card standard-row">
          <summary>
            <strong>{s.standard}</strong>
            <span className={"chip chip-" + percentTone(s.percentRight)}>{s.percentRight}% fully right</span>
            <span className="muted">{countOf(s.answered, "answer")} · {countOf(s.questions.length, "question")}</span>
          </summary>
          <ul className="standard-questions">
            {s.questions.map((q) => (
              <li key={q.questionId}><span>{q.text}</span> <span className="muted">{q.percentRight}% · {countOf(q.answered, "answer")}</span></li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
