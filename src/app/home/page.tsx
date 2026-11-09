"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { JoinSuggestion, LinkAccountOffer } from "@/components/MembershipBanners";
import { StandardFilter } from "@/components/StandardFilter";
import { Trend } from "@/components/Trend";
import type { StudentReport } from "@/lib/reports";
import { StarterShelf } from "@/components/StarterShelf";
import { TemplateSelector } from "@/components/TemplateSelector";
import { normalizePin } from "@/lib/pin";
import { api, ApiError } from "@/lib/api";
import { gradeLabel, QuizSummary } from "@/lib/content";
import { AssignmentSummary, dueText, MyAssignment, rightText } from "@/lib/assignments";
import { isIndependent, isSchoolAdmin, isStaff, useMe } from "@/lib/me";
import { GRADES } from "@/lib/school";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";

export default function HomePage() {
  return (
    <AppFrame>
      <Suspense>
        <Home />
      </Suspense>
    </AppFrame>
  );
}

function Home() {
  const me = useMe();
  if (me.platformTeam && !isStaff(me)) return <PlatformHome />;
  return isStaff(me) ? <TeacherHome /> : <StudentHome />;
}

function PlatformHome() {
  const me = useMe();
  return (
    <div className="stack">
      <PageHeader title={"Welcome, " + me.name} description="Quizplayo platform team" />
      <div className="tiles">
        <Link className="tile card" href="/platform">
          <h2>Platform console</h2>
          <p>Every school and teacher that signed up, sign-ups per day, and suspending or closing a workspace.</p>
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- teachers and admins

type Tab = "quizzes" | "games" | "assignments" | "activity";
const TABS: { id: Tab; label: string }[] = [
  { id: "quizzes", label: "My quizzes" },
  { id: "games", label: "Games" },
  { id: "assignments", label: "Assignments" },
  { id: "activity", label: "Activity" },
];

/**
 * The teacher's dashboard: the grade picker on the first visit (a personal workspace's teacher, or a school's admin),
 * the admin's checklist, the starter shelf for the workspace's grades, then My quizzes, Games and Activity.
 */
function TeacherHome() {
  const me = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const asked = params.get("tab") as Tab | null;
  const tab: Tab = asked && TABS.some((t) => t.id === asked) ? asked : "quizzes";
  const [grades, setGrades] = useState<number[]>(me.school.grades);
  const [changing, setChanging] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const canPick = isIndependent(me) || isSchoolAdmin(me);
  const firstVisit = canPick && grades.length === 0;

  return (
    <div className="stack">
      <PageHeader title={"Welcome, " + me.name}
                  description={<>{me.school.name}{me.classes.length > 0 && <> · Classes {me.classes.join(", ")}</>}</>}
                  action={
                    <div className="row" style={{ gap: 8 }}>
                      <button type="button" className="btn btn-light" onClick={() => setShowTemplates(true)}>Quick Launch</button>
                      <Link className="btn btn-primary" href="/teacher/quiz/new">Create a quiz</Link>
                    </div>
                  } />
      {showTemplates && (
        <TemplateSelector grade={me.grade ?? (grades[0] ?? 5)} onClose={() => setShowTemplates(false)}
                          onLaunched={(quizId) => router.push("/teacher/quiz/" + quizId + "/edit")} />
      )}
      {(firstVisit || changing) && (
        <FirstVisit school={!isIndependent(me)} current={grades} changing={changing}
                    onDone={(g) => { setGrades(g); setChanging(false); }} onCancel={() => setChanging(false)} />
      )}
      {isSchoolAdmin(me) && !isIndependent(me) && <Checklist key={grades.join(",")} />}
      <LinkAccountOffer />
      <JoinSuggestion />
      {grades.length > 0 && !changing && (
        <StarterShelf grades={grades} firstGrade={me.grade}
                      onChangeGrades={isSchoolAdmin(me) && !isIndependent(me) ? () => setChanging(true) : undefined} />
      )}

      <div className="tabs" role="tablist" aria-label="Your dashboard">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : undefined}
                  onClick={() => router.replace(t.id === "quizzes" ? "/home" : "/home?tab=" + t.id, { scroll: false })}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "quizzes" && <MyQuizzes />}
      {tab === "games" && <Games />}
      {tab === "assignments" && <TeacherAssignments />}
      {tab === "activity" && <ActivityFeed />}
      {me.devTools && (
        <p className="muted">Development: <Link href="/dev/class-simulator">class simulator</Link></p>
      )}
    </div>
  );
}

/**
 * The grades the workspace teaches, which pick its starter shelf from the library: a teacher's own on their first
 * visit, or a school's (its admin picks them on first landing and may change them later).
 */
function FirstVisit({ school, current, changing, onDone, onCancel }: {
  school: boolean;
  current: number[];
  changing: boolean;
  onDone: (grades: number[]) => void;
  onCancel: () => void;
}) {
  const [grades, setGrades] = useState<number[]>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ grades: number[] }>("/api/v1/workspace/grades", { method: "POST", body: { grades } });
      onDone(r.grades);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not save your grades. Please try again.");
      setBusy(false);
    }
  }

  return (
    <section className="card stack first-visit" aria-labelledby="first-visit-title">
      <div>
        <h2 id="first-visit-title" style={{ margin: 0 }}>
          {school ? "Which grades does your school teach?" : "Pick the grades you teach"}
        </h2>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          We&apos;ll put ready-made quizzes for {school ? "these grades on every teacher's home page" : "them on your home page"}.
          {school && " You can change them later."}
        </p>
      </div>
      <div className="checks">
        {GRADES.map((g) => {
          const on = grades.includes(g);
          return (
            <label key={g} className={on ? "on" : undefined}>
              <input type="checkbox" checked={on}
                     onChange={() => setGrades(on ? grades.filter((x) => x !== g) : [...grades, g])} />
              {g === 0 ? "Kindergarten" : "Grade " + g}
            </label>
          );
        })}
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="button" onClick={save} disabled={busy || grades.length === 0}>
          {busy ? "Saving…" : changing ? "Save grades" : "Show my starter quizzes"}
        </button>
        {changing && <button className="btn btn-light" type="button" onClick={onCancel}>Cancel</button>}
      </div>
    </section>
  );
}

interface Setup {
  people: { done: boolean; fromPortal: boolean };
  grades: { done: boolean };
  brandDone: boolean;
  dismissed: boolean;
  signIn: { schoolPage: string | null };
}

/** The school admin's "Get started" list, until every step is done or they skip it. */
function Checklist() {
  const [setup, setSetup] = useState<Setup | null>(null);

  useEffect(() => {
    api<Setup>("/api/v1/admin/setup").then(setSetup).catch(() => setSetup(null));
  }, []);

  if (!setup || setup.dismissed) return null;
  const items = [
    { done: setup.people.done, label: setup.people.fromPortal ? "Copy people from your school's system" : "Add your teachers and students",
      href: setup.people.fromPortal ? "/admin/setup" : "/admin/people" },
    { done: setup.grades.done, label: "Choose your school's grades", href: "/home" },
    { done: setup.brandDone, label: "Add your logo and colours", href: "/admin/brand" },
  ];
  if (items.every((i) => i.done)) return null;

  async function skip() {
    try {
      setSetup(await api<Setup>("/api/v1/admin/setup/dismiss", { method: "POST", body: { dismissed: true } }));
    } catch {
      // The card stays; nothing else depends on it.
    }
  }

  return (
    <section className="card stack checklist" aria-labelledby="checklist-title">
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <h2 id="checklist-title" style={{ margin: 0 }}>Get started</h2>
        <button type="button" className="btn btn-light" onClick={skip}>Skip for now</button>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Your school is live. These steps are optional; you can come back to them from <Link href="/admin/setup">Get started</Link> in the menu.
      </p>
      <ul className="checklist-items">
        {items.map((i) => (
          <li key={i.label} className={i.done ? "done" : ""}>
            <span className="checklist-mark" aria-hidden="true">{i.done ? "✓" : ""}</span>
            {i.done ? <span>{i.label}</span> : <Link href={i.href}>{i.label}</Link>}
            <span className="sr-only">{i.done ? "(done)" : "(to do)"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MyQuizzes() {
  const me = useMe();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<QuizSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState<string>("");
  const [standard, setStandard] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<QuizSummary[]>("/api/v1/content/quizzes/mine" + (standard ? "?standard=" + encodeURIComponent(standard) : "")).then(setQuizzes)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your quizzes."));
  }, [standard]);
  useEffect(load, [load]);

  const shown = useMemo(() => (quizzes ?? []).filter((q) =>
    (!query.trim() || q.title.toLowerCase().includes(query.trim().toLowerCase()))
    && (grade === "" || q.grade === Number(grade))), [quizzes, query, grade]);

  async function duplicate(q: QuizSummary) {
    setBusy(q.quizId);
    try {
      const copy = await api<{ quizId: string }>("/api/v1/content/quizzes/" + q.quizId + "/duplicate", { method: "POST" });
      router.push("/teacher/quiz/" + copy.quizId + "/edit");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not copy the quiz.");
      setBusy(null);
    }
  }

  async function remove(q: QuizSummary) {
    if (!window.confirm(`Delete "${q.title}"? Games already played keep their results.`)) return;
    setBusy(q.quizId);
    try {
      await api("/api/v1/content/quizzes/" + q.quizId, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not delete the quiz.");
    }
    setBusy(null);
  }

  if (!quizzes) return error ? <div className="alert alert-danger">{error}</div> : <LoadingState rows={4} label="Loading your quizzes" />;
  if (quizzes.length === 0 && !standard) {
    return (
      <EmptyState title="No quizzes yet" action={
        <div className="row" style={{ gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="btn btn-primary" href="/teacher/quiz/new">Create a quiz</Link>
          <Link className="btn btn-light" href="/library">Browse the library</Link>
          <Link className="btn btn-light" href="/teacher/studio">Draft one with AI</Link>
        </div>
      }>
        Write your own, pick a ready one, or let AI draft one for you.
      </EmptyState>
    );
  }
  const grades = [...new Set(quizzes.map((q) => q.grade))].sort((a, b) => a - b);

  return (
    <div className="stack">
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <input type="search" aria-label="Search your quizzes" placeholder="Search your quizzes" value={query}
               onChange={(e) => setQuery(e.target.value)} style={{ flex: "1 1 220px" }} />
        <select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">All grades</option>
          {grades.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
        </select>
        <StandardFilter id="my-standard" value={standard} onCommit={setStandard} />
      </div>
      {shown.length === 0 && <p className="muted">No quiz matches. Try another word or grade.</p>}
      <div className="quiz-grid">
        {shown.map((q) => {
          const published = !!q.versionId;
          const editable = q.source !== "BANK" && (q.ownerUserId === me.userId || isSchoolAdmin(me));
          return (
            <article key={q.quizId} className="card quiz-card">
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <span className="chip">{q.subject}</span>
                <span className="chip">{gradeLabel(q.grade)}</span>
                {!published && <span className="chip chip-warn">Draft</span>}
                {q.source === "AI" && <span className="chip chip-new">AI Studio</span>}
              </div>
              <h3><Link href={"/teacher/quiz/" + q.quizId + (published ? "" : "/edit")}>{q.title}</Link></h3>
              <p className="muted">{q.questionCount} questions · updated {new Date(q.updatedAt).toLocaleDateString()}</p>
              <div className="quiz-card-actions">
                {published
                  ? <Link className="btn btn-primary" href={"/teacher/quiz/" + q.quizId}>Host</Link>
                  : <Link className="btn btn-primary" href={"/teacher/quiz/" + q.quizId + "/edit"}>Finish and publish</Link>}
                {editable && published && <Link className="btn btn-light" href={"/teacher/quiz/" + q.quizId + "/edit"}>Edit</Link>}
                <button type="button" className="btn btn-light" disabled={busy === q.quizId} onClick={() => duplicate(q)}>Duplicate</button>
                {editable && (
                  <button type="button" className="btn btn-light" disabled={busy === q.quizId} onClick={() => remove(q)}>Delete</button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

interface GameSummary {
  gameId: string;
  quizTitle: string;
  classCode: string | null;
  status: string;
  players: number;
  createdAt: string;
  requireSignIn: boolean;
  mode: string;
}

function Games() {
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<GameSummary[]>("/api/v1/live/games/mine").then(setGames)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your games."));
  }, []);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!games) return <LoadingState rows={3} label="Loading your games" />;
  if (games.length === 0) {
    return <EmptyState title="No games yet">Host a quiz from My quizzes; its report appears here when it ends.</EmptyState>;
  }
  return (
    <div className="table-scroll">
      <table>
        <thead><tr><th>Quiz</th><th>Date</th><th>Players</th><th>Who could join</th><th>Status</th><th /></tr></thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.gameId}>
              <td>{g.quizTitle}{g.mode && g.mode !== "CLASSIC" && <> <span className="chip">{g.mode === "TEAM" ? "Team" : "Accuracy"}</span></>}</td>
              <td>{new Date(g.createdAt).toLocaleString()}</td>
              <td>{g.players}</td>
              <td>{g.requireSignIn ? "Signed-in students" + (g.classCode ? " of " + g.classCode : "") : "Anyone with the PIN"}</td>
              <td>{g.status === "FINISHED" ? "Finished" : g.status === "RUNNING" ? "Playing" : g.status === "LOBBY" ? "Waiting" : "Ended"}</td>
              <td>{g.status === "FINISHED" && <Link href={"/teacher/games/" + g.gameId}>Report</Link>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Activity {
  kind: "QUIZ_CREATED" | "QUIZ_PUBLISHED" | "GAME_HOSTED" | "GAME_FINISHED" | "PERSON_ADDED";
  at: string;
  refId: string;
  title: string;
  number: number | null;
  detail: string | null;
}

const ROLE_WORDS: Record<string, string> = { TEACHER: "teacher", SCHOOL_ADMIN: "school admin", STUDENT: "student" };

function describe(a: Activity): React.ReactNode {
  switch (a.kind) {
    case "QUIZ_CREATED":
      return <>You created <Link href={"/teacher/quiz/" + a.refId}>{a.title}</Link></>;
    case "QUIZ_PUBLISHED":
      return <>You published <Link href={"/teacher/quiz/" + a.refId}>{a.title}</Link>{a.number && a.number > 1 ? " (version " + a.number + ")" : ""}</>;
    case "GAME_HOSTED":
      return <>You hosted a game of {a.title}</>;
    case "GAME_FINISHED":
      return <>{a.number ?? 0} {a.number === 1 ? "player" : "players"} finished {a.title} · <Link href={"/teacher/games/" + a.refId}>report</Link></>;
    case "PERSON_ADDED":
      return <>{a.title} joined as a {ROLE_WORDS[a.detail ?? ""] ?? "member"}</>;
  }
}

function ActivityFeed() {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const page = useCallback(async (before: string | null) => {
    setBusy(true);
    try {
      const next = await api<Activity[]>("/api/v1/activity/mine" + (before ? "?before=" + encodeURIComponent(before) : ""));
      setItems((cur) => (before && cur ? [...cur, ...next] : next));
      setMore(next.length === 20);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not load your activity.");
    }
    setBusy(false);
  }, []);
  useEffect(() => { page(null); }, [page]);

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!items) return <LoadingState rows={4} label="Loading your activity" />;
  if (items.length === 0) return <EmptyState title="Nothing yet">Quizzes you make and games you host show up here.</EmptyState>;
  return (
    <div className="stack">
      <ul className="activity-feed">
        {items.map((a, i) => (
          <li key={a.kind + a.refId + i}>
            <span className={"activity-dot activity-" + a.kind.toLowerCase()} aria-hidden="true" />
            <span>{describe(a)}</span>
            <time className="muted" dateTime={a.at}>{new Date(a.at).toLocaleString()}</time>
          </li>
        ))}
      </ul>
      {more && (
        <div><button type="button" className="btn btn-light" disabled={busy} onClick={() => page(items[items.length - 1].at)}>
          {busy ? "Loading…" : "Load more"}
        </button></div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- students

interface MyResult {
  gameId: string;
  quizTitle: string;
  playedAt: string;
  rank: number;
  players: number;
  score: number;
  correct: number;
  questions: number;
}

/** The teacher's assignments: link, class, due time, how many started and finished, and the results. */
function TeacherAssignments() {
  const [list, setList] = useState<AssignmentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<AssignmentSummary[]>("/api/v1/assignments/mine").then(setList)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your assignments."));
  }, []);

  if (error) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!list) return <LoadingState rows={3} label="Loading your assignments" />;
  if (list.length === 0) {
    return (
      <EmptyState title="No assignments yet">
        Open a quiz (yours or one from the library) and choose <strong>Assign it</strong>: students do it at their own pace.
      </EmptyState>
    );
  }
  return (
    <ul className="assignment-list">
      {list.map((a) => (
        <li key={a.assignmentId}>
          <div>
            <strong>{a.title}</strong>
            <div className="muted" style={{ fontSize: 14 }}>
              {a.classCode ? "Class " + a.classCode : "Anyone with the link"}{a.dueAt && <> · {dueText(a.dueAt)}</>}
              {" · "}{a.finished} of {a.started} finished
            </div>
          </div>
          <span className="row" style={{ gap: 8 }}>
            <span className={"chip " + (a.open ? "chip-ok" : "")}>{a.open ? "Open" : "Closed"}</span>
            <Link className="btn btn-light" href={"/teacher/assignments/" + a.assignmentId}>Results<span className="sr-only"> of {a.title}</span></Link>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** A student's own class assignments, with where they are in each. */
function MyAssignments() {
  const [list, setList] = useState<MyAssignment[] | null>(null);

  useEffect(() => {
    api<MyAssignment[]>("/api/v1/assignments/for-me").then(setList).catch(() => setList([]));
  }, []);

  if (!list || list.length === 0) return null;
  return (
    <section className="stack" aria-labelledby="my-assignments">
      <h2 id="my-assignments">Your assignments</h2>
      <ul className="assignment-list">
        {list.map((a) => (
          <li key={a.code}>
            <div>
              <strong>{a.title}</strong>
              <div className="muted" style={{ fontSize: 14 }}>
                {a.questions} questions{a.dueAt && <> · {dueText(a.dueAt)}</>}
                {a.status === "DONE" && <> · {[a.scored !== undefined ? rightText(a) : a.correct + " right", a.score + " points"]
                  .filter(Boolean).join(", ")}</>}
              </div>
            </div>
            {a.status === "DONE" ? <span className="chip chip-ok">Done</span>
              : !a.open ? <span className="chip">Closed</span>
              : <Link className="btn btn-primary" href={"/a/" + a.code}>{a.status === "IN_PROGRESS" ? "Carry on" : "Start"}<span className="sr-only"> {a.title}</span></Link>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function StudentHome() {
  const me = useMe();
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MyResult[] | null>(null);

  useEffect(() => {
    api<MyResult[]>("/api/v1/live/results/mine").then(setResults).catch(() => setResults([]));
  }, []);

  function join(e: React.FormEvent) {
    e.preventDefault();
    const clean = normalizePin(pin);
    if (!clean) {
      setError("A game PIN is 6 digits. Check the number on your teacher's screen.");
      return;
    }
    router.push("/play?pin=" + clean);
  }

  return (
    <div className="stack" style={{ maxWidth: 620, margin: "0 auto", width: "100%" }}>
      <h1>Hi, {me.name}</h1>
      <p className="muted">
        {me.school.name}
        {me.grade !== null && <> · Grade {me.grade === 0 ? "K" : me.grade}</>}
        {me.classes.length > 0 && <> · Class {me.classes.join(", ")}</>}
      </p>
      <form className="card stack" onSubmit={join}>
        <h2>Join a live game</h2>
        <label htmlFor="pin">Game PIN</label>
        <input id="pin" type="text" inputMode="numeric" autoComplete="off" placeholder="123 456" value={pin}
               onChange={(e) => { setPin(e.target.value); setError(null); }} className="code-input" />
        {error && <div className="alert alert-danger">{error}</div>}
        <button className="btn btn-primary" type="submit">Enter</button>
        <p className="muted">You&apos;re signed in, so games at {me.school.name} save your score here.</p>
      </form>

      <MyAssignments />

      <MyProgress />

      <section className="stack">
        <h2>My results</h2>
        {!results && <LoadingState rows={2} label="Loading your results" />}
        {results && results.length === 0 && <p className="muted">No games yet. Your results appear here after you play.</p>}
        {results && results.length > 0 && (
          <ul className="result-list">
            {results.map((r) => (
              <li key={r.gameId} className="card">
                <div>
                  <strong>{r.quizTitle}</strong>
                  <div className="muted">{new Date(r.playedAt).toLocaleDateString()}</div>
                </div>
                <div className="result-numbers">
                  <span><strong>{ordinalPlace(r.rank)}</strong> of {r.players}</span>
                  <span>{r.correct} of {r.questions} correct</span>
                  <span>{r.score} points</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * "My progress" (wave3-plan.md, 3b): a signed-in student's own accuracy over the last 90 days and how their recent games
 * and assignments went. Only the student's own: nothing about classmates.
 */
function MyProgress() {
  const [report, setReport] = useState<StudentReport | null | undefined>(undefined);

  useEffect(() => {
    api<StudentReport>("/api/v1/reports/me").then(setReport).catch(() => setReport(null));
  }, []);

  if (report === undefined) return <LoadingState rows={2} label="Loading your progress" />;
  if (report === null || report.sessions === 0) return null;
  return (
    <section className="stack" aria-labelledby="my-progress">
      <h2 id="my-progress">My progress</h2>
      <div className="card progress-card">
        <div>
          <span className="muted">Right, last 90 days</span>
          <strong className="progress-number">{report.percent}%</strong>
        </div>
        <div>
          <span className="muted">Last 5 games and assignments</span>
          <strong className="progress-number">{report.recentPercent}%</strong>
        </div>
        <div>
          <span className="muted">Over time</span>
          <Trend values={report.trend} label="Your accuracy" width={140} height={40} />
        </div>
      </div>
      <ul className="result-list">
        {report.timeline.slice(0, 5).map((s, i) => (
          <li key={i} className="card">
            <div>
              <strong>{s.title}</strong>
              <div className="muted">{s.source === "GAME" ? "Game" : "Assignment"} · {new Date(s.at).toLocaleDateString()}</div>
            </div>
            <div className="result-numbers"><span>{s.percent}% right</span></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ordinalPlace(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return n + s;
}
