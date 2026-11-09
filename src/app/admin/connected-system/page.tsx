"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { isIndependent, isSchoolAdmin, useMe } from "@/lib/me";
import { LoadingState, PageHeader } from "@/components/ui/States";
import { ScoreDelivery } from "@/components/ScoreDelivery";

interface Settings {
  /** This school's id in Quizplayo: the school's system checks it in Quizplayo's requests. */
  schoolId: string;
  system: {
    issuer: string;
    publicKeyPem: string;
    signInUrl: string;
    rosterUrl: string | null;
    eventsUrl: string | null;
    enabled: boolean;
    lastRosterSyncAt: string | null;
    lastRosterResult: { ok: boolean; classes?: number; people?: number; disabled?: number; error?: string; needsConfirm?: boolean } | null;
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
  const [form, setForm] = useState({ issuer: "", publicKeyPem: "", signInUrl: "", rosterUrl: "", eventsUrl: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The roster guard stopped a copy that would switch off many people: the admin may copy anyway.
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  function show(s: Settings) {
    setSettings(s);
    if (s.system) {
      setForm({ issuer: s.system.issuer, publicKeyPem: s.system.publicKeyPem, signInUrl: s.system.signInUrl,
        rosterUrl: s.system.rosterUrl ?? "", eventsUrl: s.system.eventsUrl ?? "" });
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
    setNeedsConfirm(false);
    try {
      show(await api<Settings>(path, { method, body }));
      setNotice(done);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not work. Please try again.");
      setNeedsConfirm(e instanceof ApiError && e.code === "roster_needs_confirm");
    }
    setBusy(null);
  }

  async function copySchoolId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Your browser didn't allow copying. Select the school id and copy it yourself.");
    }
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
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
          {needsConfirm && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn btn-light" type="button" disabled={busy !== null}
                      onClick={() => run("roster", "/api/v1/admin/connected-system/roster-sync?confirm=true", "POST", undefined,
                        "People and classes copied.")}>
                {busy === "roster" ? "Copying…" : "Copy anyway"}
              </button>
            </div>
          )}
        </div>
      )}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="card stack">
        <h2 style={{ margin: 0 }}>1. Set up your school&apos;s system</h2>
        <p className="muted" style={{ margin: 0 }}>Give these to whoever runs your school&apos;s system. The full guide is the Quizplayo connected-system contract.</p>
        <dl className="detail-grid">
          <dt>Send people to (form POST of <code>token</code>)</dt><dd><code>{t.ssoUrl}</code></dd>
          <dt>Audience (<code>aud</code>)</dt><dd><code>{t.audience}</code></dd>
          <dt>Token lifetime</dt><dd>{t.maxTokenSeconds} seconds at most, signed with RS256</dd>
          <dt>Quizplayo&apos;s public key (to check roster requests and game events)</dt><dd><code>{t.jwksUrl}</code></dd>
          <dt id="cs-school-id-label">Your school&apos;s id in Quizplayo (the <code>school</code> claim in Quizplayo&apos;s requests)</dt>
          <dd className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <code aria-labelledby="cs-school-id-label">{settings.schoolId}</code>
            <button className="btn btn-light" type="button" onClick={() => copySchoolId(settings.schoolId)}
                    aria-describedby="cs-school-id-label">
              {copied ? "Copied" : "Copy"}
            </button>
            <span className="sr-only" aria-live="polite">{copied ? "School id copied" : ""}</span>
          </dd>
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
                   autoCapitalize="off" autoCorrect="off" spellCheck={false}
                   placeholder="https://portal.your-school.org/api/quizplayo/roster" />
          </div>
          <div className="field">
            <label htmlFor="cs-events">Events address (optional)</label>
            <p className="hint" id="cs-events-hint">
              Quizplayo tells your school&apos;s system here when a class game opens and ends, so it can let that class know.
            </p>
            <input id="cs-events" type="url" value={form.eventsUrl} aria-describedby="cs-events-hint"
                   onChange={(e) => setForm({ ...form, eventsUrl: e.target.value })}
                   autoCapitalize="off" autoCorrect="off" spellCheck={false}
                   placeholder="https://portal.your-school.org/api/quizplayo/events" />
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

      {s && (
        <ScoreDelivery path="/api/v1/admin/connected-system/scores" title="Scores sent to your school's system"
                       description={s.eventsUrl
                         ? "When a class game or assignment ends, Quizplayo sends each student's score to the events address. A score that fails is tried again a few times on its own."
                         : "Add an events address above, and Quizplayo sends each student's score there when a class game or assignment ends."} />
      )}

      <p className="muted" style={{ margin: 0 }}>
        Using an LMS such as Canvas, Moodle, Schoology or Brightspace? <Link href="/admin/lti">Connect your LMS (LTI 1.3)</Link>.
      </p>
    </div>
  );
}
