"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import { AppFrame } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { isSchoolAdmin, useMe } from "@/lib/me";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";
import { LinkQr } from "@/components/LinkQr";

type Role = "STUDENT" | "TEACHER" | "SCHOOL_ADMIN";

interface Person {
  userId: string;
  name: string;
  role: Role;
  email: string | null;
  username: string | null;
  grade: number | null;
  classes: string[];
  status: "ACTIVE" | "DISABLED" | "ARCHIVED";
  source: string;
  lastSignInAt: string | null;
  /** Staff: LINKED (joined with their Quizplayo account), INVITED (not accepted yet) or null. */
  account: "LINKED" | "INVITED" | null;
}

interface Invitation {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  sentAt: string;
  expiresAt: string;
  expired: boolean;
}

interface JoinRequest {
  id: string;
  name: string;
  email: string;
  message: string | null;
  createdAt: string;
}

interface ImportRow {
  line: number;
  role: string;
  name: string;
  login: string;
  problem: string | null;
  firstPassword: string | null;
  inviteLink: string | null;
}

interface ImportResult {
  saved: boolean;
  added: number;
  problems: number;
  rows: ImportRow[];
}

/** A student's way in, shown once: a first password, or an invite link to choose their own (D27). */
interface Login {
  /** Set when the school can email this student's link (adding one student, or a new link). */
  userId?: string;
  name: string;
  username: string;
  password?: string | null;
  link?: string | null;
}

type Access = "INVITE_LINK" | "FIRST_PASSWORD";

/** Per add or import, how new students get in; starts on the school's default. */
function AccessChoice({ value, onChange, id }: { value: Access; onChange: (v: Access) => void; id: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>New students get</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as Access)}>
        <option value="INVITE_LINK">An invite link to choose their own password</option>
        <option value="FIRST_PASSWORD">A first password you give them</option>
      </select>
    </div>
  );
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
  const [showArchived, setShowArchived] = useState(false);
  const [access, setAccess] = useState<Access>("INVITE_LINK");
  const [error, setError] = useState<string | null>(null);
  const [logins, setLogins] = useState<Login[]>([]);
  const [changed, setChanged] = useState(0);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filter) params.set("role", filter);
    if (query.trim()) params.set("q", query.trim());
    if (showArchived) params.set("archived", "true");
    api<Person[]>("/api/v1/admin/people?" + params.toString())
      .then(setPeople)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your people."));
  }, [filter, query, showArchived, changed]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    api<{ access: Access }>("/api/v1/admin/people/access-default").then((r) => setAccess(r.access)).catch(() => undefined);
  }, []);

  async function saveDefault(next: Access) {
    setError(null);
    try {
      setAccess((await api<{ access: Access }>("/api/v1/admin/people/access-default", { method: "PUT", body: { access: next } })).access);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not save that setting.");
    }
  }

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

  async function archive(p: Person) {
    if (!window.confirm(`Archive ${p.name}? They are signed out and can't sign in, and they leave your lists. `
      + "Nothing of theirs is deleted: you can restore them under Show archived.")) return;
    await change(p, { status: "ARCHIVED" });
  }

  async function reset(p: Person, how: Access) {
    if (!window.confirm(how === "INVITE_LINK"
      ? `Make a new invite link for ${p.name}? Any earlier link stops working; their password stays until they use the new link.`
      : `Give ${p.name} a new first password? Their current password stops working.`)) return;
    setError(null);
    try {
      const r = await api<{ firstPassword?: string; inviteLink?: string }>(`/api/v1/admin/people/${p.userId}/access`,
        { method: "POST", body: { access: how } });
      setLogins([{ userId: p.userId, name: p.name, username: p.username ?? "", password: r.firstPassword ?? null, link: r.inviteLink ?? null }]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not reset the password.");
    }
  }

  return (
    <div className="stack">
      <PageHeader title="People"
                  description={<>Teachers and admins you add get an email invitation, and join with their own Quizplayo account. Students sign in at <strong>{schoolLink}</strong> with the username and password you give them.</>} />

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {logins.length > 0 && <LoginCards logins={logins} schoolLink={schoolLink} onClose={() => setLogins([])} />}

      <div className="people-grid">
        <AddPerson defaultAccess={access} onAdded={(login) => { setChanged((n) => n + 1); if (login) setLogins([login]); }} />
        <ImportCsv defaultAccess={access} onSaved={(newLogins) => { setChanged((n) => n + 1); if (newLogins.length) setLogins(newLogins); }} />
      </div>

      <section className="card row" aria-labelledby="access-title" style={{ flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
        <div style={{ minWidth: 0, flex: "1 1 260px" }}>
          <h2 id="access-title" style={{ margin: 0, fontSize: 18 }}>How new students get in</h2>
          <p className="hint" style={{ margin: 0 }}>The choice adding or importing students starts on. An invite link lets each student choose their own password, so nobody else knows it.</p>
        </div>
        <select aria-label="How new students get in" value={access} onChange={(e) => saveDefault(e.target.value as Access)}>
          <option value="INVITE_LINK">Invite links (recommended)</option>
          <option value="FIRST_PASSWORD">First passwords</option>
        </select>
      </section>

      <OneRosterImport onApplied={() => setChanged((n) => n + 1)} />

      <JoinRequests changed={changed} onDecided={() => setChanged((n) => n + 1)} />
      <Invitations changed={changed} onChanged={() => setChanged((n) => n + 1)} />

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
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show archived
            </label>
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
                  <tr key={p.userId} className={p.status !== "ACTIVE" ? "muted-row" : undefined}>
                    <td><strong>{p.name}</strong>{p.grade != null && <span className="muted"> · Grade {p.grade === 0 ? "K" : p.grade}</span>}</td>
                    <td>{ROLE_WORDS[p.role] ?? p.role}</td>
                    <td>
                      {p.email ?? p.username ?? <span className="muted">School&apos;s system</span>}
                      {p.account === "INVITED" && <> <span className="chip chip-warn">Invited</span></>}
                    </td>
                    <td>{p.classes.join(", ") || <span className="muted">—</span>}</td>
                    <td>{p.lastSignInAt ? new Date(p.lastSignInAt).toLocaleDateString() : <span className="muted">Never</span>}</td>
                    <td>
                      <span className={"chip" + (p.status === "ACTIVE" ? " chip-ok" : "")}>
                        {p.status === "ACTIVE" ? "Active" : p.status === "ARCHIVED" ? "Archived" : "Switched off"}
                      </span>
                    </td>
                    <td className="row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                      {p.status === "ARCHIVED" ? (
                        <button type="button" className="btn btn-light" onClick={() => change(p, { status: "ACTIVE" })}>
                          Restore<span className="sr-only"> {p.name}</span>
                        </button>
                      ) : (
                        <>
                          {p.role === "STUDENT" && p.username && (
                            <>
                              <button type="button" className="btn btn-light" onClick={() => reset(p, "INVITE_LINK")}>New invite link</button>
                              <button type="button" className="btn btn-light" onClick={() => reset(p, "FIRST_PASSWORD")}>New first password</button>
                            </>
                          )}
                          {p.userId !== me.userId && (
                            <button type="button" className="btn btn-light"
                                    onClick={() => change(p, { status: p.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>
                              {p.status === "ACTIVE" ? "Switch off" : "Switch on"}
                            </button>
                          )}
                          {p.userId !== me.userId && (
                            <button type="button" className="btn btn-light" onClick={() => archive(p)}>
                              Archive<span className="sr-only"> {p.name}</span>
                            </button>
                          )}
                        </>
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
function AddPerson({ onAdded, defaultAccess }: { onAdded: (login: Login | null) => void; defaultAccess: Access }) {
  const [access, setAccess] = useState<Access>(defaultAccess);
  useEffect(() => setAccess(defaultAccess), [defaultAccess]);
  const me = useMe();
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
      const r = await api<{ person: Person; firstPassword: string | null; inviteLink: string | null }>("/api/v1/admin/people", {
        method: "POST",
        body: {
          role, name,
          email: student ? null : email,
          username: student ? username : null,
          grade: grade === "" ? null : Number(grade),
          classes: classes.split(",").map((c) => c.trim()).filter(Boolean),
          access: student ? access : null,
        },
      });
      onAdded(r.firstPassword || r.inviteLink
        ? { userId: r.person.userId, name: r.person.name, username: r.person.username ?? "", password: r.firstPassword, link: r.inviteLink } : null);
      setNotice(student ? `${r.person.name} was added.` : me.mailOn
        ? `${r.person.name} was added and emailed an invitation to join.`
        : `${r.person.name} was added. Emails are switched off on this server, so use "Copy a new link" under Invitations and share it with them yourself.`);
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
      {student && <AccessChoice id="add-access" value={access} onChange={setAccess} />}
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
function ImportCsv({ onSaved, defaultAccess }: { onSaved: (logins: Login[]) => void; defaultAccess: Access }) {
  const [access, setAccess] = useState<Access>(defaultAccess);
  useEffect(() => setAccess(defaultAccess), [defaultAccess]);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(save: boolean) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<ImportResult>(`/api/v1/admin/people/import?save=${save}&access=${access}`, { method: "POST", body: { csv } });
      setResult(r);
      if (r.saved) {
        onSaved(r.rows.filter((x) => x.firstPassword || x.inviteLink)
          .map((x) => ({ name: x.name, username: x.login, password: x.firstPassword, link: x.inviteLink })));
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
      <AccessChoice id="import-access" value={access} onChange={setAccess} />
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

interface RosterCounts {
  add: number;
  change: number;
  switchOff: number;
  unchanged: number;
}

interface RosterPreview {
  previewId: string;
  people: RosterCounts;
  classes: RosterCounts;
  enrollments: number;
  skippedRoles: number;
  problems: { file: string; line: number; message: string }[];
  problemCount: number;
  needsConfirm: string | null;
}

interface RosterApplied {
  added: number;
  changed: number;
  switchedOff: number;
  classesAdded: number;
  classesChanged: number;
  memberships: number;
}

const MAX_ZIP_BYTES = 20 * 1024 * 1024;

function plural(n: number, one: string, many: string): string {
  return n + " " + (n === 1 ? one : many);
}

/**
 * A OneRoster 1.1 export (a zip of CSV files) from the school's information system: first a preview (counts and every
 * problem, nothing changed), then "Apply". The zip goes to the API as it is, not as a form upload. A preview lasts
 * 30 minutes. If applying would switch off many people, the API stops and says why; the admin may apply anyway.
 */
function OneRosterImport({ onApplied }: { onApplied: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RosterPreview | null>(null);
  const [applied, setApplied] = useState<RosterApplied | null>(null);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  function pick(f: File | undefined) {
    setPreview(null);
    setApplied(null);
    setError(null);
    setNeedsConfirm(false);
    setFile(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".zip")) {
      setError("Choose the .zip file your school's information system exported (OneRoster 1.1, CSV).");
      return;
    }
    if (f.size > MAX_ZIP_BYTES) {
      setError("This zip is larger than 20 MB. Export only this school, or ask Quizplayo support to raise the limit.");
      return;
    }
    if (f.size === 0) {
      setError("This zip is empty. Export it again from your school's information system.");
      return;
    }
    setFile(f);
  }

  async function check() {
    if (!file) return;
    setBusy("preview");
    setError(null);
    setNeedsConfirm(false);
    setApplied(null);
    try {
      setPreview(await api<RosterPreview>("/api/v1/admin/people/oneroster", { method: "POST", body: file }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not read this zip.");
    }
    setBusy(null);
  }

  async function apply(confirm: boolean) {
    if (!preview) return;
    setBusy("apply");
    setError(null);
    setNeedsConfirm(false);
    try {
      const r = await api<RosterApplied>(
        `/api/v1/admin/people/oneroster/${encodeURIComponent(preview.previewId)}/apply?confirm=${confirm}`, { method: "POST" });
      setApplied(r);
      setPreview(null);
      setFile(null);
      onApplied();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not apply this import.");
      setNeedsConfirm(e instanceof ApiError && e.code === "oneroster_needs_confirm");
      if (e instanceof ApiError && e.code === "preview_expired") setPreview(null);
    }
    setBusy(null);
  }

  const p = preview;
  return (
    <section className="card stack" aria-labelledby="oneroster">
      <h2 id="oneroster" style={{ margin: 0 }}>Import from OneRoster</h2>
      <p className="muted" style={{ margin: 0 }}>
        Export people, classes and enrollments from your school&apos;s information system as a OneRoster 1.1 zip (CSV, up to 20 MB).
        Quizplayo shows what would change first; nothing changes until you choose Apply.
      </p>
      <label className="file-drop">
        <input type="file" accept=".zip,application/zip,application/x-zip-compressed" aria-describedby="oneroster-hint"
               onChange={(e) => { pick(e.target.files?.[0]); e.currentTarget.value = ""; }} />
        <span>{file ? file.name : "Choose a OneRoster .zip file"}</span>
      </label>
      <p id="oneroster-hint" className="hint" style={{ margin: 0 }}>A .zip file of at most 20 MB.</p>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
          {needsConfirm && preview && (
            <div className="row" style={{ marginTop: 8 }}>
              <button type="button" className="btn btn-light" disabled={busy !== null} onClick={() => apply(true)}>
                {busy === "apply" ? "Applying…" : "Apply anyway"}
              </button>
            </div>
          )}
        </div>
      )}

      {applied && (
        <div className="alert alert-success" role="status">
          Imported: {plural(applied.added, "person", "people")} added, {applied.changed} changed, {applied.switchedOff} switched off;{" "}
          {plural(applied.classesAdded, "class", "classes")} added, {applied.classesChanged} changed;{" "}
          {plural(applied.memberships, "class place", "class places")}.
        </div>
      )}

      {p && (
        <div className="stack" aria-live="polite">
          {p.needsConfirm && <div className="alert alert-warning">{p.needsConfirm}</div>}
          <div className="table-scroll roster-counts" tabIndex={0} role="region" aria-labelledby="oneroster-counts">
            <table>
              <caption id="oneroster-counts" className="sr-only">What the import would change</caption>
              <thead>
                <tr><th scope="col" /><th scope="col">Add</th><th scope="col">Change</th><th scope="col">Switch off</th><th scope="col">Unchanged</th></tr>
              </thead>
              <tbody>
                <tr><th scope="row">People</th><td>{p.people.add}</td><td>{p.people.change}</td><td>{p.people.switchOff}</td><td>{p.people.unchanged}</td></tr>
                <tr><th scope="row">Classes</th><td>{p.classes.add}</td><td>{p.classes.change}</td><td>{p.classes.switchOff}</td><td>{p.classes.unchanged}</td></tr>
              </tbody>
            </table>
          </div>
          <p style={{ margin: 0 }}>
            {plural(p.enrollments, "class place", "class places")}
            {p.skippedRoles > 0 && <> · {plural(p.skippedRoles, "guardian or other role", "guardians or other roles")} not imported</>}
          </p>
          {p.problemCount > 0 && (
            <div className="alert alert-warning">
              <strong>{plural(p.problemCount, "row was", "rows were")} skipped:</strong>
              <ul className="roster-problems">
                {p.problems.map((x, i) => <li key={i}>{x.file} line {x.line}: {x.message}</li>)}
              </ul>
              {p.problemCount > p.problems.length && <p style={{ margin: 0 }}>and {p.problemCount - p.problems.length} more</p>}
            </div>
          )}
          <p className="hint" style={{ margin: 0 }}>This preview lasts 30 minutes. After that, check the file again.</p>
        </div>
      )}

      <div className="row">
        <button type="button" className="btn btn-light" disabled={busy !== null || !file} onClick={check}>
          {busy === "preview" ? "Checking…" : "Check the file"}
        </button>
        <button type="button" className="btn btn-primary" disabled={busy !== null || !p} onClick={() => apply(false)}>
          {busy === "apply" ? "Applying…" : "Apply"}
        </button>
      </div>
    </section>
  );
}

/** Students' first logins, shown once: print them, or download them as a CSV file. */
function LoginCards({ logins, schoolLink, onClose }: { logins: Login[]; schoolLink: string; onClose: () => void }) {
  const csv = "name,username,first password,invite link,sign in at\n"
    + logins.map((l) => [l.name, l.username, l.password ?? "", l.link ?? "", schoolLink].map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n") + "\n";
  const links = logins.some((l) => l.link);
  return (
    <section className="card stack login-cards" aria-labelledby="logins-title">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 id="logins-title" style={{ margin: 0 }}>{logins.length === 1 ? "How they get in" : `How ${logins.length} students get in`}</h2>
        <button type="button" className="btn btn-light" onClick={onClose}>Done</button>
      </div>
      <div className="alert alert-warning">
        {links
          ? "These links are shown only now. Give each student theirs (print the cards, or share the link): it works once, for 7 days, and lets them choose their own password."
          : "These first passwords are shown only now. Give each student theirs; they choose their own at their first sign-in."}
      </div>
      <div className="login-card-grid">
        {logins.slice(0, 60).map((l) => (
          <div className="login-card" key={l.username}>
            <strong>{l.name}</strong>
            <span>Username: <code>{l.username}</code></span>
            {l.password && <span>First password: <code>{l.password}</code></span>}
            {l.link && <LinkQr url={l.link} label={"QR code: " + l.name + "'s invite link"} size={112} />}
            {l.link && <span className="hint" style={{ overflowWrap: "anywhere" }}>{l.link}</span>}
            <span className="muted">{schoolLink}</span>
            {l.link && l.userId && <EmailLink userId={l.userId} link={l.link} name={l.name} />}
          </div>
        ))}
      </div>
      {logins.length > 60 && <p className="muted">Showing 60 of {logins.length}. Download the file for all of them.</p>}
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={() => download(links ? "student-links.csv" : "first-logins.csv", csv)}>Download as CSV</button>
        <button type="button" className="btn btn-light" onClick={() => window.print()}>Print</button>
      </div>
    </section>
  );
}

/**
 * Emails one student's link to the adult who passes it on (a parent, or the school office). The server sends it only
 * while it is still this student's current, unused link.
 */
function EmailLink({ userId, link, name }: { userId: string; link: string; name: string }) {
  const id = useId();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await api<{ message: string }>(`/api/v1/admin/people/${userId}/invite-link/email`, {
        method: "POST", body: { link, to },
      });
      setDone(r.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Quizplayo could not email the link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack email-link" onSubmit={send} style={{ gap: 6 }}>
      <label htmlFor={id + "-to"}>Email {name}&apos;s link to</label>
      <span id={id + "-hint"} className="hint">A parent or the school office, who passes it on.</span>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <input id={id + "-to"} type="email" required autoComplete="off" value={to} maxLength={254}
          onChange={(e) => setTo(e.target.value)} aria-describedby={id + "-hint"} style={{ flex: "1 1 12rem", minWidth: 0 }} />
        <button type="submit" className="btn btn-light" disabled={busy || to.trim() === ""}>{busy ? "Sending…" : "Email it"}</button>
      </div>
      {done && <span className="hint" role="status">{done}</span>}
      {error && <span className="alert alert-danger" role="alert">{error}</span>}
    </form>
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

/**
 * Staff who haven't accepted their invitation yet: send it again (a new link), copy a new link to share yourself, or
 * withdraw it. Addresses are masked: only the Quizplayo team sees another person's full address.
 */
function Invitations({ changed, onChanged }: { changed: number; onChanged: () => void }) {
  const [list, setList] = useState<Invitation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [shared, setShared] = useState<{ name: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<Invitation[]>("/api/v1/admin/invitations").then(setList)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load the invitations."));
  }, [changed]);

  async function act(i: Invitation, action: "resend" | "revoke") {
    if (action === "revoke" && !window.confirm(`Withdraw ${i.name}'s invitation? The link in their email stops working.`)) return;
    setError(null);
    setNotice(null);
    setShared(null);
    try {
      const r = await api<{ message?: string } | undefined>(`/api/v1/admin/invitations/${i.id}/${action}`, { method: "POST" });
      setNotice(action === "resend" ? `${i.name}: ${r?.message ?? "sent again, with a new link."}` : `${i.name}'s invitation was withdrawn.`);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not do that. Please try again.");
    }
  }

  async function newLink(i: Invitation) {
    if (!window.confirm(`Make a new link for ${i.name}? Any link sent before stops working.`)) return;
    setError(null);
    setNotice(null);
    setCopied(false);
    try {
      const r = await api<{ link: string; message: string }>(`/api/v1/admin/invitations/${i.id}/link`, { method: "POST" });
      setShared({ name: i.name, link: r.link });
      setNotice(r.message);
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not do that. Please try again.");
    }
  }

  if (!list || (list.length === 0 && !notice && !error)) return null;
  return (
    <section className="card stack" aria-labelledby="invitations">
      <h2 id="invitations" style={{ margin: 0 }}>Invitations not accepted yet</h2>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {shared && (
        <div className="field">
          <label htmlFor="invite-link">Invitation link for {shared.name}</label>
          <div className="row" style={{ gap: 8 }}>
            <input id="invite-link" type="text" readOnly value={shared.link} onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-primary" onClick={async () => {
              try { await navigator.clipboard.writeText(shared.link); setCopied(true); } catch { setCopied(false); }
            }}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <p className="hint" aria-live="polite" style={{ margin: 0 }}>
            {copied ? "Copied. Send it to them by chat or email." : "Send it only to them: whoever opens it can join as them."}
          </p>
        </div>
      )}
      {list.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Sent</th><th /></tr></thead>
            <tbody>
              {list.map((i) => (
                <tr key={i.id}>
                  <td><strong>{i.name}</strong></td>
                  <td>{i.email}</td>
                  <td>{ROLE_WORDS[i.role] ?? i.role}</td>
                  <td>
                    {new Date(i.sentAt).toLocaleDateString()}
                    {i.expired && <> <span className="chip chip-warn">Expired</span></>}
                  </td>
                  <td className="row" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-light" onClick={() => act(i, "resend")}>Send again</button>
                    <button type="button" className="btn btn-light" onClick={() => newLink(i)}>Copy a new link</button>
                    <button type="button" className="btn btn-light" onClick={() => act(i, "revoke")}>Withdraw</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Teachers on the school's email domain who asked to join: accept (as a teacher or admin) or decline. */
function JoinRequests({ changed, onDecided }: { changed: number; onDecided: () => void }) {
  const me = useMe();
  const [list, setList] = useState<JoinRequest[] | null>(null);
  const [roles, setRoles] = useState<Record<string, Role>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api<JoinRequest[]>("/api/v1/admin/join-requests").then(setList)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load the requests."));
  }, [changed]);

  async function decide(r: JoinRequest, approve: boolean) {
    setError(null);
    setNotice(null);
    try {
      await api(`/api/v1/admin/join-requests/${r.id}/${approve ? "approve" : "decline"}`, {
        method: "POST", body: approve ? { role: roles[r.id] ?? "TEACHER" } : undefined,
      });
      setNotice(approve
        ? (me.mailOn ? `${r.name} joined your school and was emailed.` : `${r.name} joined your school. They'll see it in Communication when they sign in.`)
        : `${r.name}'s request was declined.`);
      onDecided();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not do that. Please try again.");
    }
  }

  if (!list || (list.length === 0 && !notice && !error)) return null;
  return (
    <section className="card stack" aria-labelledby="join-requests">
      <h2 id="join-requests" style={{ margin: 0 }}>Asking to join</h2>
      <p className="muted" style={{ margin: 0 }}>Teachers with a confirmed email on your school&apos;s domain.</p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      {list.length > 0 && (
        <ul className="workspace-list">
          {list.map((r) => (
            <li key={r.id}>
              <div>
                <strong>{r.name}</strong> <span className="muted">· {r.email} · {new Date(r.createdAt).toLocaleDateString()}</span>
                {r.message && <p style={{ margin: "4px 0 0" }}>&ldquo;{r.message}&rdquo;</p>}
              </div>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <select aria-label={`Role for ${r.name}`} value={roles[r.id] ?? "TEACHER"}
                        onChange={(e) => setRoles({ ...roles, [r.id]: e.target.value as Role })}>
                  <option value="TEACHER">Teacher</option>
                  <option value="SCHOOL_ADMIN">School admin</option>
                </select>
                <button type="button" className="btn btn-primary" onClick={() => decide(r, true)}>Accept</button>
                <button type="button" className="btn btn-light" onClick={() => decide(r, false)}>Decline</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
