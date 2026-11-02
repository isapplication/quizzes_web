"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { AnswerShape } from "@/components/AnswerShape";
import { api, ApiError } from "@/lib/api";
import { EditorQuestion, Editing, POINTS, SUBJECTS, TIMES } from "@/lib/content";
import { GRADES } from "@/lib/school";
import { LoadingState } from "@/components/ui/States";

export default function EditQuizPage() {
  return (
    <AppFrame wide>
      <Editor />
    </AppFrame>
  );
}

const MAX_TEXT = 120;
const MAX_ANSWER = 75;
const MAX_EXPLANATION = 160;

function blank(type: EditorQuestion["type"]): EditorQuestion {
  return type === "QUIZ"
    ? { type, text: "", timeLimitSeconds: 20, points: 1, choices: ["", "", "", ""], correctIndex: -1, explanation: null }
    : { type, text: "", timeLimitSeconds: 10, points: 1, choices: ["True", "False"], correctIndex: -1, explanation: null };
}

/** Empty optional answers (the 3rd and 4th) are left out when the quiz is saved. */
function clean(q: EditorQuestion): EditorQuestion {
  if (q.type !== "QUIZ") return q;
  const keep = q.choices.map((c, i) => i < 2 || c.trim() !== "" || i === q.correctIndex);
  const choices = q.choices.filter((_, i) => keep[i]);
  const correctIndex = q.correctIndex < 0 ? -1 : keep.slice(0, q.correctIndex).filter(Boolean).length;
  return { ...q, choices, correctIndex };
}

/** What still stops a question from being published, in plain words; null when it is ready. */
function missing(raw: EditorQuestion): string | null {
  const q = clean(raw);
  if (!q.text.trim()) return "Write the question.";
  if (q.type === "QUIZ") {
    const filled = q.choices.filter((c) => c.trim());
    if (filled.length < 2) return "Write at least two answers.";
    if (q.choices.some((c) => !c.trim())) return "Fill in or remove the empty answer.";
    if (new Set(q.choices.map((c) => c.trim())).size !== q.choices.length) return "Make every answer different.";
  }
  if (q.correctIndex < 0) return "Mark the correct answer.";
  return null;
}

type SaveState = "saved" | "unsaved" | "saving" | "error";

/**
 * The quiz editor: the questions on the left, the one being edited on the right (stacked on a phone). Changes save
 * themselves 2 seconds after typing stops; publishing checks every question and makes this the version games play.
 */
function Editor() {
  const { quizId } = useParams<{ quizId: string }>();
  const [quiz, setQuiz] = useState<Editing | null>(null);
  const [questions, setQuestions] = useState<EditorQuestion[]>([]);
  const [selected, setSelected] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<{ quiz: Editing | null; questions: EditorQuestion[] }>({ quiz: null, questions: [] });

  useEffect(() => {
    api<Editing>("/api/v1/content/quizzes/" + quizId + "/draft")
      .then((e) => {
        setQuiz(e);
        setQuestions(e.questions);
        latest.current = { quiz: e, questions: e.questions };
      })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not open this quiz."));
  }, [quizId]);

  const save = useCallback(async (): Promise<boolean> => {
    const { quiz: q, questions: qs } = latest.current;
    if (!q) return false;
    if (timer.current) clearTimeout(timer.current);
    setSaveState("saving");
    try {
      const saved = await api<Editing>("/api/v1/content/quizzes/" + quizId + "/draft", {
        method: "PUT", body: { title: q.title, subject: q.subject, grade: q.grade, questions: qs.map(clean) },
      });
      setQuiz((cur) => (cur ? { ...cur, published: saved.published, unpublishedChanges: saved.unpublishedChanges } : saved));
      setSaveState("saved");
      return true;
    } catch (e) {
      setSaveState("error");
      setError(e instanceof ApiError ? e.message : "Your changes could not be saved. Check your connection and try again.");
      return false;
    }
  }, [quizId]);

  function changed(nextQuiz: Editing | null, nextQuestions: EditorQuestion[]) {
    latest.current = { quiz: nextQuiz, questions: nextQuestions };
    setSaveState("unsaved");
    setNotice(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { save(); }, 2000);
  }

  function setMeta(patch: Partial<Editing>) {
    if (!quiz) return;
    const next = { ...quiz, ...patch };
    setQuiz(next);
    changed(next, questions);
  }

  function setQuestionsAndSave(next: EditorQuestion[], select?: number) {
    setQuestions(next);
    if (select !== undefined) setSelected(select);
    changed(quiz, next);
  }

  function update(i: number, patch: Partial<EditorQuestion>) {
    setQuestionsAndSave(questions.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  }

  function add(type: EditorQuestion["type"]) {
    setQuestionsAndSave([...questions, blank(type)], questions.length);
  }

  function remove(i: number) {
    const next = questions.filter((_, k) => k !== i);
    setQuestionsAndSave(next, Math.max(0, Math.min(i, next.length - 1)));
  }

  function move(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    setQuestionsAndSave(next, j);
  }

  function copy(i: number) {
    const next = [...questions];
    next.splice(i + 1, 0, { ...questions[i], choices: [...questions[i].choices] });
    setQuestionsAndSave(next, i + 1);
  }

  async function publish() {
    setPublishing(true);
    setError(null);
    setNotice(null);
    if (!(await save())) {
      setPublishing(false);
      return;
    }
    try {
      const done = await api<Editing>("/api/v1/content/quizzes/" + quizId + "/publish", { method: "POST" });
      setQuiz((cur) => (cur ? { ...cur, published: done.published, unpublishedChanges: done.unpublishedChanges } : done));
      setNotice("Published. New games use this version; games already played keep theirs.");
    } catch (e) {
      const text = e instanceof ApiError ? e.message : "Quizplayo could not publish the quiz. Please try again.";
      setError(text);
      const at = /^Question (\d+):/.exec(text);
      if (at) setSelected(Number(at[1]) - 1);
    }
    setPublishing(false);
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (error && !quiz) return <div className="alert alert-danger">{error}</div>;
  if (!quiz) return <LoadingState rows={6} label="Opening the quiz" />;
  const q = questions[selected];
  const notReady = questions.map(missing);
  const status = !quiz.published ? "Draft, not published yet" : quiz.unpublishedChanges ? "Changes not published yet" : "Published";

  return (
    <div className="stack">
      <div className="editor-head card">
        <div className="field" style={{ flex: "2 1 280px" }}>
          <label htmlFor="ed-title">Quiz title</label>
          <input id="ed-title" type="text" maxLength={120} value={quiz.title} onChange={(e) => setMeta({ title: e.target.value })} />
        </div>
        <div className="field" style={{ flex: "1 1 140px" }}>
          <label htmlFor="ed-subject">Subject</label>
          <select id="ed-subject" value={quiz.subject} onChange={(e) => setMeta({ subject: e.target.value })}>
            {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 140px" }}>
          <label htmlFor="ed-grade">Grade</label>
          <select id="ed-grade" value={quiz.grade} onChange={(e) => setMeta({ grade: Number(e.target.value) })}>
            {GRADES.map((g) => <option key={g} value={g}>{g === 0 ? "Kindergarten" : "Grade " + g}</option>)}
          </select>
        </div>
        <div className="editor-actions">
          <span className="muted" aria-live="polite">
            {status} · {saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : saveState === "error" ? "Not saved" : "Saved"}
          </span>
          <div className="row" style={{ gap: 8 }}>
            {quiz.published && <Link className="btn btn-light" href={"/teacher/quiz/" + quizId}>Host</Link>}
            <button className="btn btn-primary" type="button" onClick={publish} disabled={publishing || questions.length === 0}>
              {publishing ? "Publishing…" : "Publish"}
            </button>
          </div>
        </div>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="editor">
        <aside className="editor-list card" aria-label="Questions">
          <ol>
            {questions.map((item, i) => (
              <li key={i}>
                <button type="button" className={i === selected ? "on" : ""} onClick={() => setSelected(i)}
                        aria-current={i === selected ? "true" : undefined}>
                  <span className="editor-num">{i + 1}</span>
                  <span className="editor-preview">{item.text.trim() || <em className="muted">No question yet</em>}</span>
                  {notReady[i] && <span className="editor-warn" title={notReady[i] ?? ""} aria-label={"Not ready: " + notReady[i]}>!</span>}
                </button>
              </li>
            ))}
          </ol>
          <div className="stack" style={{ gap: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={() => add("QUIZ")}>+ Multiple choice</button>
            <button type="button" className="btn btn-light" onClick={() => add("TRUE_FALSE")}>+ True or false</button>
          </div>
        </aside>

        <section className="editor-main card stack" aria-label="Question">
          {!q ? (
            <div className="empty-state">
              <strong>No questions yet</strong>
              <p className="muted">Add a multiple-choice or true-or-false question to start.</p>
            </div>
          ) : (
            <QuestionForm key={selected} index={selected} q={q} total={questions.length} problem={notReady[selected]}
                          onChange={(patch) => update(selected, patch)} onMove={(by) => move(selected, by)}
                          onCopy={() => copy(selected)} onRemove={() => remove(selected)} />
          )}
        </section>
      </div>
    </div>
  );
}

function QuestionForm({ index, q, total, problem, onChange, onMove, onCopy, onRemove }: {
  index: number;
  q: EditorQuestion;
  total: number;
  problem: string | null;
  onChange: (patch: Partial<EditorQuestion>) => void;
  onMove: (by: number) => void;
  onCopy: () => void;
  onRemove: () => void;
}) {
  function setChoice(i: number, text: string) {
    onChange({ choices: q.choices.map((c, k) => (k === i ? text : c)) });
  }

  function removeChoice(i: number) {
    const choices = q.choices.filter((_, k) => k !== i);
    const correct = q.correctIndex === i ? -1 : q.correctIndex > i ? q.correctIndex - 1 : q.correctIndex;
    onChange({ choices, correctIndex: correct });
  }

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>Question {index + 1} · {q.type === "QUIZ" ? "Multiple choice" : "True or false"}</h2>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-light" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up">↑</button>
          <button type="button" className="btn btn-light" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move down">↓</button>
          <button type="button" className="btn btn-light" onClick={onCopy}>Duplicate</button>
          <button type="button" className="btn btn-light" onClick={onRemove}>Delete</button>
        </div>
      </div>
      {problem && <p className="hint hint-danger" style={{ margin: 0 }}>{problem}</p>}
      <div className="field">
        <label htmlFor="q-text">Question</label>
        <textarea id="q-text" rows={2} maxLength={MAX_TEXT} value={q.text} onChange={(e) => onChange({ text: e.target.value })}
                  placeholder="Type your question" />
        <p className="hint">{q.text.length} / {MAX_TEXT}</p>
      </div>

      <fieldset className="answer-edits">
        <legend>Answers: mark the correct one</legend>
        {q.choices.map((c, i) => (
          <div key={i} className={"answer-edit" + (q.correctIndex === i ? " correct" : "")} style={{ background: `var(--a${(i % 4) + 1})`, color: `var(--a${(i % 4) + 1}-text)` }}>
            <AnswerShape index={i} size={22} color="currentColor" />
            {q.type === "QUIZ" ? (
              <input type="text" aria-label={"Answer " + (i + 1)} maxLength={MAX_ANSWER} value={c}
                     onChange={(e) => setChoice(i, e.target.value)} placeholder={"Answer " + (i + 1) + (i >= 2 ? " (optional)" : "")} />
            ) : (
              <span className="answer-edit-fixed">{c}</span>
            )}
            <label className="answer-edit-correct">
              <input type="radio" name="correct" checked={q.correctIndex === i} onChange={() => onChange({ correctIndex: i })} />
              <span>Correct</span>
            </label>
            {q.type === "QUIZ" && q.choices.length > 2 && (
              <button type="button" className="answer-edit-remove" aria-label={"Remove answer " + (i + 1)} onClick={() => removeChoice(i)}>×</button>
            )}
          </div>
        ))}
        {q.type === "QUIZ" && q.choices.length < 4 && (
          <button type="button" className="btn btn-light" onClick={() => onChange({ choices: [...q.choices, ""] })}>+ Add an answer</button>
        )}
      </fieldset>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="q-time">Time limit</label>
          <select id="q-time" value={q.timeLimitSeconds} onChange={(e) => onChange({ timeLimitSeconds: Number(e.target.value) })}>
            {TIMES.map((t) => <option key={t} value={t}>{t} seconds</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="q-points">Points</label>
          <select id="q-points" value={q.points} onChange={(e) => onChange({ points: Number(e.target.value) })}>
            {POINTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="q-explain">Explanation (optional)</label>
        <textarea id="q-explain" rows={2} maxLength={MAX_EXPLANATION} value={q.explanation ?? ""}
                  onChange={(e) => onChange({ explanation: e.target.value || null })}
                  placeholder="Shown after the question: why the answer is right" />
      </div>
    </>
  );
}
