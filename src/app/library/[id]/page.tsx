"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { AnswerShape } from "@/components/AnswerShape";
import { AssignBox } from "@/components/AssignBox";
import { HostGame } from "@/components/HostGame";
import { ReportMistake } from "@/components/LibraryCards";
import { api, ApiError } from "@/lib/api";
import { gradeLabel, TYPE_LABEL } from "@/lib/content";
import { FORMAT_LABEL, LibraryDetail, LibraryQuestion, originLabel } from "@/lib/library";
import { ErrorState, LoadingState, PageHeader } from "@/components/ui/States";

export default function LibraryQuizRoute() {
  return (
    <AppFrame>
      <LibraryQuiz />
    </AppFrame>
  );
}

/**
 * A library quiz with its answers (staff only): host it as it is, edit a copy, or report a mistake in a question. An
 * activity shows its rounds with their answers and can only be assigned.
 */
function LibraryQuiz() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<LibraryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const load = useCallback(() => {
    api<LibraryDetail>("/api/v1/library/quizzes/" + id).then(setDetail)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load this quiz."));
  }, [id]);
  useEffect(load, [load]);

  async function copy() {
    setCopying(true);
    setError(null);
    try {
      const r = await api<{ quizId: string }>("/api/v1/library/quizzes/" + id + "/copy", { method: "POST" });
      router.push("/teacher/quiz/" + r.quizId + "/edit");
    } catch (e) {
      setNotice(null);
      setError(e instanceof ApiError ? e.message : "Quizplayo could not copy this quiz. Please try again.");
      setCopying(false);
    }
  }

  function reported(message: string, hidden: boolean) {
    setNotice(message);
    if (hidden) {
      setDetail(null);
      load();
    }
  }

  if (error && !detail) {
    return (
      <div className="stack">
        <ErrorState message={error} />
        <p><Link href="/library">Back to the library</Link></p>
      </div>
    );
  }
  if (!detail) return <LoadingState rows={5} label="Loading the quiz" />;
  const q = detail.quiz;
  const activity = q.kind === "ACTIVITY";

  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>
        <Link href={"/library?grade=" + q.grade}>Library</Link> · {gradeLabel(q.grade)} · {q.courseName}
        {q.unit && <> · {q.unit}</>}
      </p>
      <PageHeader title={q.title} description={
        <>
          {q.format && <><span className="chip chip-activity">{FORMAT_LABEL[q.format]}</span> </>}
          <span className="chip chip-ai">{originLabel(q.origin)}</span>
        </>
      } action={activity ? undefined : (
        <button className="btn btn-light" type="button" onClick={copy} disabled={copying}>
          {copying ? "Copying…" : "Edit a copy"}
        </button>
      )} />
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {activity ? (
        <p className="muted" style={{ margin: 0 }}>
          Activities are done at each student&apos;s own pace, so they aren&apos;t played live. Assign it to a class or share its link.
        </p>
      ) : (
        <HostGame target={{ libraryQuizId: q.libraryQuizId }} playable={detail.questions.length} total={detail.questions.length} grade={q.grade} />
      )}
      <div id="assign"><AssignBox target={{ libraryQuizId: q.libraryQuizId }} /></div>

      <ol className="question-list">
        {detail.questions.map((question, n) => (
          <li key={question.questionId} className="card">
            <div className="row" style={{ flexWrap: "wrap" }}>
              <span className="chip">{activity ? ROUND_LABEL[question.type] ?? "Round" : TYPE_LABEL[question.type as keyof typeof TYPE_LABEL]}</span>
              {!activity && <span className="muted">{question.timeLimitSeconds} s</span>}
              {question.benchmarkCode && <span className="muted">{question.benchmarkCode}</span>}
              <span className="spacer" />
              <ReportMistake questionId={question.questionId} number={n + 1} onReported={reported} />
            </div>
            <p style={{ fontWeight: 600, margin: "8px 0" }}>
              {question.visual && <span className="question-visual" aria-hidden="true">{question.visual} </span>}
              {question.text}
            </p>
            {activity ? <RoundAnswer question={question} /> : <ul className="choice-list">
              {question.choices.map((c, i) => (
                <li key={i} className={i === question.correctIndex ? "correct" : ""}>
                  <AnswerShape index={i} size={16} />
                  <span>{c}</span>
                  {i === question.correctIndex && <strong className="correct-label">✓ Correct</strong>}
                </li>
              ))}
            </ul>}
            {question.explanation && <p className="muted">{question.explanation}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

const ROUND_LABEL: Record<string, string> = { PUZZLE: "Put in order", MATCH: "Match the pairs", CARD: "Flashcard" };

/** An activity round with its answer: the right order, the right pairs, or the back of the card. */
function RoundAnswer({ question }: { question: LibraryQuestion }) {
  const p = question.payload ?? {};
  if (question.type === "PUZZLE") {
    return <ol className="round-answer">{(p.order ?? []).map((item, i) => <li key={i}>{item}</li>)}</ol>;
  }
  if (question.type === "MATCH") {
    return (
      <ul className="round-answer pairs">
        {(p.pairs ?? []).map(([left, right], i) => (
          <li key={i}><span>{left}</span><span aria-hidden="true">→</span><span className="sr-only"> goes with </span><span>{right}</span></li>
        ))}
      </ul>
    );
  }
  return <p className="round-answer card-back"><span className="muted">Back: </span>{p.back}</p>;
}
