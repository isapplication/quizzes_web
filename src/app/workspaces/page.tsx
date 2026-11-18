"use client";

import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { JoinSchools } from "@/components/MembershipBanners";
import { api, ApiError } from "@/lib/api";
import { Started, startTab } from "@/lib/auth";
import { useMe } from "@/lib/me";
import { LoadingState, PageHeader } from "@/components/ui/States";

interface Workspace {
  id: string;
  name: string;
  kind: "SCHOOL" | "INDEPENDENT";
  role: string;
  status: string;
  current: boolean;
}

interface Country {
  iso2: string;
  name: string;
}

const ROLE_WORDS: Record<string, string> = {
  STUDENT: "Student", TEACHER: "Teacher", SCHOOL_ADMIN: "School admin", CONTENT_REVIEWER: "Content reviewer",
};

export default function WorkspacesPage() {
  return (
    <AppFrame>
      <Workspaces />
    </AppFrame>
  );
}

/** One account, many workspaces: open or leave one, ask to join a school, or create a school. */
function Workspaces() {
  const me = useMe();
  const [list, setList] = useState<Workspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Workspace[]>("/api/v1/workspaces").then(setList)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load your workspaces."));
  }, []);

  useEffect(() => {
    if (me.account) load();
  }, [me.account, load]);

  if (!me.account) {
    return (
      <div className="stack" style={{ maxWidth: 720 }}>
        <PageHeader title="Your workspaces" />
        <div className="alert">You signed in without a Quizplayo account, so you have one workspace: {me.school.name}.</div>
      </div>
    );
  }

  async function open(w: Workspace) {
    setError(null);
    try {
      startTab(await api<Started>("/api/v1/workspaces/" + w.id + "/open", { method: "POST" }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not open that workspace.");
    }
  }

  async function leave(w: Workspace) {
    if (!window.confirm(`Leave ${w.name}? It disappears from your workspaces. Its admin can invite you again.`)) return;
    setError(null);
    setNotice(null);
    try {
      await api("/api/v1/workspaces/" + w.id + "/link", { method: "DELETE" });
      setNotice(`You left ${w.name}.`);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not do that. Please try again.");
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 820 }}>
      <PageHeader title="Your workspaces"
                  description={<>Everything you can open with <strong>{me.account.email}</strong>. Each browser tab can be in a different one.</>} />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="card stack" aria-labelledby="ws-list">
        <h2 id="ws-list" style={{ margin: 0 }}>Workspaces</h2>
        {!list && <LoadingState rows={2} label="Loading your workspaces" />}
        {list && (
          <ul className="workspace-list">
            {list.map((w) => (
              <li key={w.id}>
                <div>
                  <strong>{w.kind === "INDEPENDENT" ? "Personal: " + w.name : w.name}</strong>
                  <span className="muted"> · {w.kind === "INDEPENDENT" ? "Your own" : ROLE_WORDS[w.role] ?? w.role}
                    {w.status === "ACTIVE" ? "" : w.status === "DISABLED" ? " · switched off" : w.status === "ARCHIVED" ? " · archived" : " · paused"}</span>
                  {w.current && <span className="chip chip-ok" style={{ marginLeft: 8 }}>This tab</span>}
                </div>
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  {!w.current && w.status === "ACTIVE" && (
                    <button type="button" className="btn btn-light" onClick={() => open(w)}>Open</button>
                  )}
                  {w.kind === "SCHOOL" && !w.current && (
                    <button type="button" className="btn btn-light" onClick={() => leave(w)}>Leave</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="ws-join">
        <h2 id="ws-join" style={{ margin: 0 }}>Join a school</h2>
        <p className="muted" style={{ margin: 0 }}>
          Schools invite their teachers by email. If your school uses your email&apos;s domain on Quizplayo, you can also ask
          to join it here.
        </p>
        <JoinSchools inSchools={!!list?.some((w) => w.kind === "SCHOOL")} />
      </section>

      <CreateSchool />
    </div>
  );
}

function CreateSchool() {
  const [schoolName, setSchoolName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countries, setCountries] = useState<Country[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Country[]>("/api/v1/geo/countries").then(setCountries).catch(() => setCountries([]));
  }, []);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      startTab(await api<Started>("/api/v1/workspaces/school", { method: "POST", body: { schoolName, countryCode } }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not create the school. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form className="card stack" aria-labelledby="ws-create" onSubmit={(e) => { e.preventDefault(); create(); }}>
      <h2 id="ws-create" style={{ margin: 0 }}>Create a school</h2>
      <p className="muted" style={{ margin: 0 }}>Live at once and free. You&apos;ll be its first admin, with the same email and password.</p>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="cs-name">School name</label>
          <input id="cs-name" type="text" required maxLength={200} value={schoolName} autoComplete="organization"
                 onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g. Al Noor International School" />
        </div>
        <div className="field">
          <label htmlFor="cs-country">Country</label>
          <select id="cs-country" required value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
            <option value="" disabled>{countries.length ? "Choose a country" : "Loading countries…"}</option>
            {countries.map((c) => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={busy || schoolName.trim().length < 2 || !countryCode}>
          {busy ? "Creating…" : "Create the school"}
        </button>
      </div>
    </form>
  );
}
