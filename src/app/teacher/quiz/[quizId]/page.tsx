"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { AnswerShape } from "@/components/AnswerShape";
import { api, ApiError } from "@/lib/api";
import { gradeLabel, QuizView, TYPE_LABEL } from "@/lib/content";
import { isIndependent, isSchoolAdmin, useMe } from "@/lib/me";
import { LoadingState, PageHeader } from "@/components/ui/States";

export default function QuizPage() {
  return (
    <AppFrame>
      <Quiz />
    </AppFrame>
  );
}

function Quiz() {
  const { quizId } = useParams<{ quizId: string }>();
  const me = useMe();
  const router = useRouter();
  const [view, setView] = useState<QuizView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classCode, setClassCode] = useState<string>("");
  const [signedInOnly, setSignedInOnly] = useState(false);
  const [starting, setStarting] = useState(false);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    api<QuizView>("/api/v1/content/quizzes/" + quizId)
      .then(setView)
      .catch((e: unknown) => {
        // A quiz with only a draft opens in the editor.
        if (e instanceof ApiError && e.code === "not_published") router.replace("/teacher/quiz/" + quizId + "/edit");
        else setError(e instanceof Error ? e.message : "Quizplayo could not load this quiz.");
      });
  }, [quizId, router]);

  async function duplicate() {
    setCopying(true);
    setError(null);
    try {
      const copy = await api<{ quizId: string }>("/api/v1/content/quizzes/" + quizId + "/duplicate", { method: "POST" });
      router.push("/teacher/quiz/" + copy.quizId + "/edit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quizplayo could not copy this quiz.");
      setCopying(false);
    }
  }

  useEffect(() => {
    if (me.classes.length > 0) setClassCode(me.classes[0]);
  }, [me.classes]);

  async function host() {
    setStarting(true);
    setError(null);
    try {
      const game = await api<{ pin: string }>("/api/v1/live/games", {
        method: "POST",
        body: { quizId, requireSignIn: signedInOnly, classCode: signedInOnly ? classCode || null : null },
      });
      router.push("/teacher/host/" + game.pin);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The game could not start.");
      setStarting(false);
    }
  }

  if (error && !view) return <div className="alert alert-danger">{error}</div>;
  if (!view) return <LoadingState rows={5} label="Loading the quiz" />;
  const q = view.quiz;
  const skipped = q.questionCount - q.playableCount;
  const canEdit = q.source !== "BANK" && (q.ownerUserId === me.userId || isSchoolAdmin(me));
  const school = !isIndependent(me);

  return (
    <div className="stack">
      <div className="row">
        <span className="chip">{q.subject}</span>
        <span className="muted">
          {gradeLabel(q.grade)}
          {q.course && <> · {q.course}</>}
          {q.standard && <> · {q.standard}</>}
          {q.source === "BANK" && <> · Quizplayo bank {q.bankRef}</>}
          {q.source === "AI" && (
            <>
              {" "}
              · AI Studio ({view.aiModel}, prompt {view.aiPromptVersion})
            </>
          )}
          {" · version "}
          {view.versionNo}
        </span>
      </div>
      <PageHeader title={q.title} action={
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {canEdit && <a className="btn btn-light" href={"/teacher/quiz/" + quizId + "/edit"}>Edit</a>}
          <button className="btn btn-light" type="button" onClick={duplicate} disabled={copying}>
            {copying ? "Copying…" : "Duplicate"}
          </button>
        </div>
      } />

      <div className="card stack">
        <h2>Host a live game</h2>
        <p>
          {q.playableCount} of {q.questionCount} questions play live.
          {skipped > 0 && <> {skipped} type-answer, puzzle or slider questions are skipped in this version.</>}
        </p>
        {school && (
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
            <legend style={{ fontWeight: 600, marginBottom: 6 }}>Who can join?</legend>
            <label className="check">
              <input type="radio" name="who" checked={!signedInOnly} onChange={() => setSignedInOnly(false)} />
              <span>Anyone with the PIN <span className="muted">(players choose a nickname, no account needed)</span></span>
            </label>
            <label className="check">
              <input type="radio" name="who" checked={signedInOnly} onChange={() => setSignedInOnly(true)} />
              <span>Only signed-in students of {me.school.name} <span className="muted">(results saved to each student)</span></span>
            </label>
          </fieldset>
        )}
        <div className="row" style={{ flexWrap: "wrap" }}>
          {school && signedInOnly && (
            <>
              <label htmlFor="class">Class</label>
              <select id="class" value={classCode} onChange={(e) => setClassCode(e.target.value)}>
                {me.classes.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="">Any student of my school</option>
              </select>
            </>
          )}
          <button className="btn btn-primary" onClick={host} disabled={starting || q.playableCount === 0}>
            {starting ? "Starting…" : "Host live game"}
          </button>
        </div>
        {error && <div className="alert alert-danger">{error}</div>}
      </div>

      <ol className="question-list">
        {view.questions.map((question) => (
          <li key={question.id} className="card">
            <div className="row">
              <span className="chip">{TYPE_LABEL[question.type]}</span>
              <span className="muted">{question.timeLimitSeconds} s</span>
              {!question.playableLive && <span className="chip chip-new">Not in live games yet</span>}
            </div>
            <p style={{ fontWeight: 600, margin: "8px 0" }}>{question.text}</p>
            {question.choices.length > 0 && (
              <ul className="choice-list">
                {question.choices.map((c, i) => (
                  <li key={i} className={i === question.correctIndex ? "correct" : ""}>
                    <AnswerShape index={i} size={16} />
                    <span>{c}</span>
                    {i === question.correctIndex && <strong className="correct-label">✓ Correct</strong>}
                  </li>
                ))}
              </ul>
            )}
            {question.type !== "QUIZ" && question.type !== "TRUE_FALSE" && (
              <p className="muted">Answer: {describeAnswer(question.answer)}</p>
            )}
            {question.explanation && <p className="muted">{question.explanation}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function describeAnswer(answer: Record<string, unknown>): string {
  if (Array.isArray(answer.accept)) return (answer.accept as string[]).join(" or ");
  if (Array.isArray(answer.order)) return (answer.order as string[]).join(" → ");
  if (answer.answer !== undefined) return `${answer.answer} ${answer.unit ?? ""} (±${answer.tol})`;
  return "–";
}
