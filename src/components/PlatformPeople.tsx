"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, ApiError } from "@/lib/api";
import { schoolStatus } from "@/lib/school";
import {
  accountStatus, actionLabel, changeLines, newEmailProblem, reasonCategoryLabel, reasonProblem, roleLabel,
  REASON_CATEGORIES, REASON_MAX, type Done, type FoundPerson, type Person,
} from "@/lib/platformPeople";
import { EmptyState, LoadingState } from "@/components/ui/States";

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

/**
 * Platform console → People (platform-people-plan.md, step 1): find a person's Quizplayo account by email or name across
 * every workspace, then change its sign-in email, name or status, archive or restore it, remove its password or sign
 * it out everywhere. Every change asks why and is shown before → after before it is made. The search is sent in the
 * request body, so emails never appear in the page address.
 */
export function PlatformPeople({ onError, onNotice }: Feedback) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundPerson[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
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

  if (open) {
    return <PersonView accountId={open} onBack={() => { setOpen(null); onNotice(null); onError(null); }}
                       onError={onError} onNotice={onNotice} />;
  }

  return (
    <section className="stack" aria-labelledby="people-title">
      <h2 id="people-title" style={{ margin: 0 }}>People</h2>
      <p className="muted" style={{ margin: 0 }}>
        Find a teacher or school admin by their sign-in email or name, in any school. Every change you make asks why
        and is kept in the audit log.
      </p>
      <form role="search" className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "end" }} onSubmit={search}>
        <div className="field" style={{ flex: "1 1 260px", margin: 0 }}>
          <label htmlFor="people-query">Email or name</label>
          <input id="people-query" type="search" value={query} minLength={3} maxLength={254} required
                 autoComplete="off" spellCheck={false} onChange={(e) => setQuery(e.target.value)}
                 aria-describedby="people-query-hint" />
          <div id="people-query-hint" className="hint">At least 3 letters.</div>
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
            <caption id={captionId} className="sr-only">People found</caption>
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
                    <td><button type="button" className="btn btn-light" onClick={() => setOpen(p.accountId)}>Open<span className="sr-only"> {p.name}</span></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type Kind = "email" | "name" | "switch-off" | "switch-on" | "archive" | "restore" | "password" | "sign-out";

function PersonView({ accountId, onBack, onError, onNotice }: { accountId: string; onBack: () => void } & Feedback) {
  const [person, setPerson] = useState<Person | null>(null);
  const [dialog, setDialog] = useState<Kind | null>(null);
  const workspacesId = useId();

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

  if (!person) {
    return (
      <div className="stack">
        <p><button type="button" className="btn btn-light" onClick={onBack}>← Back to the search</button></p>
        <LoadingState rows={4} label="Loading the person" />
      </div>
    );
  }

  const st = accountStatus(person.status);
  const archived = person.status === "ARCHIVED";
  return (
    <section className="stack" aria-labelledby="person-name">
      <p style={{ margin: 0 }}><button type="button" className="btn btn-light" onClick={onBack}>← Back to the search</button></p>
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
        {person.onPlatformList && (
          <div className="alert alert-warning">This email is also on the platform team list.</div>
        )}
        <div className="hint">
          Account since {when(person.createdAt)}{archived && person.archivedAt ? " · archived " + when(person.archivedAt) : ""}
        </div>
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
                <tr><th scope="col">Workspace</th><th scope="col">Name there</th><th scope="col">Role</th><th scope="col">Status there</th><th scope="col">Last sign-in</th></tr>
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
                      <td>{w.status === "ACTIVE" ? "Active" : w.status === "DISABLED" ? "Switched off" : w.status}</td>
                      <td>{when(w.lastSignInAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      <h3 style={{ margin: 0 }}>Changes by the platform team</h3>
      {person.changes.length === 0
        ? <p className="muted" style={{ margin: 0 }}>None yet.</p>
        : (
          <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {person.changes.map((c, i) => (
              <li key={c.at + i} className="card" style={{ padding: 12 }}>
                <strong>{actionLabel(c.action)}</strong> <span className="hint">· {when(c.at)} · by {c.by}</span>
                {changeLines(c.before, c.after).map((line) => <div key={line} style={{ overflowWrap: "anywhere" }}>{line}</div>)}
                {c.reason && <div className="hint">{reasonCategoryLabel(c.reasonCategory)}: {c.reason}</div>}
              </li>
            ))}
          </ol>
        )}

      {dialog && (
        <ChangeDialog kind={dialog} person={person} onClose={() => setDialog(null)}
                      onDone={(done) => { setPerson(done.person); onError(null); onNotice(done.message); setDialog(null); }} />
      )}
    </section>
  );
}

const TITLES: Record<Kind, string> = {
  email: "Change the sign-in email",
  name: "Change the name",
  "switch-off": "Switch off this account",
  "switch-on": "Switch this account back on",
  archive: "Archive this account",
  restore: "Restore this account",
  password: "Remove the password",
  "sign-out": "Sign out everywhere",
};

/**
 * One change in a native modal dialog: its fields and why (step 1), then what will change and what follows from it
 * (step 2), then the Quiz API's answer, shown as written.
 */
function ChangeDialog({ kind, person, onClose, onDone }: {
  kind: Kind;
  person: Person;
  onClose: () => void;
  onDone: (done: Done) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [name, setName] = useState(person.name);
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const linked = person.workspaces.some((w) => w.linked);
  const lines: string[] = [];
  const effects: string[] = [];
  switch (kind) {
    case "email":
      lines.push(`Sign-in email: ${person.email} → ${email.trim().toLowerCase()}`);
      effects.push("They are signed out at their next click and sign in with the new address.");
      effects.push("Both the old and the new address are told. Where emails are switched off, both notices are only stored.");
      effects.push("The new address counts as not confirmed until they sign in with an emailed code.");
      if (linked) effects.push("Some of their workspaces are linked to a school's own system: ask the school to change the email there too, or its next sync may put the old one back in that workspace.");
      break;
    case "name":
      lines.push(`Account name: ${person.name} → ${name.trim().replace(/\s+/g, " ")}`);
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
      effects.push("Nothing is deleted: their games, quizzes and results stay. Restoring brings the account back as it was.");
      effects.push("Their email stays taken while the account is archived.");
      break;
    case "restore":
      lines.push("Status: Archived → as it was before");
      effects.push("They can sign in again, unless the account was switched off before it was archived.");
      break;
    case "password":
      lines.push("Password: Set → None");
      effects.push("They are signed out and from now on sign in with a code emailed to them. They can choose a new password after signing in.");
      break;
    case "sign-out":
      effects.push("Every open session ends at its next click. Nothing else changes.");
      break;
  }

  function review(e: FormEvent) {
    e.preventDefault();
    const p = (kind === "email" ? newEmailProblem(person.email, email, confirmEmail) : null)
      ?? (kind === "name" && (name.trim() === "" || name.trim().length > 120) ? "Enter the name, up to 120 characters." : null)
      ?? (kind === "name" && name.trim().replace(/\s+/g, " ") === person.name ? "That is already the account's name." : null)
      ?? reasonProblem(category, reason);
    setProblem(p);
    if (!p) setStep("confirm");
  }

  async function confirm() {
    setBusy(true);
    setProblem(null);
    const why = { reasonCategory: category, reason: reason.trim() };
    const base = "/api/v1/platform/people/accounts/" + encodeURIComponent(person.accountId);
    try {
      let done: Done;
      switch (kind) {
        case "email":
          done = await api<Done>(base + "/email", { method: "POST", body: { newEmail: email.trim(), confirmEmail: confirmEmail.trim(), ...why } });
          break;
        case "name":
          done = await api<Done>(base, { method: "PATCH", body: { name: name.trim(), ...why } });
          break;
        case "switch-off":
        case "switch-on":
          done = await api<Done>(base, { method: "PATCH", body: { status: kind === "switch-off" ? "DISABLED" : "ACTIVE", ...why } });
          break;
        case "password":
          done = await api<Done>(base, { method: "PATCH", body: { removePassword: true, ...why } });
          break;
        default:
          done = await api<Done>(base + "/" + kind, { method: "POST", body: why });
      }
      onDone(done);
      dialog.current?.close();
    } catch (e) {
      setProblem(message(e, "That did not work. Please try again."));
      setStep("edit");
      setBusy(false);
    }
  }

  const danger = kind === "archive" || kind === "switch-off" || kind === "password";
  return (
    <dialog ref={dialog} className="email-dialog" aria-labelledby={titleId} onClose={onClose}>
      <div className="stack">
        <h2 id={titleId} style={{ margin: 0, fontSize: 20 }}>{TITLES[kind]}</h2>
        <div className="hint" style={{ overflowWrap: "anywhere" }}>{person.name} · {person.email}</div>
        {problem && <div className="alert alert-danger" role="alert">{problem}</div>}
        {step === "edit" && (
          <form className="stack" onSubmit={review} noValidate>
            {kind === "email" && (
              <>
                <div className="field">
                  <label htmlFor={titleId + "-email"}>New sign-in email</label>
                  <input id={titleId + "-email"} type="email" autoComplete="off" spellCheck={false} maxLength={254} required autoFocus
                         value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor={titleId + "-confirm"}>Type it again</label>
                  <input id={titleId + "-confirm"} type="email" autoComplete="off" spellCheck={false} maxLength={254} required
                         value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} onPaste={(e) => e.preventDefault()}
                         aria-describedby={titleId + "-confirm-hint"} />
                  <div id={titleId + "-confirm-hint"} className="hint">Typed, not pasted, so a mistake in the first box shows up.</div>
                </div>
              </>
            )}
            {kind === "name" && (
              <div className="field">
                <label htmlFor={titleId + "-name"}>Name</label>
                <input id={titleId + "-name"} type="text" maxLength={120} required autoFocus value={name}
                       onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label htmlFor={titleId + "-why"}>Why</label>
              <select id={titleId + "-why"} value={category} required autoFocus={kind !== "email" && kind !== "name"}
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
                {busy ? "Saving…" : TITLES[kind]}
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
