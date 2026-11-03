"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppFrame, COMMUNICATION_CHANGED } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { Inbox, KIND_LABEL, Message, ownLink, statusChip, statusText, when } from "@/lib/communication";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";

export default function CommunicationRoute() {
  return (
    <AppFrame>
      <Communication />
    </AppFrame>
  );
}

const LINK_WORDS: Record<string, string> = {
  WELCOME: "Confirm my email",
  VERIFY_EMAIL: "Confirm my email",
  INVITATION: "Open the invitation",
};

/**
 * The emails Quizplayo wrote to you, newest first, whether or not they were emailed: open one to read it (it is
 * marked read), use its link while it still works, or have it emailed again. Only your own are here.
 */
function Communication() {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Inbox>("/api/v1/communication").then(setInbox)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your messages."));
  }, []);
  useEffect(load, [load]);

  async function more() {
    if (!inbox || inbox.messages.length === 0) return;
    setLoadingMore(true);
    try {
      const last = inbox.messages[inbox.messages.length - 1].createdAt;
      const r = await api<Inbox>("/api/v1/communication?before=" + encodeURIComponent(last));
      setInbox({ ...r, messages: [...inbox.messages, ...r.messages] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not load more messages.");
    }
    setLoadingMore(false);
  }

  async function opened(m: Message, open: boolean) {
    if (!open || m.read) return;
    try {
      await api(`/api/v1/communication/${m.id}/read`, { method: "POST" });
      setInbox((i) => i && { ...i, unread: Math.max(0, i.unread - 1),
        messages: i.messages.map((x) => (x.id === m.id ? { ...x, read: true } : x)) });
      window.dispatchEvent(new Event(COMMUNICATION_CHANGED));
    } catch {
      // Still readable; it stays unread until next time.
    }
  }

  async function emailAgain(m: Message) {
    setBusy(m.id);
    setError(null);
    setNotice(null);
    try {
      const r = await api<{ message: string }>(`/api/v1/communication/${m.id}/email-again`, { method: "POST" });
      setNotice(r.message);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not send it again. Please try again.");
    }
    setBusy(null);
  }

  return (
    <div className="stack">
      <PageHeader title="Communication"
                  description="Every email Quizplayo writes to you, kept here too. Sign-in codes aren't, since you've already signed in." />
      {inbox && !inbox.mailOn && (
        <div className="alert alert-warning" role="status">
          Quizplayo isn&apos;t sending emails on this server right now, so new messages arrive here only.
        </div>
      )}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {!inbox && !error && <LoadingState rows={4} label="Loading your messages" />}
      {inbox && inbox.messages.length === 0 && (
        <EmptyState title="No messages yet">Emails Quizplayo sends you show up here.</EmptyState>
      )}
      {inbox && inbox.messages.length > 0 && (
        <>
          <p className="muted" style={{ margin: 0 }}>
            {inbox.unread === 0 ? "Nothing unread." : inbox.unread === 1 ? "1 unread." : `${inbox.unread} unread.`}
          </p>
          <ul className="inbox">
            {inbox.messages.map((m) => {
              const link = ownLink(m.link);
              return (
                <li key={m.id} className={m.read ? "" : "unread"}>
                  <details onToggle={(e) => opened(m, (e.currentTarget as HTMLDetailsElement).open)}>
                    <summary>
                      <span className="subject">{m.read ? "" : <span className="sr-only">Unread: </span>}{m.subject}</span>
                      <span className="when">{when(m.createdAt)}</span>
                      <span className="meta">
                        <span>{KIND_LABEL[m.kind] ?? m.kind}</span>
                        {m.schoolName && <span>· {m.schoolName}</span>}
                        <span className={statusChip(m.status)}>{statusText(m.status)}</span>
                      </span>
                    </summary>
                    <div className="message">
                      <pre className="email-text">{m.body}</pre>
                      {m.status === "FAILED" && m.error && <p className="muted" style={{ margin: 0 }}>Why it wasn&apos;t sent: {m.error}</p>}
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        {link && <Link className="btn btn-primary" href={link}>{LINK_WORDS[m.kind] ?? "Open the link"}</Link>}
                        {inbox.mailOn && m.status !== "PENDING" && (
                          <button type="button" className="btn btn-light" disabled={busy === m.id} onClick={() => emailAgain(m)}>
                            {busy === m.id ? "Sending…" : "Email me this again"}
                          </button>
                        )}
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
          {inbox.more && (
            <div className="row">
              <button type="button" className="btn btn-light" onClick={more} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Show older messages"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
