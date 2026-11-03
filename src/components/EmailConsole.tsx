"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ConsoleEmail, ConsolePage, KIND_LABEL, statusChip, statusText, when } from "@/lib/communication";
import { LoadingState } from "@/components/ui/States";

function message(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

/**
 * The platform console's Emails tab: every email Quizplayo stored, to every recipient, newest first. Opening one, and
 * showing its code or link, are logged. With mail off this is how a code or link reaches the person: copy it and pass
 * it on. Only the Quizplayo team sees this page.
 */
export function EmailConsole({ onError, onNotice }: { onError: (m: string | null) => void; onNotice: (m: string | null) => void }) {
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState<ConsolePage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<ConsoleEmail | null>(null);

  const query = useCallback((before?: string) => {
    const u = new URLSearchParams();
    if (status) u.set("status", status);
    if (kind) u.set("kind", kind);
    if (q) u.set("q", q);
    if (before) u.set("before", before);
    return "/api/v1/platform/emails?" + u.toString();
  }, [status, kind, q]);

  const load = useCallback(() => {
    setPage(null);
    api<ConsolePage>(query()).then(setPage).catch((e: unknown) => onError(message(e, "Quizplayo could not load the emails.")));
  }, [query, onError]);
  useEffect(load, [load]);

  async function more() {
    if (!page || page.emails.length === 0) return;
    setLoadingMore(true);
    try {
      const r = await api<ConsolePage>(query(page.emails[page.emails.length - 1].createdAt));
      setPage({ ...r, emails: [...page.emails, ...r.emails] });
    } catch (e) {
      onError(message(e, "Quizplayo could not load more emails."));
    }
    setLoadingMore(false);
  }

  return (
    <section className="stack" aria-labelledby="emails-title">
      <h2 id="emails-title" style={{ margin: 0 }}>Emails</h2>
      <p className="muted" style={{ margin: 0 }}>
        Every email Quizplayo writes is stored here with what happened to it. Opening an email and showing its code or
        link are written to the audit log.
      </p>
      {page && !page.mailOn && (
        <div className="alert alert-warning" role="status">
          Mail is switched off on this server (ISQUIZ_MAIL_SERVICE=false): emails are stored, not sent. Open a pending
          one to copy its code or link and pass it on.
        </div>
      )}
      {page && (
        <div className="email-stats" aria-label="Today">
          <div className="stat"><strong>{page.today.PENDING}</strong>Pending today</div>
          <div className="stat"><strong>{page.today.SENT}</strong>Sent today</div>
          <div className="stat"><strong>{page.today.FAILED}</strong>Failed today</div>
        </div>
      )}
      <form className="library-filters" role="search" onSubmit={(e) => { e.preventDefault(); setQ(search.trim()); }}>
        <div className="field">
          <label htmlFor="em-status">Status</label>
          <select id="em-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="PENDING">Pending</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="em-kind">Kind</label>
          <select id="em-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Every kind</option>
            {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className="field library-search">
          <label htmlFor="em-q">Recipient</label>
          <div className="row" style={{ gap: 8 }}>
            <input id="em-q" type="search" maxLength={254} value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder="Part of the address" />
            <button type="submit" className="btn btn-light">Search</button>
          </div>
        </div>
      </form>

      {!page && <LoadingState rows={4} label="Loading the emails" />}
      {page && page.emails.length === 0 && <p className="muted" style={{ margin: 0 }}>No emails match.</p>}
      {page && page.emails.length > 0 && (
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="emails-caption">
          <table className="sticky-head">
            <caption id="emails-caption" className="sr-only">Stored emails, newest first</caption>
            <thead><tr><th>When</th><th>To</th><th>Subject</th><th>Kind</th><th>School</th><th>Status</th><th /></tr></thead>
            <tbody>
              {page.emails.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{when(e.createdAt)}</td>
                  <td style={{ overflowWrap: "anywhere" }}>{e.to}</td>
                  <td style={{ overflowWrap: "anywhere" }}>
                    {e.subject}
                    {e.resentFrom && <div className="muted" style={{ fontSize: 12 }}>Sent again by {e.resentBy}</div>}
                    {e.sentAgainAt && <div className="muted" style={{ fontSize: 12 }}>Sent again on {when(e.sentAgainAt)} by {e.sentAgainBy}</div>}
                  </td>
                  <td>{KIND_LABEL[e.kind] ?? e.kind}</td>
                  <td>{e.schoolName ?? <span className="muted">None</span>}</td>
                  <td><span className={statusChip(e.status)}>{e.status === "PENDING" ? "Pending" : e.status === "SENT" ? "Sent" : "Failed"}</span></td>
                  <td>
                    <button type="button" className="btn btn-light" onClick={() => setOpen(e)}>
                      Open<span className="sr-only"> the email to {e.to}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {page?.more && (
        <div className="row">
          <button type="button" className="btn btn-light" onClick={more} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Show older emails"}
          </button>
        </div>
      )}
      {open && (
        <EmailDialog email={open} mailOn={page?.mailOn ?? true} onClose={() => setOpen(null)}
                     onSentAgain={(m) => { setOpen(null); onNotice(m); load(); }} />
      )}
    </section>
  );
}

/** One stored email, in a native modal dialog: its text, its code or link (logged), and Send again. */
function EmailDialog({ email, mailOn, onClose, onSentAgain }: {
  email: ConsoleEmail;
  mailOn: boolean;
  onClose: () => void;
  onSentAgain: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [body, setBody] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ secret: string; body: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleId = "email-" + email.id;

  useEffect(() => {
    dialog.current?.showModal();
    api<{ body: string }>("/api/v1/platform/emails/" + email.id).then((d) => setBody(d.body))
      .catch((e: unknown) => setError(message(e, "Quizplayo could not open this email.")));
  }, [email.id]);

  async function show() {
    setError(null);
    try {
      setSecret(await api<{ secret: string; body: string }>(`/api/v1/platform/emails/${email.id}/secret`, { method: "POST" }));
    } catch (e) {
      setError(message(e, "Quizplayo could not show the code or link."));
    }
  }

  async function copy() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.secret);
      setCopied(true);
    } catch {
      setCopied(false);
      setError("Your browser didn't allow copying. Select the code or link and copy it yourself.");
    }
  }

  async function sendAgain() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ message: string }>(`/api/v1/platform/emails/${email.id}/send-again`, { method: "POST" });
      onSentAgain(r.message);
    } catch (e) {
      setError(message(e, "Quizplayo could not send it again."));
      setBusy(false);
    }
  }

  const code = email.kind.endsWith("_CODE");
  return (
    <dialog ref={dialog} className="email-dialog" aria-labelledby={titleId} onClose={onClose}>
      <div className="stack">
        <h2 id={titleId} style={{ margin: 0, fontSize: 20, overflowWrap: "anywhere" }}>{email.subject}</h2>
        <dl>
          <dt>To</dt><dd>{email.to}</dd>
          <dt>Kind</dt><dd>{KIND_LABEL[email.kind] ?? email.kind}</dd>
          {email.schoolName && <><dt>School</dt><dd>{email.schoolName}</dd></>}
          <dt>Written</dt><dd>{when(email.createdAt)}</dd>
          <dt>Status</dt><dd><span className={statusChip(email.status)}>{statusText(email.status, email.error)}</span></dd>
          {email.sentAt && <><dt>Sent</dt><dd>{when(email.sentAt)}</dd></>}
        </dl>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {body === null && !error && <LoadingState rows={3} label="Opening the email" />}
        {body !== null && <pre className="email-text">{secret ? secret.body : body}</pre>}
        {email.hasSecret && !secret && (
          <button type="button" className="btn btn-light" onClick={show} style={{ justifySelf: "start" }}>
            Show the {code ? "code" : "link"}
          </button>
        )}
        {secret && (
          <div className="field">
            <label htmlFor={"secret-" + email.id}>{code ? "Code" : "Link"} (works until it expires)</label>
            <div className="row" style={{ gap: 8 }}>
              <input id={"secret-" + email.id} type="text" readOnly value={secret.secret} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn btn-primary" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </div>
            <p className="hint" aria-live="polite" style={{ margin: 0 }}>
              {copied ? "Copied. Pass it only to " + email.to + "." : "Pass it only to the person it's for."}
            </p>
          </div>
        )}
        {!mailOn && (
          <p className="hint" id={"again-" + email.id} style={{ margin: 0 }}>
            Mail is switched off on this server, so nothing can be emailed. Copy the code or link instead.
          </p>
        )}
        <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-light" disabled={!mailOn || busy} onClick={sendAgain}
                  aria-describedby={!mailOn ? "again-" + email.id : undefined}>
            {busy ? "Sending…" : code || email.kind === "INVITATION" || email.kind === "WELCOME" || email.kind === "VERIFY_EMAIL"
              ? `Send a new ${code ? "code" : "link"}` : "Send again"}
          </button>
          <form method="dialog">
            <button type="submit" className="btn btn-primary" autoFocus>Close</button>
          </form>
        </div>
      </div>
    </dialog>
  );
}
