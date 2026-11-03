"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { gradeLabel } from "@/lib/content";
import { Shelf } from "@/lib/library";
import { LibraryQuizCard } from "@/components/LibraryCards";
import { LoadingState } from "@/components/ui/States";

/**
 * "Ready to play": the workspace's starter shelf, one grade at a time. The same quizzes for every teacher of the school
 * until an admin presses "Show me others". Hidden when the library is switched off.
 */
export function StarterShelf({ grades, firstGrade, onChangeGrades }: {
  grades: number[];
  /** The grade to open on: the teacher's own grade when they have one. */
  firstGrade: number | null;
  /** Shown to an admin: change the grades the workspace teaches. */
  onChangeGrades?: () => void;
}) {
  const ordered = firstGrade != null && grades.includes(firstGrade)
    ? [firstGrade, ...grades.filter((g) => g !== firstGrade)] : grades;
  const [chosen, setGrade] = useState<number>(ordered[0]);
  // The grades can change (an admin's "Change grades"); fall back to the first one.
  const grade = grades.includes(chosen) ? chosen : ordered[0];
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setShelf(null);
    setError(null);
    api<Shelf>("/api/v1/starter-shelf?grade=" + grade).then(setShelf)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your starter quizzes."));
  }, [grade]);

  if (shelf && !shelf.enabled) return null;

  async function others() {
    setBusy(true);
    setError(null);
    try {
      setShelf(await api<Shelf>("/api/v1/starter-shelf/shuffle", { method: "POST", body: { grade } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not pick other quizzes. Please try again.");
    }
    setBusy(false);
  }

  return (
    <section className="card stack starter-shelf" aria-labelledby="shelf-title">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 id="shelf-title" style={{ margin: 0 }}>Ready to play</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Starter quizzes from the Quizplayo library. Host one as it is, or edit your own copy.
          </p>
        </div>
        {onChangeGrades && <button type="button" className="btn btn-light" onClick={onChangeGrades}>Change grades</button>}
      </div>
      {ordered.length > 1 && (
        <div className="grade-tabs" role="tablist" aria-label="Grade">
          {ordered.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={g === grade} aria-controls="shelf-panel"
                    className={g === grade ? "active" : ""} onClick={() => setGrade(g)}>
              {gradeLabel(g)}
            </button>
          ))}
        </div>
      )}
      <div id="shelf-panel" role={ordered.length > 1 ? "tabpanel" : undefined} aria-label={gradeLabel(grade)} className="stack">
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {!shelf && !error && <LoadingState rows={3} label="Loading your starter quizzes" />}
        {shelf && shelf.quizzes.length === 0 && (
          <div className="alert">Starter quizzes for {gradeLabel(grade)} are on their way. Meanwhile, create your own or draft one with AI.</div>
        )}
        {shelf && shelf.quizzes.length > 0 && (
          <div className="library-grid">
            {shelf.quizzes.map((q) => <LibraryQuizCard key={q.libraryQuizId} quiz={q} />)}
          </div>
        )}
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {shelf?.canShuffle && shelf.quizzes.length > 0 && (
            <button type="button" className="btn btn-light" onClick={others} disabled={busy}>
              {busy ? "Picking…" : "Show me others"}
            </button>
          )}
          <Link className="btn btn-light" href={"/library?grade=" + grade}>Browse the library</Link>
        </div>
      </div>
    </section>
  );
}
