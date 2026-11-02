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
  signIn: { schoolPage: string | null; portalTileLink: string };
  people: { classes: number; teachers: number; students: number; lastSyncedAt: string | null; done: boolean; fromPortal: boolean };
  bank: { quizzes: number; importedGrades: number[]; suggestedGrades: number[]; done: boolean };
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
 * "Get started" for a school's admin: details, sign-in page, people, question bank. The school is live from the
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
    setGrades((g) => (g.length > 0 ? g : s.bank.suggestedGrades.filter((x) => !s.bank.importedGrades.includes(x))));
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
                {setup.people.fromPortal ? "default colours from the school portal; set your own in Brand settings"
                  : <>set your logo, icon and colours in <a href="/admin/brand">Brand settings</a></>}
              </span>
              <span className="row" aria-label="School colours">
                {swatches.map((v) => (
                  <span key={v} title={v} style={{ width: 22, height: 22, borderRadius: 4, background: s.theme[v], border: "1px solid var(--border)" }} />
                ))}
              </span>
              {setup.people.fromPortal && (
                <button className="btn btn-light" type="button" disabled={busy !== null}
                        onClick={() => run("branding", "/api/v1/admin/setup/refresh-branding", "POST")}>
                  {busy === "branding" ? "Refreshing…" : "Refresh from school portal"}
                </button>
              )}
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
                ? "Your school signs in with its school portal accounts. Nobody needs a second password."
                : "Teachers and admins sign in with their own Quizplayo account (their email); students sign in on your school's page with the username and password you give them."}
            </p>
            <dl className="detail-grid">
              <dt>Your school&apos;s sign-in page</dt>
              <dd>{setup.signIn.schoolPage ? <a href={setup.signIn.schoolPage}>{setup.signIn.schoolPage}</a> : "Save a school code first."}</dd>
              {setup.people.fromPortal && (
                <>
                  <dt>Link for the school portal&apos;s Quizplayo tile</dt>
                  <dd><code style={{ wordBreak: "break-all" }}>{setup.signIn.portalTileLink}</code></dd>
                </>
              )}
            </dl>
          </div>
        </li>

        <li className={"step" + (setup.people.done ? " done" : "")}>
          <span className="step-number">3</span>
          <div className="card stack">
            <h2>People and classes</h2>
            {setup.people.fromPortal ? (
              <>
                <p>
                  Copied from the school portal: <strong>{setup.people.classes}</strong> classes, <strong>{setup.people.teachers}</strong>{" "}
                  teachers, <strong>{setup.people.students}</strong> students.
                  {setup.people.lastSyncedAt && <span className="muted"> Last copied {new Date(setup.people.lastSyncedAt).toLocaleString()}.</span>}
                </p>
                <div>
                  <button className="btn btn-secondary" type="button" disabled={busy !== null}
                          onClick={() => run("people", "/api/v1/admin/setup/roster-sync", "POST")}>
                    {busy === "people" ? "Copying…" : setup.people.done ? "Copy again" : "Copy classes from the school portal"}
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

        <li id="bank" className={"step" + (setup.bank.done ? " done" : "")}>
          <span className="step-number">4</span>
          <div className="card stack">
            <h2>Question bank</h2>
            <p>
              <strong>{setup.bank.quizzes}</strong> quizzes ready
              {setup.bank.importedGrades.length > 0 && <> (grades {gradesText(setup.bank.importedGrades)})</>}. Choose the
              grades to import from the 1,300-question Quizplayo bank.
            </p>
            <div className="checks">
              {GRADES.map((g) => {
                const imported = setup.bank.importedGrades.includes(g);
                const on = imported || grades.includes(g);
                return (
                  <label key={g} className={on ? "on" : undefined}>
                    <input type="checkbox" checked={on} disabled={imported}
                           onChange={() => setGrades(grades.includes(g) ? grades.filter((x) => x !== g) : [...grades, g])} />
                    {g === 0 ? "K" : "Grade " + gradeLabel(g)}
                    {imported && " ✓"}
                  </label>
                );
              })}
            </div>
            <div>
              <button className="btn btn-secondary" type="button" disabled={busy !== null || grades.length === 0}
                      onClick={async () => {
                        if (await run("bank", "/api/v1/admin/setup/bank-import", "POST", { grades })) setGrades([]);
                      }}>
                {busy === "bank" ? "Importing…" : "Import the chosen grades"}
              </button>
            </div>
          </div>
        </li>

      </ol>
    </div>
  );
}
