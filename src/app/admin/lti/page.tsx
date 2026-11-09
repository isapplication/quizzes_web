"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { ScoreDelivery } from "@/components/ScoreDelivery";
import { api, ApiError } from "@/lib/api";
import { isIndependent, isSchoolAdmin, useMe } from "@/lib/me";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";

interface Platform {
  platformId: string;
  name: string;
  issuer: string;
  clientId: string;
  deploymentIds: string[];
  authLoginUrl: string;
  authTokenUrl: string;
  tokenAudience: string | null;
  keysetUrl: string;
  enabled: boolean;
  updatedAt: string;
}

interface Settings {
  platform: Platform | null;
  /** What the school admin copies into the LMS's tool registration. */
  forTheLms: { loginUrl: string; launchUrl: string; deepLinkUrl: string; jwksUrl: string; domain: string };
}

interface Course {
  classGroupId: string;
  classCode: string;
  className: string;
  title: string;
  hasClassList: boolean;
  lastSyncAt: string | null;
  /** JSON text, e.g. {"ok":true,"members":3,"added":1,"left":0,"at":"…"}, or null before the first sync. */
  lastSyncResult: string | null;
  members: number;
}

interface SyncResult {
  ok?: boolean;
  members?: number;
  added?: number;
  left?: number;
  error?: string;
  message?: string;
}

interface Form {
  name: string;
  issuer: string;
  clientId: string;
  deploymentIds: string;
  authLoginUrl: string;
  authTokenUrl: string;
  tokenAudience: string;
  keysetUrl: string;
}

const EMPTY: Form = { name: "", issuer: "", clientId: "", deploymentIds: "", authLoginUrl: "", authTokenUrl: "", tokenAudience: "", keysetUrl: "" };

export default function LtiPage() {
  return (
    <AppFrame>
      <Lti />
    </AppFrame>
  );
}

/**
 * The school admin connects the school's LMS (Canvas, Moodle, Schoology, Brightspace…) with LTI 1.3: Quizplayo's
 * addresses to register in the LMS, the values the LMS gives back, the on/off switch, the courses linked to classes
 * (with "Sync class list"), and the scores on their way to the LMS gradebook.
 */
function Lti() {
  const me = useMe();
  const allowed = isSchoolAdmin(me) && !isIndependent(me);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function show(s: Settings) {
    setSettings(s);
    const p = s.platform;
    if (p) {
      setForm({
        name: p.name, issuer: p.issuer, clientId: p.clientId, deploymentIds: p.deploymentIds.join("\n"),
        authLoginUrl: p.authLoginUrl, authTokenUrl: p.authTokenUrl, tokenAudience: p.tokenAudience ?? "", keysetUrl: p.keysetUrl,
      });
    }
  }

  useEffect(() => {
    if (!allowed) return;
    api<Settings>("/api/v1/admin/lti").then(show)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your LMS settings."));
  }, [allowed]);

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

  function save(e: React.FormEvent) {
    e.preventDefault();
    const deploymentIds = form.deploymentIds.split(/\r?\n/).map((d) => d.trim()).filter(Boolean);
    if (deploymentIds.length < 1 || deploymentIds.length > 20) {
      setNotice(null);
      setError("Give between 1 and 20 deployment IDs, one per line.");
      return;
    }
    run("save", "/api/v1/admin/lti", "PUT", {
      name: form.name.trim(), issuer: form.issuer.trim(), clientId: form.clientId.trim(), deploymentIds,
      authLoginUrl: form.authLoginUrl.trim(), authTokenUrl: form.authTokenUrl.trim(),
      tokenAudience: form.tokenAudience.trim() || null, keysetUrl: form.keysetUrl.trim(),
    }, "Saved.");
  }

  if (!allowed) {
    return <div className="alert alert-danger">Only a school&apos;s Quizplayo admins can connect its LMS.</div>;
  }
  if (!settings) return error ? <div className="alert alert-danger" role="alert">{error}</div> : <LoadingState rows={5} label="Loading" />;
  const p = settings.platform;
  const t = settings.forTheLms;
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const urlInput = { type: "url", autoCapitalize: "off", autoCorrect: "off", spellCheck: false } as const;
  const idInput = { type: "text", autoCapitalize: "off", autoCorrect: "off", spellCheck: false } as const;

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <PageHeader title="Your LMS"
                  description="Optional. Connect your school's LMS with LTI 1.3, and teachers add Quizplayo quizzes to their courses: students open them from the course, signed in, and their scores go to the LMS gradebook."
                  action={p && <span className={"chip " + (p.enabled ? "chip-ok" : "chip-warn")}>{p.enabled ? "Switched on" : "Switched off"}</span>} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      <section className="card stack" aria-labelledby="lti-for-lms">
        <h2 id="lti-for-lms" style={{ margin: 0 }}>1. Values for your LMS</h2>
        <p className="muted" style={{ margin: 0 }}>
          Add Quizplayo to your LMS as an LTI 1.3 tool (in some LMSs, a &ldquo;developer key&rdquo; or &ldquo;external tool&rdquo;) with these values.
        </p>
        <ul className="copy-list">
          <CopyValue label="Login (OIDC initiation) address" value={t.loginUrl} />
          <CopyValue label="Launch (redirect / target link) address" value={t.launchUrl} />
          <CopyValue label="Deep linking address" value={t.deepLinkUrl} />
          <CopyValue label="Public key set (JWKS) address" value={t.jwksUrl} />
          <CopyValue label="Domain" value={t.domain} />
        </ul>
      </section>

      <form className="card stack" onSubmit={save}>
        <h2 style={{ margin: 0 }}>2. Tell Quizplayo about your LMS</h2>
        <p className="muted" style={{ margin: 0 }}>Your LMS shows these after you add the tool.</p>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="lti-name">Name</label>
            <input id="lti-name" type="text" required maxLength={120} value={form.name} onChange={set("name")} placeholder="Our Canvas" />
          </div>
          <div className="field">
            <label htmlFor="lti-issuer">Issuer (platform ID)</label>
            <input id="lti-issuer" {...idInput} required maxLength={300} value={form.issuer} onChange={set("issuer")}
                   placeholder="https://canvas.instructure.com" />
          </div>
          <div className="field">
            <label htmlFor="lti-client">Client ID</label>
            <input id="lti-client" {...idInput} required maxLength={200} value={form.clientId} onChange={set("clientId")} />
          </div>
          <div className="field">
            <label htmlFor="lti-deployments">Deployment IDs</label>
            <p className="hint" id="lti-deployments-hint" style={{ marginTop: 0 }}>One per line, 1 to 20.</p>
            <textarea id="lti-deployments" rows={3} required spellCheck={false} autoCapitalize="off" autoCorrect="off"
                      aria-describedby="lti-deployments-hint" value={form.deploymentIds} onChange={set("deploymentIds")} />
          </div>
          <div className="field wide">
            <label htmlFor="lti-login">OIDC authorization (login) address</label>
            <input id="lti-login" {...urlInput} required value={form.authLoginUrl} onChange={set("authLoginUrl")}
                   placeholder="https://sso.canvaslms.com/api/lti/authorize_redirect" />
          </div>
          <div className="field wide">
            <label htmlFor="lti-token">Token address</label>
            <input id="lti-token" {...urlInput} required value={form.authTokenUrl} onChange={set("authTokenUrl")}
                   placeholder="https://sso.canvaslms.com/login/oauth2/token" />
          </div>
          <div className="field wide">
            <label htmlFor="lti-audience">Token audience (optional)</label>
            <p className="hint" id="lti-audience-hint" style={{ marginTop: 0 }}>Only if your LMS names one. Otherwise leave it empty.</p>
            <input id="lti-audience" {...idInput} aria-describedby="lti-audience-hint" value={form.tokenAudience} onChange={set("tokenAudience")} />
          </div>
          <div className="field wide">
            <label htmlFor="lti-keyset">Key set (JWKS) address</label>
            <input id="lti-keyset" {...urlInput} required value={form.keysetUrl} onChange={set("keysetUrl")}
                   placeholder="https://sso.canvaslms.com/api/lti/security/jwks" />
          </div>
        </div>
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={busy !== null}>{busy === "save" ? "Saving…" : "Save"}</button>
          {p && <span className="muted">Last saved <time dateTime={p.updatedAt}>{new Date(p.updatedAt).toLocaleString()}</time></span>}
        </div>
      </form>

      {p && (
        <section className="card stack" aria-labelledby="lti-switch">
          <h2 id="lti-switch" style={{ margin: 0 }}>3. Switch it on</h2>
          <p style={{ margin: 0 }}>
            {p.enabled
              ? "Switched on: teachers can add Quizplayo to their courses, and students open it from the course."
              : "Switched off: opening Quizplayo from your LMS shows a message instead. Switch it on once the values above are saved in both places."}
          </p>
          <div className="row">
            <button className={p.enabled ? "btn btn-light" : "btn btn-primary"} type="button" disabled={busy !== null}
                    onClick={() => run("enable", "/api/v1/admin/lti/enable", "POST", { enabled: !p.enabled },
                      p.enabled ? "Switched off: opening Quizplayo from your LMS no longer signs anyone in." : "Switched on: teachers can add Quizplayo to their courses.")}>
              {busy === "enable" ? "Saving…" : p.enabled ? "Switch off" : "Switch on"}
            </button>
          </div>
        </section>
      )}

      {p && <LinkedCourses />}

      {p && (
        <ScoreDelivery path="/api/v1/admin/lti/scores" title="Scores sent to your LMS gradebook"
                       description="When a student finishes a Quizplayo assignment added to a course, Quizplayo sends the score to that course's gradebook. A score that fails is tried again a few times on its own." />
      )}

      <p className="muted" style={{ margin: 0 }}>
        Your school has its own sign-in system instead? See <Link href="/admin/connected-system">Your school&apos;s own system</Link>.
      </p>
    </div>
  );
}

/** One value the admin copies into the LMS, with its own Copy button. */
function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <li>
      <span className="copy-label">{label}</span>
      <span className="copy-value">
        <code>{value}</code>
        <button type="button" className="btn btn-light" onClick={copy}>
          {copied ? "Copied" : "Copy"}<span className="sr-only"> {label}</span>
        </button>
      </span>
      <span className="sr-only" aria-live="polite">{copied ? label + " copied" : ""}</span>
      {copied === false && <span className="hint">Your browser didn&apos;t allow copying. Select the address and copy it yourself.</span>}
    </li>
  );
}

function parseResult(text: string | null): SyncResult | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as SyncResult;
  } catch {
    return null;
  }
}

function resultText(r: SyncResult): string {
  if (r.ok === false) return r.message ?? r.error ?? "The last sync did not work.";
  return `${r.members ?? 0} in the class list, ${r.added ?? 0} added, ${r.left ?? 0} left`;
}

/** Courses linked to Quizplayo classes, each with "Sync class list" (from the LMS's names and roles service). */
function LinkedCourses() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Course[]>("/api/v1/admin/lti/courses").then(setCourses)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load the linked courses."));
  }, []);
  useEffect(load, [load]);

  async function sync(c: Course) {
    setBusy(c.classGroupId);
    setError(null);
    setNotice(null);
    try {
      const r = await api<{ members: number; added: number; left: number }>(
        `/api/v1/lti/classes/${encodeURIComponent(c.classGroupId)}/sync`, { method: "POST" });
      setNotice(`${c.className}: ${r.members} in the class list, ${r.added} added, ${r.left} left.`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not sync this class list.");
    }
    setBusy(null);
  }

  return (
    <section className="card stack" aria-labelledby="lti-courses">
      <h2 id="lti-courses" style={{ margin: 0 }}>Linked courses</h2>
      <p className="muted" style={{ margin: 0 }}>
        A course is linked to a Quizplayo class the first time someone opens Quizplayo from it. Its class list is copied
        from the LMS then; sync it again after students join or leave.
      </p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {!courses && !error && <LoadingState rows={3} label="Loading the linked courses" />}
      {courses && courses.length === 0 && (
        <EmptyState title="No linked courses yet">Once a teacher opens Quizplayo from a course, it shows here.</EmptyState>
      )}
      {courses && courses.length > 0 && (
        <ul className="lti-courses">
          {courses.map((c) => {
            const last = parseResult(c.lastSyncResult);
            return (
              <li key={c.classGroupId}>
                <div>
                  <strong>{c.title || c.className}</strong>
                  <div className="muted">
                    Class {c.className}{c.classCode ? ` (${c.classCode})` : ""} · {c.members} {c.members === 1 ? "member" : "members"}
                  </div>
                  {c.hasClassList ? (
                    <div className="muted">
                      {c.lastSyncAt
                        ? <>Last sync <time dateTime={c.lastSyncAt}>{new Date(c.lastSyncAt).toLocaleString()}</time>{last ? ": " + resultText(last) : ""}</>
                        : "Not synced yet"}
                    </div>
                  ) : (
                    <div className="muted">This course&apos;s LMS doesn&apos;t share its class list with Quizplayo.</div>
                  )}
                </div>
                {c.hasClassList && (
                  <button type="button" className="btn btn-light" disabled={busy !== null} onClick={() => sync(c)}>
                    {busy === c.classGroupId ? "Syncing…" : "Sync class list"}<span className="sr-only"> for {c.title || c.className}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
