"use client";

import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { isIndependent, isSchoolAdmin, useMe } from "@/lib/me";
import { GRADES, gradeLabel, gradesText, schoolStatus } from "@/lib/school";
import { PageHeader } from "@/components/ui/States";

interface Setup {
  school: {
    id: string;
    name: string;
    status: string;
    kind: "SCHOOL" | "INDEPENDENT";
    schoolCode: string | null;
    countryCode: string | null;
    city: string | null;
    planCode: string;
    theme: Record<string, string>;
    grades: number[];
  };
  signIn: { schoolPage: string | null };
  people: { classes: number; teachers: number; students: number; lastSyncedAt: string | null; done: boolean; fromPortal: boolean };
  grades: { grades: number[]; done: boolean };
  brandDone: boolean;
  live: boolean;
  dismissed: boolean;
  countries: Record<string, string>;
}

export default function SetupPage() {
  return (
    <AppFrame>
      <SchoolSetup />
    </AppFrame>
  );
}

/**
 * "Get started" for a school's admin: details, sign-in page, people, the school's grades. The school is live from the
 * start; every step is optional and the admin can skip the checklist.
 */
function SchoolSetup() {
  const me = useMe();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [details, setDetails] = useState({ schoolCode: "", countryCode: "", city: "" });
  const [grades, setGrades] = useState<number[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  const show = useCallback((s: Setup) => {
    setSetup(s);
    setDetails({ schoolCode: s.school.schoolCode ?? "", countryCode: s.school.countryCode ?? "", city: s.school.city ?? "" });
    setGrades(s.grades.grades);
  }, []);

  useEffect(() => {
    if (!isSchoolAdmin(me)) return;
    api<Setup>("/api/v1/admin/setup")
      .then(show)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your school's setup."));
  }, [me, show]);

  async function run(step: string, path: string, method: string, body?: unknown) {
    setBusy(step);
    setError(null);
    setSaved(null);
    try {
      show(await api<Setup>(path, { method, body }));
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not work. Please try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  /** The grades go through the same call as the home page's first-landing picker, then the checklist reloads. */
  async function saveGrades() {
    setBusy("grades");
    setError(null);
    setSaved(null);
    try {
      await api("/api/v1/workspace/grades", { method: "POST", body: { grades } });
      show(await api<Setup>("/api/v1/admin/setup"));
      setSaved("Grades saved.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not save the grades. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!isSchoolAdmin(me) || isIndependent(me)) {
    return <div className="alert alert-danger">Only a school&apos;s Quizplayo admins can open this checklist.</div>;
  }
  if (!setup) {
    return error ? <div className="alert alert-danger">{error}</div> : <p className="muted">Loading your school&apos;s setup…</p>;
  }

  const s = setup.school;
  const status = schoolStatus(s.status);
  const swatches = ["--pc", "--sc", "--tc", "--fc", "--flc"].filter((v) => s.theme[v]);

  return (
    <div className="stack">
      <PageHeader title={"Get started with Quizplayo at " + s.name}
                  description="Your school is live. These steps are optional: do them now, later, or not at all."
                  action={<span className={"chip chip-" + status.tone}>{status.label}</span>} />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <a className="btn btn-primary" href="/home">Go to your home page</a>
        <button className="btn btn-light" type="button" disabled={busy !== null}
                onClick={async () => {
                  if (await run("dismiss", "/api/v1/admin/setup/dismiss", "POST", { dismissed: !setup.dismissed })) {
                    setSaved(setup.dismissed ? "The checklist is back on your home page." : "Skipped. You can come back here from the Get started link at any time.");
                  }
                }}>
          {setup.dismissed ? "Show this checklist again" : "Skip the checklist for now"}
        </button>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {saved && <div className="alert alert-success">{saved}</div>}

      <ol className="steps">
        <li className="step done">
          <span className="step-number">1</span>
          <div className="card stack">
            <h2>Your school</h2>
            <div className="row">
              <span>
                <strong>{s.name}</strong> ·{" "}
                set your logo, icon and colours in <a href="/admin/brand">Brand settings</a>
              </span>
              <span className="row" aria-label="School colours">
                {swatches.map((v) => (
                  <span key={v} title={v} style={{ width: 22, height: 22, borderRadius: 4, background: s.theme[v], border: "1px solid var(--border)" }} />
                ))}
              </span>
            </div>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="schoolCode">School code</label>
                <input id="schoolCode" type="text" value={details.schoolCode} maxLength={40}
                       onChange={(e) => setDetails({ ...details, schoolCode: e.target.value })} />
                <p className="hint">
                  Used in your school&apos;s sign-in link. Lower-case letters, digits and hyphens. Changing it stops the old link working.
                </p>
              </div>
              <div className="field">
                <label htmlFor="countryCode">Country</label>
                <select id="countryCode" value={details.countryCode}
                        onChange={(e) => setDetails({ ...details, countryCode: e.target.value })}>
                  <option value="">Not set</option>
                  {Object.entries(setup.countries).map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="city">City</label>
                <input id="city" type="text" value={details.city} maxLength={100}
                       onChange={(e) => setDetails({ ...details, city: e.target.value })} />
              </div>
            </div>
            <div>
              <button className="btn btn-secondary" type="button" disabled={busy !== null}
                      onClick={async () => {
                        if (await run("details", "/api/v1/admin/setup/school", "PUT", details)) setSaved("School details saved.");
                      }}>
                {busy === "details" ? "Saving…" : "Save details"}
              </button>
            </div>
          </div>
        </li>

        <li className="step done">
          <span className="step-number">2</span>
          <div className="card stack">
            <h2>Sign-in</h2>
            <p>
              {setup.people.fromPortal
                ? "Your school's own system signs people in to Quizplayo. Nobody needs a second password."
                : "Teachers and admins sign in with their own Quizplayo account (their email); students sign in on your school's page with the username and password you give them."}
            </p>
            <dl className="detail-grid">
              <dt>Your school&apos;s sign-in page</dt>
              <dd>{setup.signIn.schoolPage ? <a href={setup.signIn.schoolPage}>{setup.signIn.schoolPage}</a> : "Save a school code first."}</dd>
              <dt>Your school&apos;s own system</dt>
              <dd><a href="/admin/connected-system">{setup.people.fromPortal ? "Connected: see its settings" : "Connect it (optional)"}</a></dd>
              <dt>Your LMS (LTI 1.3)</dt>
              <dd><a href="/admin/lti">Connect it (optional)</a></dd>
            </dl>
            <EmailDomainsSetting />
          </div>
        </li>

        <li className={"step" + (setup.people.done ? " done" : "")}>
          <span className="step-number">3</span>
          <div className="card stack">
            <h2>People and classes</h2>
            {setup.people.fromPortal ? (
              <>
                <p>
                  Copied from your school&apos;s system: <strong>{setup.people.classes}</strong> classes, <strong>{setup.people.teachers}</strong>{" "}
                  teachers, <strong>{setup.people.students}</strong> students.
                  {setup.people.lastSyncedAt && <span className="muted"> Last copied {new Date(setup.people.lastSyncedAt).toLocaleString()}.</span>}
                </p>
                <div>
                  <button className="btn btn-secondary" type="button" disabled={busy !== null}
                          onClick={() => run("people", "/api/v1/admin/setup/roster-sync", "POST")}>
                    {busy === "people" ? "Copying…" : setup.people.done ? "Copy again" : "Copy people now"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>
                  <strong>{setup.people.teachers}</strong> teachers, <strong>{setup.people.students}</strong> students and{" "}
                  <strong>{setup.people.classes}</strong> classes so far. Add them one by one or from a CSV file. Students can
                  also join live games with the game PIN.
                </p>
                <div>
                  <a className="btn btn-secondary" href="/admin/people">{setup.people.done ? "Manage people" : "Add your people"}</a>
                </div>
              </>
            )}
          </div>
        </li>

        <li id="grades" className={"step" + (setup.grades.done ? " done" : "")}>
          <span className="step-number">4</span>
          <div className="card stack">
            <h2>Grades</h2>
            <p>
              {setup.grades.done
                ? <>Your school teaches {gradesText(setup.grades.grades)}. Every teacher&apos;s home page shows ready-made
                  quizzes for these grades from the Quizplayo library.</>
                : <>Choose the grades your school teaches. Every teacher&apos;s home page then shows ready-made quizzes for
                  them from the Quizplayo library.</>}
            </p>
            <div className="checks">
              {GRADES.map((g) => {
                const on = grades.includes(g);
                return (
                  <label key={g} className={on ? "on" : undefined}>
                    <input type="checkbox" checked={on}
                           onChange={() => setGrades(on ? grades.filter((x) => x !== g) : [...grades, g])} />
                    {g === 0 ? "K" : "Grade " + gradeLabel(g)}
                  </label>
                );
              })}
            </div>
            <div>
              <button className="btn btn-secondary" type="button" disabled={busy !== null || grades.length === 0}
                      onClick={saveGrades}>
                {busy === "grades" ? "Saving…" : "Save grades"}
              </button>
            </div>
          </div>
        </li>

      </ol>
    </div>
  );
}

interface Domains {
  domains: string[];
  yourDomain: string | null;
  canClaim: boolean;
  whyNot: string | null;
}

/** Teachers with a confirmed email on these domains are offered "Ask to join" (an admin still decides). */
function EmailDomainsSetting() {
  const [d, setD] = useState<Domains | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Domains>("/api/v1/admin/email-domains").then(setD)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your email domains."));
  }, []);

  async function change(path: string, body?: unknown) {
    setError(null);
    try {
      setD(await api<Domains>(path, { method: "POST", body }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not save that. Please try again.");
    }
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      <h3 style={{ margin: 0 }}>Your school&apos;s email domain</h3>
      <p className="muted" style={{ margin: 0 }}>
        Teachers who sign up with an email on it see &quot;Is this your school? Ask to join&quot;, and you accept or decline
        them under People.
      </p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {d && (
        <>
          {d.domains.length > 0 ? (
            <ul className="workspace-list">
              {d.domains.map((x) => (
                <li key={x}>
                  <strong>@{x}</strong>
                  <button type="button" className="btn btn-light" onClick={() => change("/api/v1/admin/email-domains/drop", { domain: x })}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : <p style={{ margin: 0 }}>None yet.</p>}
          {d.canClaim && d.yourDomain && (
            <div>
              <button type="button" className="btn btn-secondary" onClick={() => change("/api/v1/admin/email-domains/claim")}>
                Add @{d.yourDomain}
              </button>
            </div>
          )}
          {d.whyNot && <p className="hint" style={{ margin: 0 }}>{d.whyNot}</p>}
        </>
      )}
    </div>
  );
}
