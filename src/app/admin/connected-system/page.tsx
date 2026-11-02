"use client";

import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { isIndependent, isSchoolAdmin, useMe } from "@/lib/me";
import { LoadingState, PageHeader } from "@/components/ui/States";

interface Settings {
  system: {
    issuer: string;
    publicKeyPem: string;
    signInUrl: string;
    rosterUrl: string | null;
    enabled: boolean;
    lastRosterSyncAt: string | null;
    lastRosterResult: { ok: boolean; classes?: number; people?: number; disabled?: number; error?: string } | null;
  } | null;
  forTheirSystem: { ssoUrl: string; audience: string; jwksUrl: string; maxTokenSeconds: number };
  lastSignIn: Record<string, unknown> | null;
}

export default function ConnectedSystemPage() {
  return (
    <AppFrame>
      <ConnectedSystem />
    </AppFrame>
  );
}

/**
 * The school admin connects the school's own system: it signs people in to Quizplayo with a short-lived token and
 * Quizplayo pulls its roster. Shows what to set up on their side, and the last sign-in Quizplayo received.
 */
function ConnectedSystem() {
  const me = useMe();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState({ issuer: "", publicKeyPem: "", signInUrl: "", rosterUrl: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function show(s: Settings) {
    setSettings(s);
    if (s.system) {
      setForm({ issuer: s.system.issuer, publicKeyPem: s.system.publicKeyPem, signInUrl: s.system.signInUrl,
        rosterUrl: s.system.rosterUrl ?? "" });
    }
  }

  useEffect(() => {
    if (!isSchoolAdmin(me) || isIndependent(me)) return;
    api<Settings>("/api/v1/admin/connected-system").then(show)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load these settings."));
  }, [me]);

  async function run(step: string, path: string, method: string, body: unknown, done: string) {
    setBusy(step);
    setError(null);
    setNotice(null);
    try {
      show(await api<Settings>(path, { method, body }));
      setNotice(done);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not work. Please try again.");
    }
    setBusy(null);
  }

  if (!isSchoolAdmin(me) || isIndependent(me)) {
    return <div className="alert alert-danger">Only a school&apos;s Quizplayo admins can connect its system.</div>;
  }
  if (!settings) return error ? <div className="alert alert-danger">{error}</div> : <LoadingState rows={5} label="Loading" />;
  const s = settings.system;
  const t = settings.forTheirSystem;
  const last = settings.lastSignIn;

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <PageHeader title="Your school's own system"
                  description="Optional. Connect it, and people sign in to Quizplayo straight from your school's system, and Quizplayo copies your classes from it every night."
                  action={s && <span className={"chip " + (s.enabled ? "chip-ok" : "chip-warn")}>{s.enabled ? "Switched on" : "Switched off"}</span>} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="card stack">
        <h2 style={{ margin: 0 }}>1. Set up your school&apos;s system</h2>
        <p className="muted" style={{ margin: 0 }}>Give these to whoever runs your school&apos;s system. The full guide is the Quizplayo connected-system contract.</p>
        <dl className="detail-grid">
          <dt>Send people to (form POST of <code>token</code>)</dt><dd><code>{t.ssoUrl}</code></dd>
          <dt>Audience (<code>aud</code>)</dt><dd><code>{t.audience}</code></dd>
          <dt>Token lifetime</dt><dd>{t.maxTokenSeconds} seconds at most, signed with RS256</dd>
          <dt>Quizplayo&apos;s public key (to check roster requests)</dt><dd><code>{t.jwksUrl}</code></dd>
        </dl>
      </section>

      <form className="card stack" onSubmit={(e) => { e.preventDefault(); run("save", "/api/v1/admin/connected-system", "PUT", form, "Saved."); }}>
        <h2 style={{ margin: 0 }}>2. Tell Quizplayo about it</h2>
        <div className="field">
          <label htmlFor="cs-issuer">Issuer (<code>iss</code> in its tokens)</label>
          <input id="cs-issuer" type="text" maxLength={200} required value={form.issuer}
                 onChange={(e) => setForm({ ...form, issuer: e.target.value })} placeholder="https://portal.your-school.org" />
        </div>
        <div className="field">
          <label htmlFor="cs-key">Its public key (PEM)</label>
          <textarea id="cs-key" rows={6} required value={form.publicKeyPem} spellCheck={false} style={{ fontFamily: "monospace", fontSize: 12 }}
                    onChange={(e) => setForm({ ...form, publicKeyPem: e.target.value })}
                    placeholder={"-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----"} />
          <p className="hint">An RSA key of at least 2048 bits. Never paste a private key here.</p>
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="cs-signin">Where people sign in there</label>
            <input id="cs-signin" type="url" required value={form.signInUrl} onChange={(e) => setForm({ ...form, signInUrl: e.target.value })}
                   placeholder="https://portal.your-school.org/quizplayo" />
          </div>
          <div className="field">
            <label htmlFor="cs-roster">Roster address (optional)</label>
            <input id="cs-roster" type="url" value={form.rosterUrl} onChange={(e) => setForm({ ...form, rosterUrl: e.target.value })}
                   placeholder="https://portal.your-school.org/api/quizplayo/roster" />
          </div>
        </div>
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save"}</button>
        </div>
      </form>

      {s && (
        <section className="card stack">
          <h2 style={{ margin: 0 }}>3. Try it, then switch it on</h2>
          <p style={{ margin: 0 }}>
            Open Quizplayo from your school&apos;s system once. The last sign-in Quizplayo received:
          </p>
          {last ? (
            <div className={"alert " + (last.ok ? "alert-success" : "alert-warning")}>
              {last.ok ? <>Signed in <strong>{String(last.name ?? "")}</strong> ({String(last.role ?? "")})</> : <>Refused: {String(last.message ?? last.reason ?? "")}</>}
              {last.at ? <span className="muted"> · {new Date(String(last.at)).toLocaleString()}</span> : null}
            </div>
          ) : <p className="muted" style={{ margin: 0 }}>None yet.</p>}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-primary" type="button" disabled={busy !== null}
                    onClick={() => run("enable", "/api/v1/admin/connected-system/enable", "POST", { enabled: !s.enabled },
                      s.enabled ? "Switched off: people sign in on your school's Quizplayo page instead." : "Switched on: people can sign in from your school's system.")}>
              {s.enabled ? "Switch off" : "Switch on"}
            </button>
            {s.rosterUrl && (
              <button className="btn btn-light" type="button" disabled={busy !== null}
                      onClick={() => run("roster", "/api/v1/admin/connected-system/roster-sync", "POST", undefined, "People and classes copied.")}>
                {busy === "roster" ? "Copying…" : "Copy people now"}
              </button>
            )}
          </div>
          {s.lastRosterResult && (
            <p className="muted" style={{ margin: 0 }}>
              Last roster copy{s.lastRosterSyncAt ? " " + new Date(s.lastRosterSyncAt).toLocaleString() : ""}:{" "}
              {s.lastRosterResult.ok
                ? `${s.lastRosterResult.people ?? 0} people, ${s.lastRosterResult.classes ?? 0} classes, ${s.lastRosterResult.disabled ?? 0} switched off`
                : s.lastRosterResult.error}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
