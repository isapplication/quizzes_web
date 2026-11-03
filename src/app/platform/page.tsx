"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmailConsole } from "@/components/EmailConsole";
import { LibraryConsole } from "@/components/LibraryConsole";
import { LocationSettings } from "@/components/LocationSettings";
import { AppFrame } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/me";
import { countryName, schoolStatus } from "@/lib/school";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";

interface Workspace {
  id: string;
  name: string;
  kind: "SCHOOL" | "INDEPENDENT";
  status: string;
  schoolCode: string | null;
  countryCode: string | null;
  city: string | null;
  planCode: string;
  createdAt: string;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerVerified: boolean;
}

interface SignUpDay {
  day: string;
  teachers: number;
  schools: number;
}

type Tab = "workspaces" | "sign-ups" | "library" | "emails" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "workspaces", label: "Schools and teachers" },
  { id: "sign-ups", label: "Sign-ups" },
  { id: "library", label: "Library" },
  { id: "emails", label: "Emails" },
  { id: "settings", label: "Settings" },
];

export default function PlatformPage() {
  return (
    <AppFrame wide>
      <PlatformConsole />
    </AppFrame>
  );
}

/**
 * The platform console: every school and teacher that signed up (no review: anyone starts at once), sign-ups per
 * day, and stepping in by suspending or closing a workspace. The Quiz API checks the allowlist on every call.
 */
function PlatformConsole() {
  const me = useMe();
  const [tab, setTab] = useState<Tab>("workspaces");
  const [plans, setPlans] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!me.platformTeam) return;
    api<{ plans: string[] }>("/api/v1/platform/options")
      .then((o) => setPlans(o.plans))
      .catch((e: unknown) => setError(message(e)));
  }, [me.platformTeam]);

  if (!me.platformTeam) {
    return (
      <div className="stack">
        <div className="alert alert-danger">This page is for the Quizplayo platform team.</div>
        <p><Link className="btn btn-primary" href="/platform/sign-in">Sign in to the platform console</Link></p>
      </div>
    );
  }

  return (
    <div className="stack">
      <PageHeader title="Platform console" description="Everyone who signed up, sign-ups per day, the shared library, and product settings." />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : undefined}
                  onClick={() => { setTab(t.id); setNotice(null); setError(null); }}>
            {t.label}
          </button>
        ))}
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}
      {tab === "workspaces" && <Workspaces plans={plans} onError={setError} onNotice={setNotice} />}
      {tab === "sign-ups" && <SignUps onError={setError} />}
      {tab === "library" && <LibraryConsole onError={setError} onNotice={setNotice} />}
      {tab === "emails" && <EmailConsole onError={setError} onNotice={setNotice} />}
      {tab === "settings" && <LocationSettings onError={setError} onNotice={setNotice} />}
    </div>
  );
}

interface Feedback {
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}

function message(e: unknown): string {
  return e instanceof ApiError ? e.message : "That did not work. Please try again.";
}

type Pending = { id: string; action: "suspend" | "close" } | null;

function Workspaces({ plans, onError, onNotice }: { plans: string[] } & Feedback) {
  const [kind, setKind] = useState<"" | "SCHOOL" | "INDEPENDENT">("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<Workspace[] | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (kind) params.set("kind", kind);
    if (query.trim()) params.set("q", query.trim());
    api<Workspace[]>("/api/v1/platform/workspaces?" + params.toString())
      .then(setList)
      .catch((e: unknown) => onError(message(e)));
  }, [kind, query, onError]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  async function act(path: string, method: string, body: unknown, done: string) {
    onError(null);
    try {
      await api(path, { method, body });
      onNotice(done);
      setPending(null);
      setReason("");
      load();
    } catch (e) {
      onError(message(e));
    }
  }

  return (
    <div className="stack">
      <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
        <div className="segmented" role="tablist" aria-label="Show">
          {([["", "All"], ["SCHOOL", "Schools"], ["INDEPENDENT", "Teachers on their own"]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? "on" : ""}
                    onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
        <input type="search" aria-label="Search by name, code or email" placeholder="Search by name, code or email"
               value={query} onChange={(e) => setQuery(e.target.value)} style={{ flex: "1 1 240px" }} />
      </div>

      {!list && <LoadingState rows={4} />}
      {list && list.length === 0 && <EmptyState title="Nobody matches">Try another search, or show everyone.</EmptyState>}
      {list && list.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Name</th><th>Kind</th><th>Signed up by</th><th>Place</th><th>Status</th><th>Plan</th><th>Joined</th><th /></tr>
            </thead>
            <tbody>
              {list.map((w) => {
                const st = schoolStatus(w.status);
                const open = pending?.id === w.id ? pending : null;
                return (
                  <tr key={w.id}>
                    <td>
                      <strong>{w.name}</strong>
                      {w.schoolCode && <div className="hint"><a href={"/s/" + w.schoolCode}>/s/{w.schoolCode}</a></div>}
                    </td>
                    <td>{w.kind === "SCHOOL" ? "School" : "Teacher"}</td>
                    <td>
                      {w.ownerName ?? "—"}
                      {w.ownerEmail && (
                        <div className="hint">{w.ownerEmail}{w.ownerVerified ? " · confirmed" : " · not confirmed yet"}</div>
                      )}
                    </td>
                    <td>{[w.city, countryName(w.countryCode)].filter(Boolean).join(", ") || "—"}</td>
                    <td><span className={"chip chip-" + st.tone}>{st.label}</span></td>
                    <td>
                      <select aria-label={"Plan for " + w.name} value={w.planCode} disabled={w.status === "CLOSED"}
                              onChange={(e) => act(`/api/v1/platform/workspaces/${w.id}/plan`, "PUT", { planCode: e.target.value },
                                `${w.name} is now on the ${e.target.value} plan.`)}>
                        {plans.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td>{new Date(w.createdAt).toLocaleDateString()}</td>
                    <td style={{ minWidth: 260 }}>
                      {open ? (
                        <div className="stack">
                          <textarea rows={2} value={reason} placeholder="Why? Kept in the audit log (10 characters or more)."
                                    aria-label="Reason" onChange={(e) => setReason(e.target.value)} />
                          <div className="row">
                            <button className="btn btn-danger" type="button" disabled={reason.trim().length < 10}
                                    onClick={() => act(`/api/v1/platform/workspaces/${w.id}/${open.action}`, "POST", { text: reason },
                                      open.action === "suspend" ? `${w.name} is suspended. Everyone there is signed out.`
                                        : `${w.name} is closed for good.`)}>
                              {open.action === "suspend" ? "Suspend now" : "Close for good"}
                            </button>
                            <button className="btn btn-light" type="button" onClick={() => setPending(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                          {w.status === "SUSPENDED" && (
                            <button className="btn btn-light" type="button"
                                    onClick={() => act(`/api/v1/platform/workspaces/${w.id}/resume`, "POST", undefined, `${w.name} is live again.`)}>
                              Resume
                            </button>
                          )}
                          {w.status === "ACTIVE" && (
                            <button className="btn btn-light" type="button" onClick={() => { setPending({ id: w.id, action: "suspend" }); setReason(""); }}>
                              Suspend…
                            </button>
                          )}
                          {w.status !== "CLOSED" && (
                            <button className="btn btn-light" type="button" onClick={() => { setPending({ id: w.id, action: "close" }); setReason(""); }}>
                              Close…
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Teachers and schools that signed up on each of the last 30 days, newest first. */
function SignUps({ onError }: { onError: (message: string | null) => void }) {
  const [days, setDays] = useState<SignUpDay[] | null>(null);

  useEffect(() => {
    api<SignUpDay[]>("/api/v1/platform/sign-ups?days=30").then(setDays).catch((e: unknown) => onError(message(e)));
  }, [onError]);

  if (!days) return <LoadingState rows={4} />;
  const most = Math.max(1, ...days.map((d) => d.teachers + d.schools));
  const teachers = days.reduce((n, d) => n + d.teachers, 0);
  const schools = days.reduce((n, d) => n + d.schools, 0);
  return (
    <div className="stack">
      <p><strong>{teachers}</strong> teachers and <strong>{schools}</strong> schools signed up in the last 30 days.</p>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Day</th><th>Teachers</th><th>Schools</th><th aria-hidden="true" /></tr></thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.day}>
                <td>{new Date(d.day + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</td>
                <td>{d.teachers}</td>
                <td>{d.schools}</td>
                <td style={{ width: "40%" }} aria-hidden="true">
                  <div className="signup-bar">
                    <span style={{ width: (100 * d.teachers) / most + "%" }} className="signup-bar-teachers" />
                    <span style={{ width: (100 * d.schools) / most + "%" }} className="signup-bar-schools" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
