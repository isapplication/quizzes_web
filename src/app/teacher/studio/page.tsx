"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { QuestionForm } from "@/components/QuestionForm";
import { api } from "@/lib/api";
import {
  DEFAULT_TYPES, draftToEditor, type DraftKind, type Estimate, estimateText, overAllowance, type ReviewItem, SOURCES,
  type SourceKind, sourceProblem, startBody, type StartSettings, toPublish, WRITABLE,
} from "@/lib/aiStudio";
import { gradeLabel } from "@/lib/content";
import { useMe } from "@/lib/me";
import { PageHeader } from "@/components/ui/States";
import { changeType, keyText, missing, QTYPE_HINT, QTYPE_LABEL, type QType, scored } from "@/lib/questionTypes";

interface StudioStatus {
  mode: "LIVE" | "SAMPLE";
  model: string;
  promptVersion: string;
  notice: string | null;
}

interface Draft {
  position: number;
  status: "PASSED" | "DROPPED_FORMAT" | "DROPPED_ANSWER_CHECK";
  detail: string | null;
  question: Record<string, unknown> & { text: string; type: QType };
}

interface Run {
  runId: string;
  status: "DRAFTING" | "CHECKING" | "READY" | "FAILED" | "PUBLISHED";
  topic: string;
  grade: number;
  subject: string;
  suggestedTitle: string | null;
  received: number;
  passed: number;
  dropped: number;
  errorMessage: string | null;
  publishedQuizId: string | null;
  drafts: Draft[];
  kind?: DraftKind;
  sourceKind?: SourceKind;
  sourceTitle?: string | null;
  sourcePages?: number | null;
}

const SUBJECTS = ["Math", "Science", "ELA", "Social Studies"];
const COUNTS = [5, 10, 15];
const LESSON_TYPES: QType[] = [...WRITABLE, "SLIDE"];

export default function StudioPage() {
  return (
    <AppFrame>
      <Studio />
    </AppFrame>
  );
}

function Studio() {
  const router = useRouter();
  const me = useMe();
  const id = useId();
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [kind, setKind] = useState<DraftKind>("QUIZ");
  const [sourceKind, setSourceKind] = useState<SourceKind>("TOPIC");
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [wikipedia, setWikipedia] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [grade, setGrade] = useState(8);
  const [subject, setSubject] = useState("Science");
  const [count, setCount] = useState(10);
  const [classCode, setClassCode] = useState("");
  const [types, setTypes] = useState<QType[]>(DEFAULT_TYPES);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [items, setItems] = useState<(ReviewItem & { removed: boolean })[]>([]);
  const [editing, setEditing] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    api<StudioStatus>("/api/v1/ai/status").then(setStatus).catch((e: Error) => setError(e.message));
  }, []);

  // The cost before drafting (W53), from what the run will be; never the source itself.
  useEffect(() => {
    const timer = setTimeout(() => {
      api<Estimate>("/api/v1/ai/estimate", {
        method: "POST",
        body: { count, subject, kind, sourceKind, textLength: sourceKind === "TEXT" ? text.trim().length : null,
          pages: null, photos: sourceKind === "PHOTOS" ? files.length : null },
      }).then(setEstimate).catch(() => setEstimate(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [count, subject, kind, sourceKind, text, files.length]);

  // Poll the run while Claude drafts and checks.
  useEffect(() => {
    if (!runId) return;
    let stop = false;
    async function poll() {
      while (!stop) {
        try {
          const r = await api<Run>("/api/v1/ai/drafts/" + runId);
          setRun(r);
          if (r.status === "READY" || r.status === "FAILED" || r.status === "PUBLISHED") {
            // New drafts that passed are kept by default, in the run's order; the teacher removes what they don't want.
            const fresh = r.drafts.filter((d) => d.status === "PASSED" && !seen.current.has(d.position));
            fresh.forEach((d) => seen.current.add(d.position));
            setItems((current) => [...current,
              ...fresh.map((d) => ({ position: d.position, q: draftToEditor(d.question), removed: false }))]);
            setTitle((t) => t || r.suggestedTitle || "");
            setBusy(false);
            return;
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Could not load the drafts.");
          setBusy(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
    poll();
    return () => {
      stop = true;
    };
  }, [runId, run?.status === "DRAFTING" || run?.status === "CHECKING" ? 1 : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const problem = sourceProblem(sourceKind, { topic, text, wikipedia,
    files: files.map((f) => ({ name: f.name, size: f.size, type: f.type })) })
    ?? (types.length === 0 ? "Pick at least one kind of question." : null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    setRun(null);
    setItems([]);
    setEditing(null);
    seen.current = new Set();
    setTitle("");
    const settings: StartSettings = { kind, sourceKind, topic, text, wikipedia, grade, subject, count,
      classCode: classCode || null, types: kind === "LESSON" ? [...types, "SLIDE"] : types };
    try {
      const r = await api<{ runId: string }>("/api/v1/ai/drafts", { method: "POST", body: startBody(settings, files) });
      setRunId(r.runId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI Studio could not start.");
      setBusy(false);
    }
  }

  async function more() {
    if (!runId || !run) return;
    setError(null);
    setBusy(true);
    try {
      await api("/api/v1/ai/drafts/" + runId + "/more", { method: "POST", body: { count: Math.max(1, run.dropped) } });
      setRun({ ...run, status: "DRAFTING" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ask for more drafts.");
      setBusy(false);
    }
  }

  async function publish() {
    if (!runId) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api<{ quizId: string }>("/api/v1/ai/drafts/" + runId + "/publish", {
        method: "POST",
        body: { title, questions: items.filter((i) => !i.removed).map(toPublish) },
      });
      router.push("/teacher/quiz/" + r.quizId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The quiz could not be published.");
      setBusy(false);
    }
  }

  function update(index: number, patch: Partial<ReviewItem["q"]>) {
    setItems((now) => now.map((it, k) => (k === index ? { ...it, q: { ...it.q, ...patch } } : it)));
  }

  function setRemoved(index: number, removed: boolean) {
    setItems((now) => now.map((it, k) => (k === index ? { ...it, removed } : it)));
  }

  function move(index: number, by: number) {
    const to = index + by;
    if (to < 0 || to >= items.length) return;
    setItems((now) => {
      const next = [...now];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
    setEditing(to);
  }

  const working = run && (run.status === "DRAFTING" || run.status === "CHECKING");
  const dropped = run?.drafts.filter((d) => d.status !== "PASSED") ?? [];
  const solutionNotes = run?.drafts.filter((d) => d.status === "PASSED" && d.detail) ?? [];
  const kept = items.filter((i) => !i.removed);
  const fromSource = !!run?.sourceKind && run.sourceKind !== "TOPIC";
  const runSubject = run?.subject ?? subject;
  const unfinished = kept.map((i) => missing(i.q)).find((m) => m) ?? null;
  const lessonRun = run?.kind === "LESSON";

  return (
    <div className="stack">
      <PageHeader title="AI Studio" description={<>
        Draft a quiz or a lesson from a topic or your own material. Each question is checked for the Quizplayo question
        format, then answered again without the answer key; you only see drafts that passed, and you approve every one.
      </>} />
      {status?.notice && <div className="alert alert-warning">{status.notice}</div>}

      <form className="card stack" onSubmit={start} noValidate>
        <fieldset className="studio-choice">
          <legend>What to draft</legend>
          <label className="check">
            <input type="radio" name="kind" value="QUIZ" checked={kind === "QUIZ"} onChange={() => setKind("QUIZ")} />
            <span>A quiz <span className="muted">questions only</span></span>
          </label>
          <label className="check">
            <input type="radio" name="kind" value="LESSON" checked={kind === "LESSON"} onChange={() => setKind("LESSON")} />
            <span>A lesson <span className="muted">slides that teach, and questions that check</span></span>
          </label>
        </fieldset>

        <fieldset className="studio-choice">
          <legend>Draft from</legend>
          {SOURCES.map((s) => (
            <label key={s.kind} className="check">
              <input type="radio" name="source" value={s.kind} checked={sourceKind === s.kind}
                     aria-describedby={id + "-src-" + s.kind}
                     onChange={() => { setSourceKind(s.kind); setFiles([]); setError(null); }} />
              <span>{s.label} <span className="muted" id={id + "-src-" + s.kind}>{s.hint}</span></span>
            </label>
          ))}
        </fieldset>

        {sourceKind === "TEXT" && (
          <div className="field">
            <label htmlFor={id + "-text"}>Text to draft from</label>
            <textarea id={id + "-text"} rows={8} maxLength={20_000} value={text} aria-describedby={id + "-text-hint"}
                      onChange={(e) => setText(e.target.value)} placeholder="Paste a reading passage, an article or your notes" />
            <p className="hint" id={id + "-text-hint"}>{text.trim().length.toLocaleString()} / 20,000 characters</p>
          </div>
        )}
        {sourceKind === "WIKIPEDIA" && (
          <div className="field">
            <label htmlFor={id + "-wiki"}>Wikipedia article</label>
            <input id={id + "-wiki"} type="text" maxLength={500} value={wikipedia} autoCorrect="off" autoCapitalize="off"
                   spellCheck={false} onChange={(e) => setWikipedia(e.target.value)}
                   placeholder="For example: Water cycle, or https://en.wikipedia.org/wiki/Water_cycle" />
          </div>
        )}
        {(sourceKind === "PDF" || sourceKind === "PHOTOS") && (
          <div className="field">
            <label htmlFor={id + "-files"}>{sourceKind === "PDF" ? "PDF" : "Photos of notes"}</label>
            <input id={id + "-files"} type="file" multiple={sourceKind === "PHOTOS"} aria-describedby={id + "-files-hint"}
                   accept={sourceKind === "PDF" ? "application/pdf,.pdf" : "image/jpeg,image/png"}
                   onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
            <p className="hint" id={id + "-files-hint"}>Quizplayo reads the file for this draft only and doesn&apos;t keep it.</p>
          </div>
        )}
        <div className="field">
          <label htmlFor={id + "-topic"}>{sourceKind === "TOPIC" ? "Topic" : "What to focus on (optional)"}</label>
          <textarea id={id + "-topic"} rows={2} maxLength={300} value={topic} onChange={(e) => setTopic(e.target.value)}
                    placeholder={sourceKind === "TOPIC" ? "For example: Photosynthesis and how plants make food"
                      : "For example: only the part about evaporation"} />
        </div>

        <div className="row" style={{ flexWrap: "wrap" }}>
          <label htmlFor={id + "-grade"}>Grade</label>
          <select id={id + "-grade"} value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            {Array.from({ length: 13 }, (_, g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
          </select>
          <label htmlFor={id + "-subject"}>Subject</label>
          <select id={id + "-subject"} value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <label htmlFor={id + "-count"}>{kind === "LESSON" ? "Slides and questions" : "Questions"}</label>
          <select id={id + "-count"} value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {COUNTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {me.classes.length > 0 && (
            <>
              <label htmlFor={id + "-class"}>For</label>
              <select id={id + "-class"} value={classCode} onChange={(e) => setClassCode(e.target.value)}>
                <option value="">My workspace</option>
                {me.classes.map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </>
          )}
        </div>
        {(subject === "Math" || subject === "Science") && (
          <p className="hint" style={{ margin: 0 }}>
            {subject} questions that need working out get a worked solution too. Students see it only after they answer.
          </p>
        )}

        <fieldset className="type-pick">
          <legend>{kind === "LESSON" ? "Kinds of question in the lesson" : "Question types"}</legend>
          <div className="type-pick-options">
            {WRITABLE.map((t) => (
              <label key={t} title={QTYPE_HINT[t]}>
                <input type="checkbox" name="types" value={t} checked={types.includes(t)}
                       onChange={(e) => setTypes((now) => e.target.checked ? WRITABLE.filter((x) => x === t || now.includes(x))
                         : now.filter((x) => x !== t))} />
                {QTYPE_LABEL[t]}
              </label>
            ))}
          </div>
          <p className="hint" id={id + "-types-hint"}>
            {types.length === 0 ? "Pick at least one type." : "Claude mixes the types you pick. A poll has no right answer, "
              + "so it gets the format check only."}{kind === "LESSON" && " The lesson adds slides between the questions."}
          </p>
        </fieldset>

        {estimate && (
          <p className={"studio-estimate" + (overAllowance(estimate) ? " over" : "")} role="status">{estimateText(estimate)}</p>
        )}
        <div className="row">
          <span className="spacer" />
          <button className="btn btn-primary" type="submit" disabled={busy} aria-describedby={id + "-types-hint"}>
            {busy && !run ? "Starting…" : kind === "LESSON" ? `Draft a lesson of ${count}` : `Draft ${count} questions`}
          </button>
        </div>
        {status && <p className="muted">Model: {status.model} · prompt {status.promptVersion}</p>}
      </form>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {working && (
        <div className="alert" role="status">
          {run.status === "DRAFTING" ? "Claude is drafting…" : "Checking each draft: format, then answering it without the key…"}
        </div>
      )}
      {run?.status === "FAILED" && <div className="alert alert-danger">{run.errorMessage}</div>}

      {run && run.received > 0 && (
        <div className="card stack">
          <div className="row" style={{ flexWrap: "wrap" }}>
            <h2>Drafts</h2>
            <span className="chip">{run.received} drafted</span>
            <span className="chip chip-ok">✓ {run.passed} passed</span>
            {run.dropped > 0 && <span className="chip chip-danger">✕ {run.dropped} dropped</span>}
            <span className="spacer" />
            {run.status === "READY" && run.dropped > 0 && !fromSource && (
              <button className="btn btn-light" onClick={more} disabled={busy}>Draft {run.dropped} more</button>
            )}
          </div>
          {fromSource && run.sourceTitle && (
            <p className="muted" style={{ margin: 0 }}>
              From {run.sourceTitle}
              {run.sourcePages ? ` (${run.sourcePages} ${run.sourceKind === "PHOTOS" ? "photo" : "page"}${run.sourcePages === 1 ? "" : "s"})` : ""}.
              Quizplayo didn&apos;t keep it: to draft more from it, start a new draft.
            </p>
          )}

          <ol className="review-list">
            {items.map((it, index) => (
              <li key={(it.position ?? "copy") + "-" + index} className={"draft" + (it.removed ? " removed" : "")}>
                {it.removed ? (
                  <div className="row">
                    <span className="muted">Removed: {it.q.type === "SLIDE" ? it.q.payload.title : it.q.text}</span>
                    <span className="spacer" />
                    <button className="btn btn-light" onClick={() => setRemoved(index, false)}>Put back</button>
                  </div>
                ) : editing === index ? (
                  <div className="stack">
                    <QuestionForm index={index} q={it.q} total={items.length} problem={missing(it.q)} subject={runSubject}
                                  types={lessonRun ? LESSON_TYPES : WRITABLE} pictures={false}
                                  onChange={(patch) => update(index, patch)}
                                  onType={(t) => update(index, changeType(it.q, t))}
                                  onMove={(by) => move(index, by)}
                                  onCopy={() => setItems((n) => [...n.slice(0, index + 1), { ...it, position: null }, ...n.slice(index + 1)])}
                                  onRemove={() => { setRemoved(index, true); setEditing(null); }} />
                    <div className="row"><button className="btn btn-secondary" onClick={() => setEditing(null)}>Done</button></div>
                  </div>
                ) : (
                  <ReviewCard item={it} onEdit={() => setEditing(index)} onRemove={() => setRemoved(index, true)} />
                )}
              </li>
            ))}
          </ol>

          {dropped.length > 0 && (
            <details>
              <summary>Why {dropped.length} {dropped.length === 1 ? "draft was" : "drafts were"} dropped</summary>
              <ul>
                {dropped.map((d) => (
                  <li key={d.position} style={{ margin: "8px 0" }}>
                    <strong>{d.question.text}</strong>
                    <br />
                    <span className="muted">{d.detail}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {solutionNotes.length > 0 && (
            <details>
              <summary>Worked solutions that were removed</summary>
              <ul>
                {solutionNotes.map((d) => (
                  <li key={d.position} style={{ margin: "8px 0" }}>
                    <strong>{d.question.text}</strong>
                    <br />
                    <span className="muted">{d.detail} The question itself passed and is kept.</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {run.status === "READY" && (
            <div className="stack" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              {unfinished && <p className="hint hint-danger" style={{ margin: 0 }}>Before publishing: {unfinished}</p>}
              <div className="row" style={{ flexWrap: "wrap" }}>
                <label htmlFor={id + "-title"}>{lessonRun ? "Lesson title" : "Quiz title"}</label>
                <input id={id + "-title"} type="text" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)}
                       style={{ flex: "1 1 220px", minWidth: 0 }} />
                <button className="btn btn-primary" onClick={publish} disabled={busy || kept.length === 0 || !title.trim()}>
                  Publish {kept.length} {lessonRun ? "items" : "questions"}
                </button>
              </div>
            </div>
          )}
          {run.status === "PUBLISHED" && run.publishedQuizId && (
            <div className="alert alert-success">
              Published. <a href={"/teacher/quiz/" + run.publishedQuizId}>Open it</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A kept draft at a glance: its type, its text, its answer in words, and its worked solution if it has one. */
function ReviewCard({ item, onEdit, onRemove }: { item: ReviewItem; onEdit: () => void; onRemove: () => void }) {
  const q = item.q;
  const slide = q.type === "SLIDE";
  const withChoices = q.type === "QUIZ" || q.type === "TRUE_FALSE" || q.type === "MULTI_SELECT" || q.type === "POLL";
  const answer = slide || withChoices ? null
    : keyText(q.type, { accept: q.payload.accept, answer: q.payload.answer ?? undefined, tol: q.payload.tol ?? undefined,
      unit: q.payload.unit, order: q.type === "PUZZLE" ? q.choices : undefined, categories: q.payload.categories,
      catItems: q.payload.catItems }, q.choices, q.correctIndexes, q.payload.step ?? 1);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <span className="chip">{QTYPE_LABEL[q.type] ?? q.type}</span>
        <span className="chip chip-ok">✓ {scored(q.type) ? "Passed both checks" : "Passed the format check"}</span>
        {q.solution && <span className="chip">Worked solution</span>}
        <span className="spacer" />
        <button className="btn btn-light" onClick={onEdit}>Edit</button>
        <button className="btn btn-light" onClick={onRemove}>Remove</button>
      </div>
      {slide ? (
        <>
          <strong>{q.payload.title}</strong>
          <p style={{ margin: 0 }}>{q.text}</p>
        </>
      ) : (
        <strong>{q.text}</strong>
      )}
      {withChoices && (
        <ul className="review-choices">
          {q.choices.map((c, i) => (
            <li key={i} className={q.correctIndexes.includes(i) ? "correct" : ""}>
              {c}{q.correctIndexes.includes(i) && <strong className="correct-label"> ✓ Correct</strong>}
            </li>
          ))}
        </ul>
      )}
      {answer && <p style={{ margin: 0 }}>The answer: <strong>{answer}</strong></p>}
      {q.explanation && <p className="muted" style={{ margin: 0 }}>{q.explanation}</p>}
      {q.solution && (
        <details>
          <summary>The worked solution</summary>
          <ol className="steps-list">
            {q.solution.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}
          </ol>
        </details>
      )}
    </div>
  );
}
