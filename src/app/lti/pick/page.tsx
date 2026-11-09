"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { gradeLabel, QuizSummary } from "@/lib/content";
import { FORMAT_LABEL, LibraryCard, LibraryPage } from "@/lib/library";
import { isStaff, useMe } from "@/lib/me";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";

interface DeepLinkInfo {
  courseTitle: string;
  classCode: string | null;
  className: string | null;
}

interface DeepLinkResponse {
  returnUrl: string;
  jwt: string;
  assignmentCode: string;
}

type Choice = { kind: "quiz"; id: string; title: string } | { kind: "library"; id: string; title: string };

export default function LtiPickPage() {
  return (
    <AppFrame>
      <Pick />
    </AppFrame>
  );
}

/**
 * The LMS's "add content" (LTI deep linking): /lti/pick?dl=<id>. The teacher picks one of their own published quizzes
 * or a library quiz, with an optional due time; Quizplayo makes a class assignment and hands the LMS a signed answer,
 * which this page posts back to the LMS (that returns the teacher to their course).
 */
function Pick() {
  const me = useMe();
  const [dl, setDl] = useState<string | null | undefined>(undefined);
  const [info, setInfo] = useState<DeepLinkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"mine" | "library">("mine");
  const [choice, setChoice] = useState<Choice | null>(null);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<DeepLinkResponse | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("dl");
    setDl(id && /^[A-Za-z0-9_-]{1,200}$/.test(id) ? id : null);
  }, []);

  useEffect(() => {
    if (!dl || !isStaff(me)) return;
    api<DeepLinkInfo>("/api/v1/lti/deep-links/" + encodeURIComponent(dl)).then(setInfo)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load this request from your LMS."));
  }, [dl, me]);

  // Once the LMS's answer is in the page, post it back: the LMS takes the teacher back to the course.
  useEffect(() => {
    if (sending) formRef.current?.submit();
  }, [sending]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!dl || !choice) {
      setError("Choose a quiz to add to the course.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await api<DeepLinkResponse>("/api/v1/lti/deep-links/" + encodeURIComponent(dl), {
        method: "POST",
        body: {
          ...(choice.kind === "quiz" ? { quizId: choice.id } : { libraryQuizId: choice.id }),
          // The picker gives local time; the API wants an instant.
          dueAt: due ? new Date(due).toISOString() : null,
        },
      });
      setSending(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Quizplayo could not add this quiz to the course.");
      setBusy(false);
    }
  }

  if (!isStaff(me)) {
    return <div className="alert alert-danger">Only teachers can add Quizplayo to a course.</div>;
  }
  if (dl === undefined) return <LoadingState rows={3} label="Loading" />;
  if (dl === null) {
    return <ErrorState message="This page needs a request from your LMS. Add Quizplayo from your course again." />;
  }
  if (!info) return error ? <ErrorState message={error} /> : <LoadingState rows={3} label="Loading the course" />;

  if (sending) {
    return (
      <div className="card stack" role="status" aria-live="polite">
        <h1 style={{ margin: 0 }}>Adding to {info.courseTitle}…</h1>
        <p className="muted" style={{ margin: 0 }}>Taking you back to your course.</p>
        <form ref={formRef} method="post" action={sending.returnUrl}>
          <input type="hidden" name="JWT" value={sending.jwt} />
          <noscript><button type="submit" className="btn btn-primary">Back to your course</button></noscript>
        </form>
      </div>
    );
  }

  return (
    <form className="stack" style={{ maxWidth: 820 }} onSubmit={add}>
      <PageHeader title={`Add a quiz to ${info.courseTitle}`}
                  description={<>Students open it from the course, signed in, at their own pace; their scores go to the course&apos;s gradebook.
                    {info.className && <> It is assigned to class {info.className}{info.classCode ? ` (${info.classCode})` : ""}.</>}</>} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      <fieldset className="type-pick">
        <legend>Choose from</legend>
        <div className="type-pick-options">
          <label><input type="radio" name="lti-source" checked={source === "mine"} onChange={() => setSource("mine")} /> My quizzes</label>
          <label><input type="radio" name="lti-source" checked={source === "library"} onChange={() => setSource("library")} /> The library</label>
        </div>
      </fieldset>

      {source === "mine" ? <MyQuizzes choice={choice} onChoose={setChoice} /> : <LibraryQuizzes choice={choice} onChoose={setChoice} />}

      <div className="card stack">
        <p style={{ margin: 0 }}>
          {choice ? <>Chosen: <strong>{choice.title}</strong></> : <span className="muted">No quiz chosen yet.</span>}
        </p>
        <div className="field">
          <label htmlFor="lti-due">Due (optional)</label>
          <input id="lti-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Adding…" : "Add to the course"}</button>
        </div>
      </div>
    </form>
  );
}

/** The teacher's own published quizzes (a quiz with only a draft can't be assigned). */
function MyQuizzes({ choice, onChoose }: { choice: Choice | null; onChoose: (c: Choice) => void }) {
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<QuizSummary[]>("/api/v1/content/quizzes/mine").then((list) => setQuizzes(list.filter((q) => q.versionId)))
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your quizzes."));
  }, []);

  const shown = useMemo(() => (quizzes ?? []).filter((q) =>
    !query.trim() || q.title.toLowerCase().includes(query.trim().toLowerCase())), [quizzes, query]);

  if (error) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!quizzes) return <LoadingState rows={3} label="Loading your quizzes" />;
  if (quizzes.length === 0) {
    return <EmptyState title="No published quizzes yet">Publish one of your quizzes first, or choose one from the library.</EmptyState>;
  }
  return (
    <div className="card stack">
      <div className="field">
        <label htmlFor="lti-mine-search">Search your quizzes</label>
        <input id="lti-mine-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <fieldset className="pick-list">
        <legend className="sr-only">Your published quizzes</legend>
        {shown.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing matches.</p>}
        {shown.map((q) => (
          <label key={q.quizId}>
            <input type="radio" name="lti-quiz" checked={choice?.kind === "quiz" && choice.id === q.quizId}
                   onChange={() => onChoose({ kind: "quiz", id: q.quizId, title: q.title })} />
            <span>
              <strong>{q.title}</strong>
              <span className="muted"> · {gradeLabel(q.grade)} · {q.subject} · {q.questionCount} {q.questionCount === 1 ? "question" : "questions"}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

/** The shared library: search it, then pick one quiz or activity. */
function LibraryQuizzes({ choice, onChoose }: { choice: Choice | null; onChoose: (c: Choice) => void }) {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [cards, setCards] = useState<LibraryCard[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCards(null);
    setError(null);
    setPage(0);
    const u = new URLSearchParams({ page: "0" });
    if (q) u.set("q", q);
    api<LibraryPage>("/api/v1/library/quizzes?" + u.toString()).then((r) => { setCards(r.quizzes); setMore(r.more); })
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load the library."));
  }, [q]);

  async function loadMore() {
    const u = new URLSearchParams({ page: String(page + 1) });
    if (q) u.set("q", q);
    try {
      const r = await api<LibraryPage>("/api/v1/library/quizzes?" + u.toString());
      setCards([...(cards ?? []), ...r.quizzes]);
      setMore(r.more);
      setPage(page + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not load more of the library.");
    }
  }

  return (
    <div className="card stack">
      <div className="field">
        <label htmlFor="lti-lib-search">Search the library</label>
        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
          <input id="lti-lib-search" type="search" value={search} style={{ flex: 1, minWidth: 0 }}
                 onChange={(e) => setSearch(e.target.value)}
                 onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); setQ(search.trim()); } }} />
          <button type="button" className="btn btn-light" onClick={() => setQ(search.trim())}>Search</button>
        </div>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!cards && !error && <LoadingState rows={3} label="Loading the library" />}
      {cards && cards.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing matches. Try other words.</p>}
      {cards && cards.length > 0 && (
        <fieldset className="pick-list">
          <legend className="sr-only">Library quizzes and activities</legend>
          {cards.map((c) => (
            <label key={c.libraryQuizId}>
              <input type="radio" name="lti-quiz" checked={choice?.kind === "library" && choice.id === c.libraryQuizId}
                     onChange={() => onChoose({ kind: "library", id: c.libraryQuizId, title: c.title })} />
              <span>
                <strong>{c.title}</strong>
                <span className="muted"> · {gradeLabel(c.grade)} · {c.courseName}{c.kind === "ACTIVITY" && c.format ? " · " + FORMAT_LABEL[c.format] : ""}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {more && <div className="row"><button type="button" className="btn btn-light" onClick={loadMore}>Show more</button></div>}
    </div>
  );
}
