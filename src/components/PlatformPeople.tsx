"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import { schoolStatus } from "@/lib/school";
import {
  accountStatus, actionLabel, changeLines, gradeLabel, guardText, newEmailProblem, reasonCategoryLabel, reasonProblem,
  peoplePlace, peopleSearch, roleLabel, usernameProblem, REASON_CATEGORIES, REASON_MAX, STAFF_ROLES,
  type ClassOption, type Done, type FoundMember, type FoundPerson, type Member, type MemberDone, type Person,
  type PersonChange,
} from "@/lib/platformPeople";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { LinkQr } from "@/components/LinkQr";

interface Feedback {
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}

function message(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

function when(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never";
}

function Chip({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={tone === "plain" ? "chip" : "chip chip-" + tone}>{children}</span>;
}

type View =
  | { kind: "search" }
  | { kind: "account"; accountId: string }
  | { kind: "member"; tenantId: string; userId: string; from: View };

/**
 * Platform console → People (platform-people-plan.md, steps 1 and 2): find a teacher or admin's account across every
 * workspace, or anyone (students too, decision D4) inside one workspace, then change them. Every change asks why and
 * shows before → after before it is made. Searches are sent in the request body, so emails never appear in addresses.
 */
export function PlatformPeople({ onError, onNotice }: Feedback) {
  const [view, setView] = useState<View>({ kind: "search" });
  const go = useCallback((v: View) => {
    onError(null);
    onNotice(null);
    setView(v);
    // Each page has its own address (ids only), so Back works and a person's page can be bookmarked.
    const search = peopleSearch(v);
    if (window.location.search !== search) window.history.pushState(null, "", window.location.pathname + search);
  }, [onError, onNotice]);

  useEffect(() => {
    const open = () => {
      const place = peoplePlace(window.location.search);
      setView(place.kind === "member" ? { ...place, from: { kind: "search" } } : place);
    };
    open();
    window.addEventListener("popstate", open);
    return () => window.removeEventListener("popstate", open);
  }, []);

  if (view.kind === "account") {
    return <AccountView accountId={view.accountId} onBack={() => go({ kind: "search" })}
                        onOpenMember={(tenantId, userId) => go({ kind: "member", tenantId, userId, from: view })}
                        onError={onError} onNotice={onNotice} />;
  }
  if (view.kind === "member") {
    return <MemberView tenantId={view.tenantId} userId={view.userId} onBack={() => go(view.from)}
                       onOpenAccount={(accountId) => go({ kind: "account", accountId })}
                       onError={onError} onNotice={onNotice} />;
  }
  return <Search onOpenAccount={(accountId) => go({ kind: "account", accountId })}
                 onOpenMember={(tenantId, userId) => go({ kind: "member", tenantId, userId, from: { kind: "search" } })}
                 onError={onError} onNotice={onNotice} />;
}

// ---- Search ----

function Search({ onOpenAccount, onOpenMember, onError, onNotice }: {
  onOpenAccount: (accountId: string) => void;
  onOpenMember: (tenantId: string, userId: string) => void;
} & Feedback) {
  const [mode, setMode] = useState<"accounts" | "workspace">("accounts");
  return (
    <section className="stack" aria-labelledby="people-title">
      <h2 id="people-title" style={{ margin: 0 }}>People</h2>
      <p className="muted" style={{ margin: 0 }}>
        Find a teacher or school admin by their sign-in email or name in any school, or anyone — students too — inside
        one workspace. Every change you make asks why and is kept in the audit log.
      </p>
      <div className="segmented" role="tablist" aria-label="Find" style={{ gridTemplateColumns: "repeat(2, auto)", alignSelf: "start" }}>
        {([["accounts", "Accounts in any school"], ["workspace", "Everyone in one workspace"]] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={mode === k} className={mode === k ? "on" : ""}
                  onClick={() => { setMode(k); onError(null); onNotice(null); }}>{label}</button>
        ))}
      </div>
      {mode === "accounts"
        ? <AccountSearch onOpen={onOpenAccount} onError={onError} onNotice={onNotice} />
        : <WorkspaceSearch onOpen={onOpenMember} onError={onError} onNotice={onNotice} />}
    </section>
  );
}

function AccountSearch({ onOpen, onError, onNotice }: { onOpen: (accountId: string) => void } & Feedback) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundPerson[] | null>(null);
  const [searching, setSearching] = useState(false);
  const captionId = useId();

  async function search(e: FormEvent) {
    e.preventDefault();
    onError(null);
    onNotice(null);
    setSearching(true);
    try {
      setResults(await api<FoundPerson[]>("/api/v1/platform/people/search", { method: "POST", body: { query: query.trim() } }));
    } catch (err) {
      onError(message(err, "The search did not work. Please try again."));
    }
    setSearching(false);
  }

  return (
    <>
      <form role="search" className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }} onSubmit={search}>
        <div className="field" style={{ flex: "1 1 260px", margin: 0 }}>
          <label htmlFor="people-query">Email or name</label>
          <input id="people-query" type="search" value={query} minLength={3} maxLength={254} required
                 autoComplete="off" spellCheck={false} onChange={(e) => setQuery(e.target.value)}
                 aria-describedby="people-query-hint" />
          <div id="people-query-hint" className="hint">At least 3 letters. Students aren&apos;t here: find them inside their workspace.</div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={searching || query.trim().length < 3}>
          {searching ? "Searching…" : "Search"}
        </button>
      </form>
      {searching && <LoadingState rows={3} label="Searching" />}
      {!searching && results && results.length === 0 && (
        <EmptyState title="Nobody found">No account&apos;s email or name contains that. Check the spelling, or try part of the email.</EmptyState>
      )}
      {!searching && results && results.length > 0 && (
        <div className="table-scroll" role="region" aria-labelledby={captionId} tabIndex={0}>
          <table>
            <caption id={captionId} className="sr-only">Accounts found</caption>
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Sign-in email</th><th scope="col">Status</th><th scope="col">Workspaces</th><th scope="col"><span className="sr-only">Open</span></th></tr>
            </thead>
            <tbody>
              {results.map((p) => {
                const st = accountStatus(p.status);
                return (
                  <tr key={p.accountId}>
                    <th scope="row">{p.name}</th>
                    <td style={{ overflowWrap: "anywhere" }}>{p.email}{!p.emailConfirmed && <span className="hint"> (not confirmed)</span>}</td>
                    <td><Chip tone={st.tone}>{st.label}</Chip></td>
                    <td>{p.workspaces}</td>
                    <td><button type="button" className="btn btn-light" onClick={() => onOpen(p.accountId)}>Open<span className="sr-only"> {p.name}</span></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

interface WorkspaceOption {
  id: string;
  name: string;
  kind: "SCHOOL" | "INDEPENDENT";
  status: string;
  schoolCode: string | null;
}

function WorkspaceSearch({ onOpen, onError, onNotice }: { onOpen: (tenantId: string, userId: string) => void } & Feedback) {
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[] | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceOption | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundMember[] | null>(null);
  const [searching, setSearching] = useState(false);
  const captionId = useId();

  useEffect(() => {
    if (workspace || workspaceQuery.trim().length < 2) { setWorkspaces(null); return; }
    const t = setTimeout(() => {
      api<WorkspaceOption[]>("/api/v1/platform/workspaces?q=" + encodeURIComponent(workspaceQuery.trim()))
        .then((list) => setWorkspaces(list.slice(0, 20)))
        .catch((e: unknown) => onError(message(e, "The workspaces could not be loaded.")));
    }, 250);
    return () => clearTimeout(t);
  }, [workspaceQuery, workspace, onError]);

  async function search(e: FormEvent) {
    e.preventDefault();
    if (!workspace) return;
    onError(null);
    onNotice(null);
    setSearching(true);
    try {
      setResults(await api<FoundMember[]>(`/api/v1/platform/people/workspaces/${encodeURIComponent(workspace.id)}/search`,
        { method: "POST", body: { query: query.trim() } }));
    } catch (err) {
      onError(message(err, "The search did not work. Please try again."));
    }
    setSearching(false);
  }

  if (!workspace) {
    return (
      <div className="stack">
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="workspace-query">Workspace</label>
          <input id="workspace-query" type="search" value={workspaceQuery} autoComplete="off"
                 onChange={(e) => setWorkspaceQuery(e.target.value)} aria-describedby="workspace-query-hint" />
          <div id="workspace-query-hint" className="hint">Type part of the school&apos;s name, its code, or its owner&apos;s email.</div>
        </div>
        {workspaces && workspaces.length === 0 && <p className="muted" style={{ margin: 0 }}>No workspace matches.</p>}
        {workspaces && workspaces.length > 0 && (
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {workspaces.map((w) => (
              <li key={w.id}>
                <button type="button" className="btn btn-light" style={{ width: "100%", textAlign: "start" }}
                        onClick={() => { setWorkspace(w); setResults(null); }}>
                  {w.name} <span className="hint">· {w.kind === "SCHOOL" ? "School" : "Teacher's own"}{w.schoolCode ? " · " + w.schoolCode : ""} · {schoolStatus(w.status).label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <strong>{workspace.name}</strong>
        <button type="button" className="btn btn-light" onClick={() => { setWorkspace(null); setResults(null); setQuery(""); }}>Choose another workspace</button>
      </div>
      <form role="search" className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }} onSubmit={search}>
        <div className="field" style={{ flex: "1 1 260px", margin: 0 }}>
          <label htmlFor="member-query">Name, username or staff email</label>
          <input id="member-query" type="search" value={query} minLength={2} maxLength={254} required
                 autoComplete="off" spellCheck={false} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={searching || query.trim().length < 2}>
          {searching ? "Searching…" : "Search"}
        </button>
      </form>
      {searching && <LoadingState rows={3} label="Searching" />}
      {!searching && results && results.length === 0 && <EmptyState title="Nobody found">Nobody in this workspace matches that.</EmptyState>}
      {!searching && results && results.length > 0 && (
        <div className="table-scroll" role="region" aria-labelledby={captionId} tabIndex={0}>
          <table>
            <caption id={captionId} className="sr-only">People in {workspace.name}</caption>
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Signs in with</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Open</span></th></tr>
            </thead>
            <tbody>
              {results.map((m) => {
                const st = accountStatus(m.status);
                return (
                  <tr key={m.userId}>
                    <th scope="row">{m.name}{m.grade != null && <span className="hint"> · {gradeLabel(m.grade)}</span>}</th>
                    <td>{roleLabel(m.role)}</td>
                    <td style={{ overflowWrap: "anywhere" }}>{m.email ?? m.username ?? <span className="muted">School&apos;s system</span>}</td>
                    <td><Chip tone={st.tone}>{st.label}</Chip></td>
                    <td><button type="button" className="btn btn-light" onClick={() => onOpen(workspace.id, m.userId)}>Open<span className="sr-only"> {m.name}</span></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- One account ----

type AccountKind = "email" | "name" | "switch-off" | "switch-on" | "archive" | "restore" | "password" | "sign-out";

function AccountView({ accountId, onBack, onOpenMember, onError, onNotice }: {
  accountId: string;
  onBack: () => void;
  onOpenMember: (tenantId: string, userId: string) => void;
} & Feedback) {
  const [person, setPerson] = useState<Person | null>(null);
  const [dialog, setDialog] = useState<AccountKind | null>(null);
  const [declining, setDeclining] = useState<{ id: string; workspace: string } | null>(null);
  const workspacesId = useId();
  const pendingId = useId();

  const load = useCallback(async () => {
    try {
      setPerson(await api<Person>("/api/v1/platform/people/accounts/" + encodeURIComponent(accountId)));
    } catch (e) {
      onError(message(e, "This person could not be loaded."));
    }
  }, [accountId, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const back = <p style={{ margin: 0 }}><button type="button" className="btn btn-light" onClick={onBack}>← Back to the search</button></p>;
  if (!person) return <div className="stack">{back}<LoadingState rows={4} label="Loading the person" /></div>;

  const st = accountStatus(person.status);
  const archived = person.status === "ARCHIVED";
  const done = (d: Done) => { setPerson(d.person); onError(null); onNotice(d.message); };
  return (
    <section className="stack" aria-labelledby="person-name">
      {back}
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h2 id="person-name" style={{ margin: 0 }}>{person.name}</h2>
            <div style={{ overflowWrap: "anywhere" }}>{person.email}</div>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <Chip tone={st.tone}>{st.label}</Chip>
            <Chip tone={person.emailConfirmed ? "ok" : "warn"}>{person.emailConfirmed ? "Email confirmed" : "Email not confirmed"}</Chip>
            <Chip tone="plain">{person.hasPassword ? "Has a password" : "Email code only"}</Chip>
          </div>
        </div>
        {person.onPlatformList && <div className="alert alert-warning">This email is also on the platform team list.</div>}
        <div className="hint">Account since {when(person.createdAt)}{archived && person.archivedAt ? " · archived " + when(person.archivedAt) : ""}</div>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {!archived && <button type="button" className="btn btn-primary" onClick={() => setDialog("email")}>Change sign-in email</button>}
          {!archived && <button type="button" className="btn btn-light" onClick={() => setDialog("name")}>Change name</button>}
          {person.status === "ACTIVE" && <button type="button" className="btn btn-light" onClick={() => setDialog("switch-off")}>Switch off</button>}
          {person.status === "DISABLED" && <button type="button" className="btn btn-light" onClick={() => setDialog("switch-on")}>Switch on</button>}
          {!archived && person.hasPassword && <button type="button" className="btn btn-light" onClick={() => setDialog("password")}>Remove password</button>}
          {!archived && <button type="button" className="btn btn-light" onClick={() => setDialog("sign-out")}>Sign out everywhere</button>}
          {archived
            ? <button type="button" className="btn btn-primary" onClick={() => setDialog("restore")}>Restore</button>
            : <button type="button" className="btn btn-danger" onClick={() => setDialog("archive")}>Archive</button>}
        </div>
      </div>

      <h3 id={workspacesId} style={{ margin: 0 }}>Workspaces</h3>
      {person.workspaces.length === 0
        ? <EmptyState title="No workspace">This account doesn&apos;t belong to any school or workspace.</EmptyState>
        : (
          <div className="table-scroll" role="region" aria-labelledby={workspacesId} tabIndex={0}>
            <table>
              <thead>
                <tr><th scope="col">Workspace</th><th scope="col">Name there</th><th scope="col">Role</th><th scope="col">Status there</th><th scope="col">Last sign-in</th><th scope="col"><span className="sr-only">Open</span></th></tr>
              </thead>
              <tbody>
                {person.workspaces.map((w) => {
                  const ws = schoolStatus(w.workspaceStatus);
                  return (
                    <tr key={w.userId}>
                      <th scope="row">
                        {w.workspaceName}
                        {w.workspaceStatus !== "ACTIVE" && <> <Chip tone={ws.tone}>{ws.label}</Chip></>}
                        {w.kind === "INDEPENDENT" && <div className="hint">A teacher&apos;s own workspace</div>}
                        {w.linked && <div className="hint">Linked to the school&apos;s own system: its next sync may change this person here.</div>}
                      </th>
                      <td>{w.name}</td>
                      <td>{roleLabel(w.role)}</td>
                      <td>{accountStatus(w.status).label}</td>
                      <td>{when(w.lastSignInAt)}</td>
                      <td><button type="button" className="btn btn-light" onClick={() => onOpenMember(w.tenantId, w.userId)}>Open<span className="sr-only"> {w.workspaceName}</span></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {person.pending.length > 0 && (
        <>
          <h3 id={pendingId} style={{ margin: 0 }}>Waiting</h3>
          <ul className="stack" aria-labelledby={pendingId} style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {person.pending.map((p) => (
              <li key={p.kind + p.id} className="card row" style={{ padding: 12, justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{p.kind === "INVITATION" ? "Invited to " : "Asks to join "}{p.workspaceName}</strong>
                  <div className="hint">
                    {p.kind === "INVITATION"
                      ? `${roleLabel(p.role ?? "")} · sent ${when(p.createdAt)}${p.expired ? " · expired" : ""}`
                      : `Asked ${when(p.createdAt)}${p.message ? " · “" + p.message + "”" : ""}`}
                  </div>
                </div>
                {p.kind === "INVITATION" && p.userId
                  ? <button type="button" className="btn btn-light" onClick={() => onOpenMember(p.tenantId, p.userId!)}>Open the invitation</button>
                  : <button type="button" className="btn btn-light" onClick={() => setDeclining({ id: p.id, workspace: p.workspaceName })}>Decline</button>}
              </li>
            ))}
          </ul>
        </>
      )}

      <History changes={person.changes} />

      {dialog && <AccountDialog kind={dialog} person={person} onClose={() => setDialog(null)} onDone={done} />}
      {declining && (
        <ReasonDialog title={"Decline the request to join " + declining.workspace} subtitle={person.name + " · " + person.email}
                      effects={["The school no longer sees this request. Approving stays the school's decision."]}
                      confirmLabel="Decline the request" danger onClose={() => setDeclining(null)}
                      submit={async (why) => done(await api<Done>(
                        `/api/v1/platform/people/accounts/${encodeURIComponent(person.accountId)}/join-requests/${encodeURIComponent(declining.id)}/decline`,
                        { method: "POST", body: why }))} />
      )}
    </section>
  );
}

const ACCOUNT_TITLES: Record<AccountKind, string> = {
  email: "Change the sign-in email",
  name: "Change the name",
  "switch-off": "Switch off this account",
  "switch-on": "Switch this account back on",
  archive: "Archive this account",
  restore: "Restore this account",
  password: "Remove the password",
  "sign-out": "Sign out everywhere",
};

function AccountDialog({ kind, person, onClose, onDone }: {
  kind: AccountKind;
  person: Person;
  onClose: () => void;
  onDone: (done: Done) => void;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [name, setName] = useState(person.name);
  const linked = person.workspaces.some((w) => w.linked);
  const lines: string[] = [];
  const effects: string[] = [];
  let fields: ReactNode = null;
  let validate: () => string | null = () => null;
  switch (kind) {
    case "email":
      fields = <EmailFields id={id} email={email} confirm={confirmEmail} onEmail={setEmail} onConfirm={setConfirmEmail} label="New sign-in email" />;
      validate = () => newEmailProblem(person.email, email, confirmEmail);
      lines.push(`Sign-in email: ${person.email} → ${email.trim().toLowerCase()}`);
      effects.push("They are signed out at their next click and sign in with the new address.");
      effects.push("Both the old and the new address are told. Where emails are switched off, both notices are only stored.");
      effects.push("The new address counts as not confirmed until they sign in with an emailed code.");
      if (linked) effects.push("Some of their workspaces are linked to a school's own system: ask the school to change the email there too, or its next sync may put the old one back in that workspace.");
      break;
    case "name":
      fields = <NameField id={id} value={name} onChange={setName} />;
      validate = () => nameProblem(name, person.name);
      lines.push(`Account name: ${person.name} → ${tidy(name)}`);
      effects.push("Only the account's name changes. Each workspace keeps the name it has for them.");
      break;
    case "switch-off":
      lines.push("Status: Active → Switched off");
      effects.push("They are signed out at their next click and can't sign in to any workspace until switched back on.");
      break;
    case "switch-on":
      lines.push("Status: Switched off → Active");
      effects.push("They can sign in again.");
      break;
    case "archive":
      lines.push(`Status: ${accountStatus(person.status).label} → Archived`);
      effects.push("They are signed out at their next click and can't sign in.");
      effects.push("Each of their workspaces archives them too; restoring the account brings those back.");
      effects.push("Nothing is deleted: their games, quizzes and results stay. Their email stays taken while archived.");
      break;
    case "restore":
      lines.push("Status: Archived → as it was before");
      effects.push("They can sign in again, unless the account was switched off before it was archived. Their workspaces come back too.");
      break;
    case "password":
      lines.push("Password: Set → None");
      effects.push("They are signed out and from now on sign in with a code emailed to them. They can choose a new password after signing in.");
      break;
    case "sign-out":
      effects.push("Every open session ends at its next click. Nothing else changes.");
      break;
  }
  const base = "/api/v1/platform/people/accounts/" + encodeURIComponent(person.accountId);
  return (
    <ReasonDialog title={ACCOUNT_TITLES[kind]} subtitle={person.name + " · " + person.email} fields={fields}
                  validate={validate} lines={lines} effects={effects}
                  danger={kind === "archive" || kind === "switch-off" || kind === "password"}
                  onClose={onClose}
                  submit={async (why) => {
                    switch (kind) {
                      case "email":
                        return onDone(await api<Done>(base + "/email", { method: "POST", body: { newEmail: email.trim(), confirmEmail: confirmEmail.trim(), ...why } }));
                      case "name":
                        return onDone(await api<Done>(base, { method: "PATCH", body: { name: name.trim(), ...why } }));
                      case "switch-off":
                      case "switch-on":
                        return onDone(await api<Done>(base, { method: "PATCH", body: { status: kind === "switch-off" ? "DISABLED" : "ACTIVE", ...why } }));
                      case "password":
                        return onDone(await api<Done>(base, { method: "PATCH", body: { removePassword: true, ...why } }));
                      default:
                        return onDone(await api<Done>(base + "/" + kind, { method: "POST", body: why }));
                    }
                  }} />
  );
}

// ---- One person in one workspace ----

type MemberKind = "name" | "role" | "switch-off" | "switch-on" | "grade" | "username" | "classes" | "archive" | "restore"
  | "unlink" | "invite" | "invite-email" | "invite-withdraw" | "student-link";

function MemberView({ tenantId, userId, onBack, onOpenAccount, onError, onNotice }: {
  tenantId: string;
  userId: string;
  onBack: () => void;
  onOpenAccount: (accountId: string) => void;
} & Feedback) {
  const [member, setMember] = useState<Member | null>(null);
  const [dialog, setDialog] = useState<MemberKind | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setMember(await api<Member>(`/api/v1/platform/people/workspaces/${encodeURIComponent(tenantId)}/members/${encodeURIComponent(userId)}`));
    } catch (e) {
      onError(message(e, "This person could not be loaded."));
    }
  }, [tenantId, userId, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const back = <p style={{ margin: 0 }}><button type="button" className="btn btn-light" onClick={onBack}>← Back</button></p>;
  if (!member) return <div className="stack">{back}<LoadingState rows={4} label="Loading the person" /></div>;

  const st = accountStatus(member.status);
  const archived = member.status === "ARCHIVED";
  const closed = member.workspaceStatus === "CLOSED";
  const staff = (STAFF_ROLES as readonly string[]).includes(member.role);
  const student = member.role === "STUDENT";
  const guard = guardText(member.guard);
  const done = (d: MemberDone) => { setMember(d.member); setLink(d.link); setCopied(false); onError(null); onNotice(d.message); };

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      onError("Your browser didn't allow copying. Select the link and copy it yourself.");
    }
  }

  return (
    <section className="stack" aria-labelledby="member-name">
      {back}
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <h2 id="member-name" style={{ margin: 0 }}>{member.name}</h2>
            <div>{roleLabel(member.role)} at <strong>{member.workspaceName}</strong>{member.kind === "INDEPENDENT" ? " (a teacher's own workspace)" : ""}</div>
            <div className="hint" style={{ overflowWrap: "anywhere" }}>
              {student ? "Username: " + (member.username ?? "—") + " · " + gradeLabel(member.grade) : member.email ?? "No email"}
            </div>
          </div>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <Chip tone={st.tone}>{st.label}</Chip>
            {closed && <Chip tone="plain">Workspace closed</Chip>}
            {member.linked && <Chip tone="warn">Linked to the school&apos;s system</Chip>}
          </div>
        </div>
        {member.linked && <div className="hint">The school&apos;s own system also keeps this person: its next sync may change their name, role, grade or email here. Ask the school to change it there too.</div>}
        {guard && <div className="hint">{guard}</div>}
        {closed && <div className="alert alert-warning">This workspace is closed, so its people can&apos;t be changed. Restore it from Schools and teachers first.</div>}
        <div className="hint">On Quizplayo since {when(member.firstSeenAt)} · last sign-in {when(member.lastSignInAt)}{archived && member.archivedAt ? " · archived " + when(member.archivedAt) : ""}</div>
        {member.accountId && (
          <p style={{ margin: 0 }}><button type="button" className="btn btn-light" onClick={() => onOpenAccount(member.accountId!)}>Open their account</button></p>
        )}
        {!closed && (
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            {!archived && <button type="button" className="btn btn-light" onClick={() => setDialog("name")}>Change name</button>}
            {!archived && staff && <button type="button" className="btn btn-light" onClick={() => setDialog("role")}>Change role</button>}
            {!archived && student && member.username && <button type="button" className="btn btn-primary" onClick={() => setDialog("student-link")}>Invite link…</button>}
            {!archived && student && <button type="button" className="btn btn-light" onClick={() => setDialog("username")}>Change username</button>}
            {!archived && <button type="button" className="btn btn-light" onClick={() => setDialog("grade")}>Change grade</button>}
            {!archived && member.role !== "PARENT" && <button type="button" className="btn btn-light" onClick={() => setDialog("classes")}>Classes</button>}
            {member.status === "ACTIVE" && <button type="button" className="btn btn-light" onClick={() => setDialog("switch-off")}>Switch off here</button>}
            {member.status === "DISABLED" && <button type="button" className="btn btn-light" onClick={() => setDialog("switch-on")}>Switch on here</button>}
            {!archived && member.accountId && <button type="button" className="btn btn-light" onClick={() => setDialog("unlink")}>Remove from this workspace</button>}
            {archived
              ? <button type="button" className="btn btn-primary" onClick={() => setDialog("restore")}>Restore here</button>
              : <button type="button" className="btn btn-danger" onClick={() => setDialog("archive")}>Archive here</button>}
          </div>
        )}
      </div>

      {staff && !member.accountId && !archived && !closed && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Invitation</h3>
          {member.invitation
            ? <p style={{ margin: 0 }}>Sent to <strong style={{ overflowWrap: "anywhere" }}>{member.invitation.email}</strong> {when(member.invitation.sentAt)} · {member.invitation.expired ? "expired" : "works until " + when(member.invitation.expiresAt)}</p>
            : <p style={{ margin: 0 }}>No open invitation: they haven&apos;t joined yet.</p>}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-primary" onClick={() => setDialog("invite")}>{member.invitation ? "Send again" : "Send an invitation"}</button>
            <button type="button" className="btn btn-light" onClick={() => setDialog("invite-email")}>Correct the email</button>
            {member.invitation && <button type="button" className="btn btn-light" onClick={() => setDialog("invite-withdraw")}>Withdraw</button>}
          </div>
          {link && (
            <div className="stack">
              <label htmlFor="invite-link" className="hint">The new invitation link (the old one no longer works)</label>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input id="invite-link" type="text" readOnly value={link} style={{ flex: "1 1 260px" }} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn btn-light" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {student && link && (
        <div className="card stack">
          <h3 style={{ margin: 0 }}>Invite link</h3>
          <p className="hint" style={{ margin: 0 }}>Shown only now. It works once, for 7 days, and lets {member.name} choose their own password. Any earlier link no longer works.</p>
          <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <LinkQr url={link} label={"QR code: " + member.name + "'s invite link"} />
            <div className="row" style={{ gap: 8, flexWrap: "wrap", flex: "1 1 260px" }}>
              <label htmlFor="student-link" className="sr-only">Invite link</label>
              <input id="student-link" type="text" readOnly value={link} style={{ flex: "1 1 220px" }} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn-light" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
            </div>
          </div>
        </div>
      )}

      <h3 style={{ margin: 0 }}>Classes</h3>
      {member.classes.length === 0
        ? <p className="muted" style={{ margin: 0 }}>Not in any class.</p>
        : <p style={{ margin: 0 }}>{member.classes.map((c) => c.code + (c.synced ? " (synced)" : "")).join(", ")}</p>}

      <History changes={member.changes} />

      {dialog && <MemberDialog kind={dialog} member={member} onClose={() => setDialog(null)} onDone={done} />}
    </section>
  );
}

const MEMBER_TITLES: Record<MemberKind, string> = {
  name: "Change the name here",
  role: "Change the role",
  "switch-off": "Switch off in this workspace",
  "switch-on": "Switch on in this workspace",
  grade: "Change the grade",
  username: "Change the username",
  classes: "Change classes",
  archive: "Archive in this workspace",
  restore: "Restore in this workspace",
  unlink: "Remove from this workspace",
  invite: "Send the invitation",
  "invite-email": "Correct the invited email",
  "invite-withdraw": "Withdraw the invitation",
  "student-link": "Make an invite link",
};

function MemberDialog({ kind, member, onClose, onDone }: {
  kind: MemberKind;
  member: Member;
  onClose: () => void;
  onDone: (done: MemberDone) => void;
}) {
  const id = useId();
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role);
  const [grade, setGrade] = useState(member.grade == null ? "" : String(member.grade));
  const [username, setUsername] = useState(member.username ?? "");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [options, setOptions] = useState<ClassOption[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(member.classes.map((c) => c.id)));
  const [emailTo, setEmailTo] = useState("");
  const [suggestions, setSuggestions] = useState<{ name: string; email: string }[]>([]);

  useEffect(() => {
    if (kind !== "student-link") return;
    api<{ name: string; email: string }[]>(`/api/v1/platform/people/workspaces/${encodeURIComponent(member.tenantId)}/admin-emails`)
      .then(setSuggestions).catch(() => setSuggestions([]));
  }, [kind, member.tenantId]);

  useEffect(() => {
    if (kind !== "classes") return;
    api<ClassOption[]>(`/api/v1/platform/people/workspaces/${encodeURIComponent(member.tenantId)}/classes`)
      .then(setOptions).catch(() => setOptions([]));
  }, [kind, member.tenantId]);

  const before = new Set(member.classes.map((c) => c.id));
  const add = [...selected].filter((c) => !before.has(c));
  const remove = [...before].filter((c) => !selected.has(c));
  const code = (cid: string) => options?.find((o) => o.id === cid)?.code ?? member.classes.find((c) => c.id === cid)?.code ?? cid;

  const lines: string[] = [];
  const effects: string[] = [];
  let fields: ReactNode = null;
  let validate: () => string | null = () => null;
  let body: Record<string, unknown> | null = null;
  let path = "";
  let method = "PATCH";
  switch (kind) {
    case "name":
      fields = <NameField id={id} value={name} onChange={setName} />;
      validate = () => nameProblem(name, member.name);
      lines.push(`Name here: ${member.name} → ${tidy(name)}`);
      effects.push("Only this workspace's name for them changes.");
      if (member.linked) effects.push("The school's own system may change the name back at its next sync.");
      body = { name: name.trim() };
      break;
    case "role":
      fields = (
        <div className="field">
          <label htmlFor={id + "-role"}>Role</label>
          <select id={id + "-role"} value={role} autoFocus onChange={(e) => setRole(e.target.value)}>
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
          </select>
        </div>
      );
      validate = () => role === member.role ? "That is already their role." : null;
      lines.push(`Role: ${roleLabel(member.role)} → ${roleLabel(role)}`);
      effects.push("They are signed out of this workspace at their next click, so the new role applies.");
      if (member.linked) effects.push("The school's own system may change the role back at its next sync.");
      body = { role };
      break;
    case "switch-off":
    case "switch-on":
      lines.push(kind === "switch-off" ? "Status here: Active → Switched off" : "Status here: Switched off → Active");
      effects.push(kind === "switch-off" ? "They are signed out of this workspace at their next click and can't sign in to it." : "They can sign in to this workspace again.");
      body = { status: kind === "switch-off" ? "DISABLED" : "ACTIVE" };
      break;
    case "grade":
      fields = (
        <div className="field">
          <label htmlFor={id + "-grade"}>Grade</label>
          <select id={id + "-grade"} value={grade} autoFocus onChange={(e) => setGrade(e.target.value)}>
            <option value="">Choose…</option>
            {Array.from({ length: 13 }, (_, g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}
          </select>
        </div>
      );
      validate = () => grade === "" ? "Choose a grade." : Number(grade) === member.grade ? "That is already their grade." : null;
      lines.push(`Grade: ${gradeLabel(member.grade)} → ${grade === "" ? "—" : gradeLabel(Number(grade))}`);
      if (member.linked) effects.push("The school's own system may change the grade back at its next sync.");
      else effects.push("Games and quizzes for their grade follow from the next time they open Quizplayo.");
      body = { grade: grade === "" ? null : Number(grade) };
      break;
    case "username":
      fields = (
        <div className="field">
          <label htmlFor={id + "-username"}>Username</label>
          <input id={id + "-username"} type="text" autoComplete="off" spellCheck={false} maxLength={40} autoFocus
                 value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
      );
      validate = () => usernameProblem(username) ?? (username.trim().toLowerCase() === member.username ? "That is already their username." : null);
      lines.push(`Username: ${member.username ?? "—"} → ${username.trim().toLowerCase()}`);
      effects.push("They are signed out at their next click and sign in with the new username. Their password stays the same.");
      body = { username: username.trim() };
      break;
    case "classes":
      fields = options === null ? <LoadingState rows={2} label="Loading classes" /> : options.length === 0
        ? <p className="muted">This workspace has no classes yet.</p>
        : (
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, maxBlockSize: 260, overflow: "auto" }}>
            <legend className="sr-only">Classes</legend>
            {options.map((o, i) => (
              <label key={o.id} className="row" style={{ gap: 8 }}>
                <input type="checkbox" autoFocus={i === 0} checked={selected.has(o.id)}
                       onChange={(e) => setSelected((cur) => { const next = new Set(cur); if (e.target.checked) next.add(o.id); else next.delete(o.id); return next; })} />
                {o.code} <span className="hint">{o.name}{o.synced ? " · synced from the school's system" : ""}</span>
              </label>
            ))}
          </fieldset>
        );
      validate = () => add.length + remove.length === 0 ? "Tick or untick at least one class." : null;
      if (add.length) lines.push("Added to: " + add.map(code).join(", "));
      if (remove.length) lines.push("Taken out of: " + remove.map(code).join(", "));
      effects.push("Their class lists, games and assignments follow the new classes.");
      if (options?.some((o) => o.synced && (add.includes(o.id) || remove.includes(o.id)))) effects.push("Some of these classes come from the school's own system: its next sync may undo this.");
      body = { add, remove };
      path = "/classes";
      method = "PUT";
      break;
    case "archive":
      lines.push(`Status here: ${accountStatus(member.status).label} → Archived`);
      effects.push("They are signed out of this workspace and can't sign in to it.");
      effects.push("They leave its lists, class lists and pickers. Nothing of theirs is deleted; restoring brings them back as before.");
      path = "/archive";
      method = "POST";
      break;
    case "restore":
      lines.push("Status here: Archived → as it was before");
      effects.push("They are back in this workspace's lists and can sign in, unless they were switched off before.");
      path = "/restore";
      method = "POST";
      break;
    case "unlink":
      lines.push("Their account → no longer in this workspace");
      effects.push("Their account no longer opens this workspace; the workspace keeps their games and results.");
      effects.push("To come back, the school invites them again.");
      path = "/unlink";
      method = "POST";
      break;
    case "invite":
      effects.push(member.invitation ? "A new link is emailed to " + member.invitation.email + "; the old link stops working." : "An invitation is emailed to " + (member.email ?? "their email") + ".");
      effects.push("Where emails are switched off it is only stored: copy the link shown afterwards.");
      path = "/invitation";
      method = "POST";
      break;
    case "invite-email":
      fields = <EmailFields id={id} email={email} confirm={confirmEmail} onEmail={setEmail} onConfirm={setConfirmEmail} label="Correct email" />;
      validate = () => newEmailProblem(member.email ?? "", email, confirmEmail);
      lines.push(`Invited email: ${member.email ?? "—"} → ${email.trim().toLowerCase()}`);
      effects.push("The invitation is sent to the new address with a new link; the old link stops working.");
      body = { newEmail: email.trim(), confirmEmail: confirmEmail.trim() };
      path = "/invitation/email";
      method = "POST";
      break;
    case "student-link":
      fields = (
        <div className="field">
          <label htmlFor={id + "-to"}>Email it to (optional)</label>
          <input id={id + "-to"} type="email" list={id + "-to-list"} autoComplete="off" spellCheck={false} maxLength={254} autoFocus
                 value={emailTo} onChange={(e) => setEmailTo(e.target.value)} aria-describedby={id + "-to-hint"} />
          <datalist id={id + "-to-list"}>
            {suggestions.map((a) => <option key={a.email} value={a.email}>{a.name}</option>)}
          </datalist>
          <div id={id + "-to-hint"} className="hint">An adult who passes it on — a school admin, the teacher or the office. It isn&apos;t saved on the student.</div>
        </div>
      );
      validate = () => emailTo.trim() !== "" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailTo.trim()) ? "Enter the email address in full, or leave it empty." : null;
      effects.push("A new one-time link is made for " + member.name + "; any earlier link stops working. You see it, with a QR code, to copy or show.");
      effects.push(emailTo.trim() ? "It is emailed to " + emailTo.trim() + " (only stored where emails are switched off)." : "Nothing is emailed.");
      effects.push("Nobody sees a password: " + member.name + " chooses their own.");
      body = { emailTo: emailTo.trim() || null };
      path = "/invite-link";
      method = "POST";
      break;
    case "invite-withdraw":
      effects.push("The invitation link stops working. They stay on the school's list; you can send a new invitation later.");
      path = "/invitation/withdraw";
      method = "POST";
      break;
  }
  const base = `/api/v1/platform/people/workspaces/${encodeURIComponent(member.tenantId)}/members/${encodeURIComponent(member.userId)}`;
  return (
    <ReasonDialog title={MEMBER_TITLES[kind]} subtitle={member.name + " · " + member.workspaceName} fields={fields}
                  validate={validate} lines={lines} effects={effects}
                  danger={kind === "archive" || kind === "switch-off" || kind === "unlink" || kind === "invite-withdraw"}
                  onClose={onClose}
                  submit={async (why) => onDone(await api<MemberDone>(base + path, { method, body: { ...(body ?? {}), ...why } }))} />
  );
}

// ---- Shared pieces ----

function History({ changes }: { changes: PersonChange[] }) {
  return (
    <>
      <h3 style={{ margin: 0 }}>Changes by the platform team</h3>
      {changes.length === 0
        ? <p className="muted" style={{ margin: 0 }}>None yet.</p>
        : (
          <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {changes.map((c, i) => (
              <li key={c.at + i} className="card" style={{ padding: 12 }}>
                <strong>{actionLabel(c.action)}</strong> <span className="hint">· {when(c.at)} · by {c.by}</span>
                {changeLines(c.before, c.after).map((line) => <div key={line} style={{ overflowWrap: "anywhere" }}>{line}</div>)}
                {c.reason && <div className="hint">{reasonCategoryLabel(c.reasonCategory)}: {c.reason}</div>}
              </li>
            ))}
          </ol>
        )}
    </>
  );
}

function tidy(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function nameProblem(value: string, current: string): string | null {
  const v = tidy(value);
  if (v === "" || v.length > 120) return "Enter the name, up to 120 characters.";
  if (v === current) return "That is already the name.";
  return null;
}

function NameField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id + "-name"}>Name</label>
      <input id={id + "-name"} type="text" maxLength={120} required autoFocus value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function EmailFields({ id, email, confirm, onEmail, onConfirm, label }: {
  id: string;
  email: string;
  confirm: string;
  onEmail: (v: string) => void;
  onConfirm: (v: string) => void;
  label: string;
}) {
  return (
    <>
      <div className="field">
        <label htmlFor={id + "-email"}>{label}</label>
        <input id={id + "-email"} type="email" autoComplete="off" spellCheck={false} maxLength={254} required autoFocus
               value={email} onChange={(e) => onEmail(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={id + "-confirm"}>Type it again</label>
        <input id={id + "-confirm"} type="email" autoComplete="off" spellCheck={false} maxLength={254} required
               value={confirm} onChange={(e) => onConfirm(e.target.value)} onPaste={(e) => e.preventDefault()}
               aria-describedby={id + "-confirm-hint"} />
        <div id={id + "-confirm-hint"} className="hint">Typed, not pasted, so a mistake in the first box shows up.</div>
      </div>
    </>
  );
}

/**
 * One change in a native modal dialog: its fields and why (step 1), then what will change and what follows from it
 * (step 2), then the Quiz API's answer, shown as written. {@code submit} gets the reason and throws on refusal.
 */
function ReasonDialog({ title, subtitle, fields, validate, lines = [], effects, danger, confirmLabel, onClose, submit }: {
  title: string;
  subtitle: string;
  fields?: ReactNode;
  validate?: () => string | null;
  lines?: string[];
  effects: string[];
  danger?: boolean;
  confirmLabel?: string;
  onClose: () => void;
  submit: (why: { reasonCategory: string; reason: string }) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function review(e: FormEvent) {
    e.preventDefault();
    const p = (validate ? validate() : null) ?? reasonProblem(category, reason);
    setProblem(p);
    if (!p) setStep("confirm");
  }

  async function confirm() {
    setBusy(true);
    setProblem(null);
    try {
      await submit({ reasonCategory: category, reason: reason.trim() });
      dialog.current?.close();
    } catch (e) {
      setProblem(message(e, "That did not work. Please try again."));
      setStep("edit");
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} className="email-dialog" aria-labelledby={titleId} onClose={onClose}>
      <div className="stack">
        <h2 id={titleId} style={{ margin: 0, fontSize: 20 }}>{title}</h2>
        <div className="hint" style={{ overflowWrap: "anywhere" }}>{subtitle}</div>
        {problem && <div className="alert alert-danger" role="alert">{problem}</div>}
        {step === "edit" && (
          <form className="stack" onSubmit={review} noValidate>
            {fields}
            <div className="field">
              <label htmlFor={titleId + "-why"}>Why</label>
              <select id={titleId + "-why"} value={category} required autoFocus={!fields}
                      onChange={(e) => setCategory(e.target.value)}>
                <option value="">Choose…</option>
                {REASON_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor={titleId + "-reason"}>What happened</label>
              <textarea id={titleId + "-reason"} rows={3} maxLength={REASON_MAX} required value={reason}
                        onChange={(e) => setReason(e.target.value)} aria-describedby={titleId + "-reason-hint"} />
              <div id={titleId + "-reason-hint"} className="hint">Who asked and the support ticket, for example. Kept in the audit log.</div>
            </div>
            <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-light" onClick={() => dialog.current?.close()}>Cancel</button>
              <button type="submit" className="btn btn-primary">Review the change</button>
            </div>
          </form>
        )}
        {step === "confirm" && (
          <div className="stack">
            {lines.length > 0 && (
              <div>
                <strong>What changes</strong>
                {lines.map((l) => <div key={l} style={{ overflowWrap: "anywhere" }}>{l}</div>)}
              </div>
            )}
            <div>
              <strong>What follows</strong>
              <ul style={{ margin: "4px 0 0", paddingInlineStart: 20 }}>
                {effects.map((e) => <li key={e}>{e}</li>)}
              </ul>
            </div>
            <div className="hint">{reasonCategoryLabel(category)}: {reason.trim()}</div>
            <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-light" autoFocus disabled={busy} onClick={() => setStep("edit")}>Back</button>
              <button type="button" className={danger ? "btn btn-danger" : "btn btn-primary"} disabled={busy} onClick={confirm}>
                {busy ? "Saving…" : confirmLabel ?? title}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
