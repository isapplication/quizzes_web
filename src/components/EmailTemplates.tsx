"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { LoadingState } from "@/components/ui/States";

/** One kind of email, written out with sample data (EmailTemplates.Template). */
interface Template {
  kind: string;
  title: string;
  whenSent: string;
  to: string[];
  subject: string;
  body: string;
  carriesSecret: boolean;
}

/**
 * Platform console → Emails → Templates: every kind of email Quizplayo sends, as people get it, with sample data
 * (never a real person's). Where this server sends emails, the team can send themselves a test copy of one.
 */
export function EmailTemplates({ onError, onNotice }: { onError: (m: string | null) => void; onNotice: (m: string | null) => void }) {
  const [data, setData] = useState<{ mailOn: boolean; templates: Template[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api<{ mailOn: boolean; templates: Template[] }>("/api/v1/platform/emails/templates")
      .then(setData)
      .catch((e: unknown) => onError(e instanceof ApiError ? e.message : "The email templates could not be loaded."));
  }, [onError]);

  async function test(t: Template) {
    setBusy(t.kind);
    onError(null);
    onNotice(null);
    try {
      const r = await api<{ message: string }>(`/api/v1/platform/emails/templates/${encodeURIComponent(t.kind)}/test`, { method: "POST" });
      onNotice(r.message);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "The test email could not be sent.");
    }
    setBusy(null);
  }

  if (!data) return <LoadingState rows={4} label="Loading the email templates" />;
  return (
    <section className="stack" aria-labelledby="templates-title">
      <h2 id="templates-title" style={{ margin: 0 }}>Email templates</h2>
      <p className="muted" style={{ margin: 0 }}>
        Every email Quizplayo sends, shown with sample data. {data.mailOn
          ? "You can send yourself a test copy of any of them."
          : "Emails are switched off on this server, so test copies can't be sent; every real email is still stored under Sent emails."}
      </p>
      {data.templates.map((t) => (
        <details key={t.kind} className="card">
          <summary style={{ cursor: "pointer" }}>
            <strong>{t.title}</strong> <span className="hint">{t.whenSent}</span>
          </summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <dl className="template-meta">
              <dt>Subject</dt><dd style={{ overflowWrap: "anywhere" }}>{t.subject}</dd>
              <dt>To</dt><dd style={{ overflowWrap: "anywhere" }}>{t.to.join(", ")}</dd>
              <dt>Kind</dt><dd><code>{t.kind}</code>{t.carriesSecret && <span className="hint"> · carries a code or link, hidden in the stored copy</span>}</dd>
            </dl>
            <pre className="template-body">{t.body}</pre>
            <div>
              <button type="button" className="btn btn-light" disabled={!data.mailOn || busy !== null} onClick={() => test(t)}
                      aria-describedby={data.mailOn ? undefined : "templates-title"}>
                {busy === t.kind ? "Sending…" : "Send a test to me"}
              </button>
            </div>
          </div>
        </details>
      ))}
    </section>
  );
}
