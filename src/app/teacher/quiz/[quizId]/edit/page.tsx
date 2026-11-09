"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { EditorQuestion, Editing, SUBJECTS } from "@/lib/content";
import { blank, changeType, fromServer, missing, QTYPES, QTYPE_LABEL, toServer, type QType } from "@/lib/questionTypes";
import { QuestionForm } from "@/components/QuestionForm";
import { GRADES } from "@/lib/school";
import { LoadingState } from "@/components/ui/States";

export default function EditQuizPage() {
  return (
    <AppFrame wide>
      <Editor />
    </AppFrame>
  );
}

/** The questions as the editor API sends them, made whole for the editor (the old single correctIndex is read too). */
function opened(e: Editing): Editing {
  return { ...e, questions: (e.questions as unknown as Record<string, unknown>[]).map(fromServer) };
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
      .then((raw) => {
        const e = opened(raw);
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
        method: "PUT", body: { title: q.title, subject: q.subject, grade: q.grade, questions: qs.map(toServer) },
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

  function add(type: QType) {
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
    const q = questions[i];
    next.splice(i + 1, 0, { ...q, choices: [...q.choices], correctIndexes: [...q.correctIndexes],
      payload: { ...q.payload, accept: q.payload.accept ? [...q.payload.accept] : undefined } });
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
                  <span className="editor-preview">
                    <span className="editor-type">{QTYPE_LABEL[item.type]}</span>
                    {(item.type === "SLIDE" ? item.payload.title ?? "" : item.text).trim() || <em className="muted">{item.type === "SLIDE" ? "No title yet" : "No question yet"}</em>}
                  </span>
                  {notReady[i] && <span className="editor-warn" title={notReady[i] ?? ""} aria-label={"Not ready: " + notReady[i]}>!</span>}
                </button>
              </li>
            ))}
          </ol>
          <div className="editor-add" role="group" aria-labelledby="ed-add-label">
            <span id="ed-add-label" className="editor-add-label">Add a question</span>
            {QTYPES.map((t) => (
              <button key={t} type="button" className={t === "QUIZ" ? "btn btn-secondary" : "btn btn-light"} onClick={() => add(t)}>
                <span aria-hidden="true">+ </span>{QTYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </aside>

        <section className="editor-main card stack" aria-label="Question">
          {!q ? (
            <div className="empty-state">
              <strong>No questions yet</strong>
              <p className="muted">Choose a question type under &quot;Add a question&quot; to start.</p>
            </div>
          ) : (
            <QuestionForm key={selected} index={selected} q={q} total={questions.length} problem={notReady[selected]}
                          onChange={(patch) => update(selected, patch)} onType={(t) => setQuestionsAndSave(questions.map((x, k) => (k === selected ? changeType(x, t) : x)))}
                          onMove={(by) => move(selected, by)}
                          onCopy={() => copy(selected)} onRemove={() => remove(selected)} subject={quiz.subject} />
          )}
        </section>
      </div>
    </div>
  );
}
