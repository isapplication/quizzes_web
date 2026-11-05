"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { AnswerShape } from "@/components/AnswerShape";
import { api } from "@/lib/api";
import { gradeLabel } from "@/lib/content";
import { useMe } from "@/lib/me";
import { PageHeader } from "@/components/ui/States";
import { type AnswerKey, keyText, QTYPE_HINT, QTYPE_LABEL, type QType } from "@/lib/questionTypes";

interface StudioStatus {
  mode: "LIVE" | "SAMPLE";
  model: string;
  promptVersion: string;
  notice: string | null;
}

/** A draft in the editor's shape (wave1b-contract.md): a puzzle's choices are its items in the right order. */
interface DraftQuestion {
  type: QType;
  text: string;
  choices: string[];
  correctIndex: number;
  correctIndexes?: number[];
  payload?: { accept?: string[]; min?: number; max?: number; step?: number; answer?: number; tol?: number; unit?: string };
  explanation: string;
  timeLimitSeconds: number;
}

interface Draft {
  position: number;
  status: "PASSED" | "DROPPED_FORMAT" | "DROPPED_ANSWER_CHECK";
  detail: string | null;
  question: DraftQuestion;
}

interface Run {
  runId: string;
  status: "DRAFTING" | "CHECKING" | "READY" | "FAILED" | "PUBLISHED";
  mode: string;
  model: string;
  promptVersion: string;
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
}

const SUBJECTS = ["Math", "Science", "ELA", "Social Studies"];
/** The types AI Studio can write: every type with a right answer its check can test (not polls or slides). */
const WRITABLE: QType[] = ["QUIZ", "TRUE_FALSE", "MULTI_SELECT", "TYPE_ANSWER", "SLIDER", "PUZZLE"];
const DEFAULT_TYPES: QType[] = ["QUIZ", "TRUE_FALSE"];
const TIMES = [10, 20, 30, 45, 60];

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
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState(8);
  const [subject, setSubject] = useState("Science");
  const [classCode, setClassCode] = useState("");
  const [types, setTypes] = useState<QType[]>(DEFAULT_TYPES);
  const [runId, setRunId] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [kept, setKept] = useState<Record<number, DraftQuestion>>({});
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    api<StudioStatus>("/api/v1/ai/status").then(setStatus).catch((e: Error) => setError(e.message));
  }, []);

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
            // New drafts that passed are kept by default; the teacher removes what they do not want.
            const fresh = r.drafts.filter((d) => d.status === "PASSED" && !seen.current.has(d.position));
            fresh.forEach((d) => seen.current.add(d.position));
            setKept((current) => {
              const next = { ...current };
              for (const d of fresh) next[d.position] = d.question;
              return next;
            });
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

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setRun(null);
    setKept({});
    seen.current = new Set();
    setTitle("");
    try {
      const r = await api<{ runId: string }>("/api/v1/ai/drafts", {
        method: "POST",
        body: { topic, grade, subject, count: 10, classCode: classCode || null, types },
      });
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
    const questions = Object.keys(kept)
      .map(Number)
      .sort((a, b) => a - b)
      .map((p) => ({ ...kept[p], position: p }));
    try {
      const r = await api<{ quizId: string }>("/api/v1/ai/drafts/" + runId + "/publish", {
        method: "POST",
        body: { title, questions },
      });
      router.push("/teacher/quiz/" + r.quizId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The quiz could not be published.");
      setBusy(false);
    }
  }

  const working = run && (run.status === "DRAFTING" || run.status === "CHECKING");
  const passed = run?.drafts.filter((d) => d.status === "PASSED") ?? [];
  const dropped = run?.drafts.filter((d) => d.status !== "PASSED") ?? [];
  const keptCount = Object.keys(kept).length;

  return (
    <div className="stack">
      <PageHeader title="AI Studio" description={<>
        Describe a topic. Claude drafts 10 questions; each is checked for the Quizplayo question format, then answered
        again without the answer key. You only see drafts that passed both checks, and you approve every question.
      </>} />
      {status?.notice && <div className="alert alert-warning">{status.notice}</div>}

      <form className="card stack" onSubmit={start}>
        <label htmlFor="topic">Topic</label>
        <textarea
          id="topic"
          rows={2}
          maxLength={300}
          placeholder="For example: Photosynthesis and how plants make food"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          required
        />
        <div className="row">
          <label htmlFor="grade">Grade</label>
          <select id="grade" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            {Array.from({ length: 13 }, (_, g) => (
              <option key={g} value={g}>
                {gradeLabel(g)}
              </option>
            ))}
          </select>
          <label htmlFor="subject">Subject</label>
          <select id="subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {me.classes.length > 0 && (
            <>
              <label htmlFor="for-class">For</label>
              <select id="for-class" value={classCode} onChange={(e) => setClassCode(e.target.value)}>
                <option value="">My workspace</option>
                {me.classes.map((c) => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </>
          )}
        </div>
        <fieldset className="type-pick">
          <legend>Question types</legend>
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
          <p className="hint" id="type-pick-hint">
            {types.length === 0 ? "Pick at least one type." : "Claude mixes the types you pick. Every question is checked the same way."}
          </p>
        </fieldset>
        <div className="row">
          <span className="spacer" />
          <button className="btn btn-primary" type="submit" disabled={busy || topic.trim().length < 3 || types.length === 0}
                  aria-describedby="type-pick-hint">
            Draft 10 questions
          </button>
        </div>
        {status && (
          <p className="muted">
            Model: {status.model} · prompt {status.promptVersion}
          </p>
        )}
      </form>

      {error && <div className="alert alert-danger">{error}</div>}
      {working && (
        <div className="alert" role="status">
          {run.status === "DRAFTING" ? "Claude is drafting questions…" : "Checking each draft: format, then answering it without the key…"}
        </div>
      )}
      {run?.status === "FAILED" && <div className="alert alert-danger">{run.errorMessage}</div>}

      {run && run.received > 0 && (
        <div className="card stack">
          <div className="row">
            <h2>Drafts</h2>
            <span className="chip">{run.received} drafted</span>
            <span className="chip" style={{ background: "#e6f5ea", color: "var(--success)" }}>
              ✓ {run.passed} passed
            </span>
            {run.dropped > 0 && (
              <span className="chip" style={{ background: "#fde8ee", color: "var(--danger)" }}>
                ✕ {run.dropped} dropped
              </span>
            )}
            <span className="spacer" />
            {run.status === "READY" && run.dropped > 0 && (
              <button className="btn btn-light" onClick={more} disabled={busy}>
                Draft {run.dropped} more
              </button>
            )}
          </div>

          {passed.map((d) => (
            <DraftEditor
              key={d.position}
              draft={d}
              value={kept[d.position]}
              onChange={(q) => setKept({ ...kept, [d.position]: q })}
              onRemove={() => {
                const next = { ...kept };
                delete next[d.position];
                setKept(next);
              }}
              onRestore={() => setKept({ ...kept, [d.position]: d.question })}
            />
          ))}

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

          {run.status === "READY" && (
            <div className="row" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <label htmlFor="title">Quiz title</label>
              <input id="title" type="text" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={publish} disabled={busy || keptCount === 0 || !title.trim()}>
                Publish {keptCount} questions
              </button>
            </div>
          )}
          {run.status === "PUBLISHED" && run.publishedQuizId && (
            <div className="alert alert-success">
              Published. <a href={"/teacher/quiz/" + run.publishedQuizId}>Open the quiz</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DraftEditor({
  draft,
  value,
  onChange,
  onRemove,
  onRestore,
}: {
  draft: Draft;
  value: DraftQuestion | undefined;
  onChange: (q: DraftQuestion) => void;
  onRemove: () => void;
  onRestore: () => void;
}) {
  if (!value) {
    return (
      <div className="draft removed">
        <span className="muted">Removed: {draft.question.text}</span>
        <button className="btn btn-light" onClick={onRestore}>
          Put back
        </button>
      </div>
    );
  }
  const tf = value.type === "TRUE_FALSE";
  const multi = value.type === "MULTI_SELECT";
  const withOptions = value.type === "QUIZ" || tf || multi;
  const right = multi ? value.correctIndexes ?? [] : [value.correctIndex];
  const key: AnswerKey = value.type === "PUZZLE" ? { order: value.choices }
    : { accept: value.payload?.accept, answer: value.payload?.answer, tol: value.payload?.tol, unit: value.payload?.unit };
  const answer = withOptions ? null : keyText(value.type, key, value.choices, right, value.payload?.step ?? 1);
  function mark(i: number) {
    if (!value) return;
    if (!multi) {
      onChange({ ...value, correctIndex: i });
      return;
    }
    const now = value.correctIndexes ?? [];
    onChange({ ...value, correctIndexes: now.includes(i) ? now.filter((x) => x !== i) : [...now, i].sort((a, b) => a - b) });
  }
  return (
    <div className="draft">
      <div className="row">
        <span className="chip">{QTYPE_LABEL[value.type] ?? value.type}</span>
        <span className="chip" style={{ background: "#e6f5ea", color: "var(--success)" }}>
          ✓ Passed both checks
        </span>
        <span className="spacer" />
        <select
          aria-label="Timer"
          value={value.timeLimitSeconds}
          onChange={(e) => onChange({ ...value, timeLimitSeconds: Number(e.target.value) })}
        >
          {TIMES.map((t) => (
            <option key={t} value={t}>
              {t} s
            </option>
          ))}
        </select>
        <button className="btn btn-light" onClick={onRemove}>
          Remove
        </button>
      </div>
      <input
        type="text"
        aria-label="Question"
        maxLength={120}
        value={value.text}
        onChange={(e) => onChange({ ...value, text: e.target.value })}
        style={{ width: "100%", fontWeight: 600 }}
      />
      {withOptions && (
        <div className="choice-edit">
          {value.choices.map((c, i) => (
            <label key={i} className={right.includes(i) ? "correct" : ""}>
              <input
                type={multi ? "checkbox" : "radio"}
                name={"correct-" + draft.position}
                checked={right.includes(i)}
                onChange={() => mark(i)}
                aria-label={"Mark option " + (i + 1) + " as correct"}
              />
              <AnswerShape index={i} size={16} />
              {tf ? (
                <span>{c}</span>
              ) : (
                <input
                  type="text"
                  maxLength={75}
                  value={c}
                  aria-label={"Option " + (i + 1)}
                  onChange={(e) => {
                    const choices = [...value.choices];
                    choices[i] = e.target.value;
                    onChange({ ...value, choices });
                  }}
                />
              )}
              {right.includes(i) && <strong className="correct-label">✓ Correct</strong>}
            </label>
          ))}
        </div>
      )}
      {answer && (
        <p style={{ margin: 0 }}>
          {value.type === "TYPE_ANSWER" ? "Accepted: " : value.type === "PUZZLE" ? "The right order: " : "The answer: "}
          <strong>{answer}</strong>
          <span className="hint"> You can change it in the quiz editor after publishing.</span>
        </p>
      )}
      <input
        type="text"
        aria-label="Explanation"
        maxLength={160}
        value={value.explanation}
        onChange={(e) => onChange({ ...value, explanation: e.target.value })}
        style={{ width: "100%" }}
        className="muted"
      />
    </div>
  );
}
