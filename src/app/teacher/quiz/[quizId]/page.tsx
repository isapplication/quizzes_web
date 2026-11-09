"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { AnswerShape } from "@/components/AnswerShape";
import { AssignBox } from "@/components/AssignBox";
import { HostGame } from "@/components/HostGame";
import { api, ApiError } from "@/lib/api";
import { gradeLabel, QuizView, TYPE_LABEL } from "@/lib/content";
import { type AnswerKey, keyText } from "@/lib/questionTypes";
import { isSchoolAdmin, useMe } from "@/lib/me";
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

  if (error && !view) return <div className="alert alert-danger">{error}</div>;
  if (!view) return <LoadingState rows={5} label="Loading the quiz" />;
  const q = view.quiz;
  const canEdit = q.source !== "BANK" && (q.ownerUserId === me.userId || isSchoolAdmin(me));

  return (
    <div className="stack">
      <div className="row">
        <span className="chip">{q.subject}</span>
        <span className="muted">
          {gradeLabel(q.grade)}
          {q.course && <> · {q.course}</>}
          {q.standard && <> · {q.standard}</>}
          {q.source === "BANK" && <> · Quizplayo bank {q.bankRef}</>}
          {q.source === "LIBRARY" && q.originLibraryQuizId && (
            <> · Copied from the <Link href={"/library/" + q.originLibraryQuizId}>Quizplayo library</Link> (version {q.originVersionNo})</>
          )}
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

      <HostGame target={{ quizId }} playable={q.playableCount} total={q.questionCount} grade={q.grade} />
      <AssignBox target={{ quizId }} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <ol className="question-list">
        {view.questions.map((question) => {
          const right = question.correctIndexes ?? (question.correctIndex >= 0 ? [question.correctIndex] : []);
          return (
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
                  <li key={i} className={right.includes(i) ? "correct" : ""}>
                    <AnswerShape index={i} size={16} />
                    <span>{c}</span>
                    {right.includes(i) && <strong className="correct-label">✓ Correct</strong>}
                  </li>
                ))}
              </ul>
            )}
            {question.type === "POLL" && <p className="muted">A poll has no right answer.</p>}
            {question.type !== "QUIZ" && question.type !== "TRUE_FALSE" && question.type !== "MULTI_SELECT"
              && question.type !== "POLL" && question.type !== "SLIDE" && (
              <p className="muted">Answer: {describeAnswer(question.type, question.answer)}</p>
            )}
            {question.explanation && <p className="muted">{question.explanation}</p>}
          </li>
          );
        })}
      </ol>
    </div>
  );
}

function describeAnswer(type: string, answer: Record<string, unknown>): string {
  if (type === "CATEGORISE") return keyText(type, answer as AnswerKey, [], []) ?? "–";
  if (Array.isArray(answer.accept)) return (answer.accept as string[]).join(" or ");
  if (Array.isArray(answer.order)) return (answer.order as string[]).join(" → ");
  if (answer.answer !== undefined) return `${answer.answer} ${answer.unit ?? ""} (±${answer.tol})`;
  return "–";
}
