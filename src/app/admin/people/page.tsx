"use client";

import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { isSchoolAdmin, useMe } from "@/lib/me";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";

type Role = "STUDENT" | "TEACHER" | "SCHOOL_ADMIN";

interface Person {
  userId: string;
  name: string;
  role: Role;
  email: string | null;
  username: string | null;
  grade: number | null;
  classes: string[];
  status: "ACTIVE" | "DISABLED";
  source: string;
  lastSignInAt: string | null;
}

interface ImportRow {
  line: number;
  role: string;
  name: string;
  login: string;
  problem: string | null;
  firstPassword: string | null;
}

interface ImportResult {
  saved: boolean;
  added: number;
  problems: number;
  rows: ImportRow[];
}

interface Login {
  name: string;
  username: string;
  password: string;
}

const ROLE_WORDS: Record<Role, string> = { STUDENT: "Student", TEACHER: "Teacher", SCHOOL_ADMIN: "School admin" };
const TEMPLATE = "role,name,email,username,grade,classes\n"
  + "teacher,Ms. Sara Ahmed,sara.ahmed@school.org,,,8B\n"
  + "student,Layla A.,,layla.a,8,8B\n"
  + "student,Omar Q.,,omar.q,8,8B;Math club\n";

/** People: the school admin adds teachers and students by hand or from a CSV file, resets passwords, switches people off. */
export default function PeoplePage() {
  return (
    <AppFrame wide>
      <People />
    </AppFrame>
  );
}

function People() {
  const me = useMe();
  const [people, setPeople] = useState<Person[] | null>(null);
  const [filter, setFilter] = useState<"" | Role>("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logins, setLogins] = useState<Login[]>([]);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filter) params.set("role", filter);
    if (query.trim()) params.set("q", query.trim());
    api<Person[]>("/api/v1/admin/people?" + params.toString())
      .then(setPeople)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your people."));
  }, [filter, query]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  if (!isSchoolAdmin(me)) {
    return <div className="alert alert-danger">People is for your school&apos;s Quizplayo admins.</div>;
  }

  const schoolLink = typeof window === "undefined" ? "" : `${window.location.origin}/s/${me.school.code ?? ""}`;

  async function change(p: Person, body: Partial<Pick<Person, "status">>) {
    setError(null);
    try {
      await api(`/api/v1/admin/people/${p.userId}`, { method: "PATCH", body });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not save that change.");
    }
  }

  async function reset(p: Person) {
    if (!window.confirm(`Give ${p.name} a new first password? Their current password stops working.`)) return;
    setError(null);
    try {
      const r = await api<{ firstPassword: string }>(`/api/v1/admin/people/${p.userId}/reset-password`, { method: "POST" });
      setLogins([{ name: p.name, username: p.username ?? "", password: r.firstPassword }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not reset the password.");
    }
  }

  return (
    <div className="stack">
      <PageHeader title="People"
                  description={<>Teachers and admins sign in with their own Quizplayo account (their email) on the sign-in page. Students sign in at <strong>{schoolLink}</strong> with the username and password you give them.</>} />

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {logins.length > 0 && <LoginCards logins={logins} schoolLink={schoolLink} onClose={() => setLogins([])} />}

      <div className="people-grid">
        <AddPerson onAdded={(login) => { load(); if (login) setLogins([login]); }} />
        <ImportCsv onSaved={(newLogins) => { load(); if (newLogins.length) setLogins(newLogins); }} />
      </div>

      <section className="card stack" aria-labelledby="people-list">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <h2 id="people-list" style={{ margin: 0 }}>Everyone at {me.school.name}</h2>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <select aria-label="Show" value={filter} onChange={(e) => setFilter(e.target.value as "" | Role)}>
              <option value="">Everyone</option>
              <option value="STUDENT">Students</option>
              <option value="TEACHER">Teachers</option>
              <option value="SCHOOL_ADMIN">School admins</option>
            </select>
            <input type="search" aria-label="Search people" placeholder="Search name, email or username"
                   value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        {!people && <LoadingState rows={4} label="Loading people" />}
        {people && people.length === 0 && (
          <EmptyState title={query || filter ? "Nobody matches" : "No people yet"}>
            {query || filter ? "Try another search." : "Add your teachers and students above, by hand or from a CSV file."}
          </EmptyState>
        )}
        {people && people.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Role</th><th>Signs in with</th><th>Classes</th><th>Last signed in</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.userId} className={p.status === "DISABLED" ? "muted-row" : undefined}>
                    <td><strong>{p.name}</strong>{p.grade != null && <span className="muted"> · Grade {p.grade === 0 ? "K" : p.grade}</span>}</td>
                    <td>{ROLE_WORDS[p.role] ?? p.role}</td>
                    <td>{p.email ?? p.username ?? <span className="muted">School portal</span>}</td>
                    <td>{p.classes.join(", ") || <span className="muted">—</span>}</td>
                    <td>{p.lastSignInAt ? new Date(p.lastSignInAt).toLocaleDateString() : <span className="muted">Never</span>}</td>
                    <td>
                      <span className={"chip" + (p.status === "ACTIVE" ? " chip-ok" : "")}>
                        {p.status === "ACTIVE" ? "Active" : "Switched off"}
                      </span>
                    </td>
                    <td className="row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {p.role === "STUDENT" && p.username && (
                        <button type="button" className="btn btn-light" onClick={() => reset(p)}>Reset password</button>
                      )}
                      {p.userId !== me.userId && (
                        <button type="button" className="btn btn-light"
                                onClick={() => change(p, { status: p.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>
                          {p.status === "ACTIVE" ? "Switch off" : "Switch on"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** One person by hand. A student's first password comes back once, to print or read out. */
function AddPerson({ onAdded }: { onAdded: (login: Login | null) => void }) {
  const [role, setRole] = useState<Role>("STUDENT");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [grade, setGrade] = useState("");
  const [classes, setClasses] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const student = role === "STUDENT";

  async function add() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await api<{ person: Person; firstPassword: string | null }>("/api/v1/admin/people", {
        method: "POST",
        body: {
          role, name,
          email: student ? null : email,
          username: student ? username : null,
          grade: grade === "" ? null : Number(grade),
          classes: classes.split(",").map((c) => c.trim()).filter(Boolean),
        },
      });
      onAdded(r.firstPassword ? { name: r.person.name, username: r.person.username ?? "", password: r.firstPassword } : null);
      setNotice(student ? `${r.person.name} was added.` : `${r.person.name} was added and emailed how to sign in.`);
      setName(""); setEmail(""); setUsername(""); setClasses("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not add this person.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" aria-labelledby="add-person" onSubmit={(e) => { e.preventDefault(); add(); }}>
      <h2 id="add-person" style={{ margin: 0 }}>Add a person</h2>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="ap-role">Role</label>
          <select id="ap-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="STUDENT">Student</option>
            <option value="TEACHER">Teacher</option>
            <option value="SCHOOL_ADMIN">School admin</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ap-name">Name</label>
          <input id="ap-name" type="text" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {student ? (
          <div className="field">
            <label htmlFor="ap-user">Username</label>
            <input id="ap-user" type="text" required autoCapitalize="none" value={username}
                   onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="e.g. layla.a" />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="ap-email">Work email</label>
            <input id="ap-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.org" />
          </div>
        )}
        <div className="field">
          <label htmlFor="ap-grade">Grade {student ? "" : "(optional)"}</label>
          <select id="ap-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">—</option>
            {Array.from({ length: 13 }, (_, g) => <option key={g} value={g}>{g === 0 ? "Kindergarten" : `Grade ${g}`}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ap-classes">Classes (optional)</label>
          <input id="ap-classes" type="text" value={classes} onChange={(e) => setClasses(e.target.value)} placeholder="8B, Math club" />
          <p className="hint">Separate classes with commas. New classes are created for you.</p>
        </div>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      <div className="row">
        <button className="btn btn-primary" type="submit" disabled={busy || !name.trim() || (student ? !username.trim() : !email.trim())}>
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
    </form>
  );
}

/** A CSV file: first checked (every problem listed, nothing saved), then saved all at once. */
function ImportCsv({ onSaved }: { onSaved: (logins: Login[]) => void }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(save: boolean) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<ImportResult>(`/api/v1/admin/people/import?save=${save}`, { method: "POST", body: { csv } });
      setResult(r);
      if (r.saved) {
        onSaved(r.rows.filter((x) => x.firstPassword).map((x) => ({ name: x.name, username: x.login, password: x.firstPassword ?? "" })));
        setCsv("");
        setFileName(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not read this file.");
    } finally {
      setBusy(false);
    }
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_000_000) {
      setError("This file is bigger than 1 MB. Split it into smaller files.");
      return;
    }
    setFileName(file.name);
    setResult(null);
    setCsv(await file.text());
  }

  return (
    <section className="card stack" aria-labelledby="import-csv">
      <h2 id="import-csv" style={{ margin: 0 }}>Add many from a CSV file</h2>
      <p className="muted" style={{ margin: 0 }}>
        Columns: <code>role,name,email,username,grade,classes</code>. Teachers need an email, students a username;
        separate several classes with semicolons.{" "}
        <button type="button" className="link-button" onClick={() => download("people-template.csv", TEMPLATE)}>Download the template</button>
      </p>
      <label className="file-drop">
        <input type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} />
        <span>{fileName ?? "Choose a CSV file"}</span>
      </label>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {result && !result.saved && (
        result.problems > 0 ? (
          <div className="alert alert-warning">{result.problems} {result.problems === 1 ? "row needs" : "rows need"} fixing. Nothing was saved.</div>
        ) : (
          <div className="alert alert-success">All {result.rows.length} rows look right.</div>
        )
      )}
      {result?.saved && <div className="alert alert-success">{result.added} people were added.</div>}
      {result && !result.saved && result.rows.length > 0 && (
        <div className="table-scroll" style={{ maxHeight: 260, overflow: "auto" }}>
          <table>
            <thead><tr><th>Line</th><th>Name</th><th>Email or username</th><th>Check</th></tr></thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.line}>
                  <td>{r.line}</td>
                  <td>{r.name}</td>
                  <td>{r.login}</td>
                  <td>{r.problem ? <span className="text-danger">{r.problem}</span> : <span className="chip chip-ok">OK</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row">
        <button className="btn btn-light" type="button" disabled={busy || !csv} onClick={() => send(false)}>Check the file</button>
        <button className="btn btn-primary" type="button" disabled={busy || !csv || !result || result.saved || result.problems > 0}
                onClick={() => send(true)}>
          {busy ? "Working…" : result && !result.saved && result.problems === 0 ? `Add ${result.rows.length} people` : "Add people"}
        </button>
      </div>
    </section>
  );
}

/** Students' first logins, shown once: print them, or download them as a CSV file. */
function LoginCards({ logins, schoolLink, onClose }: { logins: Login[]; schoolLink: string; onClose: () => void }) {
  const csv = "name,username,first password,sign in at\n"
    + logins.map((l) => [l.name, l.username, l.password, schoolLink].map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
  return (
    <section className="card stack login-cards" aria-labelledby="logins-title">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 id="logins-title" style={{ margin: 0 }}>{logins.length === 1 ? "First login" : `${logins.length} first logins`}</h2>
        <button type="button" className="btn btn-light" onClick={onClose}>Done</button>
      </div>
      <div className="alert alert-warning">
        These first passwords are shown only now. Give each student theirs; they choose their own at their first sign-in.
      </div>
      <div className="login-card-grid">
        {logins.slice(0, 60).map((l) => (
          <div className="login-card" key={l.username}>
            <strong>{l.name}</strong>
            <span>Username: <code>{l.username}</code></span>
            <span>First password: <code>{l.password}</code></span>
            <span className="muted">{schoolLink}</span>
          </div>
        ))}
      </div>
      {logins.length > 60 && <p className="muted">Showing 60 of {logins.length}. Download the file for all of them.</p>}
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => download("first-logins.csv", csv)}>Download as CSV</button>
        <button type="button" className="btn btn-light" onClick={() => window.print()}>Print</button>
      </div>
    </section>
  );
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
