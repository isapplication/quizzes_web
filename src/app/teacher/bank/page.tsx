"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { api } from "@/lib/api";
import { isIndependent, isSchoolAdmin, useMe } from "@/lib/me";
import { gradeLabel, QuizSummary } from "@/lib/content";
import { LoadingState, PageHeader } from "@/components/ui/States";

const GRADES = Array.from({ length: 13 }, (_, i) => i);

export default function BankPage() {
  return (
    <AppFrame>
      <Suspense>
        <Bank />
      </Suspense>
    </AppFrame>
  );
}

function Bank() {
  const router = useRouter();
  const params = useSearchParams();
  const me = useMe();
  // Opens on the first grade the workspace teaches (a school's or a teacher's own), else Grade 8.
  const grade = Number(params.get("grade") ?? String(me.school.grades[0] ?? 8));
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuizzes(null);
    setError(null);
    api<QuizSummary[]>("/api/v1/content/bank?grade=" + grade)
      .then(setQuizzes)
      .catch((e: Error) => setError(e.message));
  }, [grade]);

  return (
    <div className="stack">
      <PageHeader title="Question bank"
                  description="Quizplayo questions by grade, aligned to Florida standards. Open a quiz to see its questions and host it live." />
      <div className="grade-tabs" role="tablist" aria-label="Grade">
        {GRADES.map((g) => (
          <button
            key={g}
            role="tab"
            aria-selected={g === grade}
            className={g === grade ? "active" : ""}
            onClick={() => router.replace("/teacher/bank?grade=" + g)}
          >
            {g === 0 ? "K" : g}
          </button>
        ))}
      </div>
      <h2>{gradeLabel(grade)}</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {!quizzes && !error && <LoadingState rows={4} label="Loading quizzes" />}
      {quizzes && quizzes.length === 0 && (
        <div className="alert">
          {isIndependent(me) ? "Your workspace has" : "Your school has"} no bank quizzes for this grade yet.
          {isSchoolAdmin(me) && !isIndependent(me) && <> Add grades in <a href="/admin/setup#bank">Get started</a>.</>}
        </div>
      )}
      <div className="quiz-list">
        {quizzes?.map((q) => (
          <Link key={q.quizId} href={"/teacher/quiz/" + q.quizId} className="card tile">
            <div className="row">
              <span className="chip">{q.subject}</span>
              {q.standard && <span className="muted">{q.standard}</span>}
              <span className="spacer" />
              <span className="muted">{q.bankRef}</span>
            </div>
            <h3 style={{ margin: "8px 0 4px", color: "var(--sc)" }}>{q.title}</h3>
            <p className="muted">
              {q.course} · {q.questionCount} questions · {q.playableCount} play live
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
