"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { LibraryQuizCard } from "@/components/LibraryCards";
import { api, ApiError } from "@/lib/api";
import { gradeLabel, SUBJECTS } from "@/lib/content";
import { LibraryCard, LibraryCourse, LibraryPage } from "@/lib/library";
import { useMe } from "@/lib/me";
import { GRADES } from "@/lib/school";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";

export default function LibraryRoute() {
  return (
    <AppFrame>
      <Suspense>
        <Library />
      </Suspense>
    </AppFrame>
  );
}

/** The whole Quizplayo library: filter by grade, subject and course, or search titles and units. */
function Library() {
  const me = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = params.get("grade");
  // No grade in the address: the workspace's first grade. "grade=" (empty) is "All grades".
  const grade = fromUrl ?? String(me.school.grades[0] ?? "");
  const subject = params.get("subject") ?? "";
  const course = params.get("course") ?? "";
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);
  const [courses, setCourses] = useState<LibraryCourse[]>([]);
  const [quizzes, setQuizzes] = useState<LibraryCard[] | null>(null);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(next: Record<string, string>) {
    const all = new URLSearchParams({ grade, subject, course, q, ...next });
    [...all.keys()].forEach((k) => { if (!all.get(k) && k !== "grade") all.delete(k); });
    router.replace("/library?" + all.toString(), { scroll: false });
  }

  useEffect(() => {
    setCourses([]);
    if (grade === "") return;
    api<LibraryCourse[]>("/api/v1/library/courses?grade=" + grade).then(setCourses).catch(() => setCourses([]));
  }, [grade]);

  useEffect(() => {
    setQuizzes(null);
    setError(null);
    setPage(0);
    api<LibraryPage>("/api/v1/library/quizzes?" + query(0)).then((r) => {
      setQuizzes(r.quizzes);
      setMore(r.more);
    }).catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load the library."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, subject, course, q]);

  function query(p: number): string {
    const u = new URLSearchParams();
    if (grade !== "") u.set("grade", grade);
    if (subject) u.set("subject", subject);
    if (course) u.set("course", course);
    if (q) u.set("q", q);
    u.set("page", String(p));
    return u.toString();
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const r = await api<LibraryPage>("/api/v1/library/quizzes?" + query(page + 1));
      setQuizzes([...(quizzes ?? []), ...r.quizzes]);
      setMore(r.more);
      setPage(page + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not load more quizzes.");
    }
    setLoadingMore(false);
  }

  return (
    <div className="stack">
      <PageHeader title="Library"
                  description="Ready-made quizzes for every grade, aligned to the Florida standards (FLVS). Host one as it is, or edit your own copy." />
      <form className="library-filters" role="search" onSubmit={(e) => { e.preventDefault(); set({ q: search.trim() }); }}>
        <div className="field">
          <label htmlFor="lib-grade">Grade</label>
          <select id="lib-grade" value={grade} onChange={(e) => set({ grade: e.target.value, course: "" })}>
            <option value="">All grades</option>
            {GRADES.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lib-subject">Subject</label>
          <select id="lib-subject" value={subject} onChange={(e) => set({ subject: e.target.value, course: "" })}>
            <option value="">All subjects</option>
            {SUBJECTS.filter((s) => s !== "Other").map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {grade !== "" && courses.length > 0 && (
          <div className="field">
            <label htmlFor="lib-course">Course</label>
            <select id="lib-course" value={course} onChange={(e) => set({ course: e.target.value })}>
              <option value="">All courses</option>
              {courses.filter((c) => !subject || c.subject === subject).map((c) => (
                <option key={c.courseId} value={c.courseId}>{c.name} ({c.quizzes})</option>
              ))}
            </select>
          </div>
        )}
        <div className="field library-search">
          <label htmlFor="lib-q">Search</label>
          <div className="row" style={{ gap: 8 }}>
            <input id="lib-q" type="search" maxLength={100} value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder="e.g. fractions" />
            <button type="submit" className="btn btn-light">Search</button>
          </div>
        </div>
      </form>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!quizzes && !error && <LoadingState rows={4} label="Loading the library" />}
      {quizzes && quizzes.length === 0 && (
        <EmptyState title="No quizzes match these filters">
          Try another grade or subject, or clear the search.
        </EmptyState>
      )}
      {quizzes && quizzes.length > 0 && (
        <>
          <p className="muted" aria-live="polite" style={{ margin: 0 }}>
            {quizzes.length}{more ? "+" : ""} {quizzes.length === 1 ? "quiz" : "quizzes"}
          </p>
          <div className="library-grid">
            {quizzes.map((c) => <LibraryQuizCard key={c.libraryQuizId} quiz={c} showGrade={grade === ""} />)}
          </div>
        </>
      )}
      {more && (
        <div className="row">
          <button type="button" className="btn btn-light" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Show more"}
          </button>
        </div>
      )}
    </div>
  );
}
