"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Started, startTab } from "@/lib/auth";
import { isStaff, useMe } from "@/lib/me";
import { PasswordInput } from "@/components/PasswordInput";

interface Suggestion {
  tenantId: string;
  name: string;
  city: string | null;
  request: "PENDING" | "DECLINED" | null;
}

interface Suggestions {
  verified: boolean;
  domain: string | null;
  schools: Suggestion[];
}

const DISMISSED = "isquiz:join-dismissed";

function useSuggestions(enabled: boolean) {
  const [data, setData] = useState<Suggestions | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    api<Suggestions>("/api/v1/join-requests/suggestions").then(setData)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not look for your school."));
  }, [enabled]);
  return { data, setData, error };
}

async function askToJoin(s: Suggestion, message: string): Promise<string | null> {
  try {
    await api("/api/v1/join-requests", { method: "POST", body: { tenantId: s.tenantId, message: message || null } });
    return null;
  } catch (e) {
    return e instanceof ApiError ? e.message : "Quizplayo could not send your request. Please try again.";
  }
}

/** "Join a school" on the workspaces page: schools that claimed the account's email domain, with "Ask to join". */
export function JoinSchools({ inSchools = false }: { inSchools?: boolean }) {
  const { data, setData, error } = useSuggestions(true);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  if (error) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!data) return <p className="muted" style={{ margin: 0 }}>Looking for your school…</p>;
  if (!data.verified) {
    return <div className="alert">Confirm your email first (use the link we sent you; it&apos;s also in <a href="/communication">Communication</a>). Then schools that use your email&apos;s domain show here.</div>;
  }
  if (data.schools.length === 0) {
    return (
      <p style={{ margin: 0 }}>
        {inSchools ? "No other school" : "No school"} on Quizplayo uses <strong>@{data.domain}</strong>
        {inSchools ? " that you're not part of already" : " yet"}. Ask your school&apos;s Quizplayo admin to invite you.
      </p>
    );
  }

  async function ask(s: Suggestion) {
    setProblem(null);
    const p = await askToJoin(s, message);
    if (p) setProblem(p);
    else setData({ ...data!, schools: data!.schools.map((x) => x.tenantId === s.tenantId ? { ...x, request: "PENDING" } : x) });
  }

  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="join-message">A note for the school&apos;s admins (optional)</label>
        <input id="join-message" type="text" maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)}
               placeholder="e.g. I teach Grade 6 science." />
      </div>
      <ul className="workspace-list">
        {data.schools.map((s) => (
          <li key={s.tenantId}>
            <div><strong>{s.name}</strong>{s.city && <span className="muted"> · {s.city}</span>}</div>
            {s.request === "PENDING" ? <span className="chip">Asked: waiting for its admins</span>
              : s.request === "DECLINED" ? <span className="chip chip-warn">Its admins declined</span>
              : <button type="button" className="btn btn-primary" onClick={() => ask(s)}>Ask to join</button>}
          </li>
        ))}
      </ul>
      {problem && <div className="alert alert-danger" role="alert">{problem}</div>}
    </div>
  );
}

/** On the dashboard: "Is <school> your school?" for a confirmed email on a school's domain, until dismissed. */
export function JoinSuggestion() {
  const me = useMe();
  const enabled = !!me.account?.verified && isStaff(me);
  const { data, setData } = useSuggestions(enabled);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [asked, setAsked] = useState<string | null>(null);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(DISMISSED) ?? "[]"));
    } catch {
      setDismissed([]);
    }
  }, []);

  if (asked) return <div className="alert alert-success" role="status">{asked}</div>;
  const s = data?.schools.find((x) => x.request === null && !dismissed.includes(x.tenantId));
  if (!enabled || !s) return null;

  function dismiss() {
    const next = [...dismissed, s!.tenantId];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISSED, JSON.stringify(next));
    } catch {
      // Only hidden for now.
    }
  }

  async function ask() {
    setProblem(null);
    const p = await askToJoin(s!, "");
    if (p) {
      setProblem(p);
    } else {
      setData({ ...data!, schools: data!.schools.map((x) => x.tenantId === s!.tenantId ? { ...x, request: "PENDING" } : x) });
      setAsked(`Asked to join ${s!.name}. Its admins will decide; you'll get an email when they accept.`);
    }
  }

  return (
    <div className="alert home-callout" role="region" aria-label="Your school on Quizplayo">
      <span>Is <strong>{s.name}</strong> your school? It uses <strong>@{data!.domain}</strong> on Quizplayo.
        {problem && <><br /><span role="alert">{problem}</span></>}</span>
      <span className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={ask}>Ask to join</button>
        <button type="button" className="btn btn-light" onClick={dismiss}>Not my school</button>
      </span>
    </div>
  );
}

/**
 * On the dashboard of a teacher who came from their school's own system, when their school email already has a
 * confirmed Quizplayo account: link the two by proving the account once (its password, or a code by email).
 */
export function LinkAccountOffer() {
  const me = useMe();
  const enabled = !me.account && isStaff(me);
  const [offer, setOffer] = useState<{ offer: boolean; email: string | null } | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [mode, setMode] = useState<"password" | "code">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    api<{ offer: boolean; email: string | null }>("/api/v1/account-link").then(setOffer).catch(() => setOffer(null));
  }, [enabled]);

  if (!enabled || !offer?.offer) return null;

  async function start() {
    setBusy(true);
    setError(null);
    try {
      setLinkToken((await api<{ linkToken: string }>("/api/v1/account-link/start", { method: "POST" })).linkToken);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not start linking. Please try again.");
    }
    setBusy(false);
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ message: string }>("/api/v1/account-link/code", { method: "POST", body: { linkToken } });
      setMode("code");
      setNotice(r.message);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not send the code. Please try again.");
    }
    setBusy(false);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<Started>("/api/v1/account-link/confirm", {
        method: "POST", body: mode === "code" ? { linkToken, code } : { linkToken, password },
      });
      startTab(r);
    } catch (e) {
      if (e instanceof ApiError && e.code === "link_expired") setLinkToken(null);
      setError(e instanceof ApiError ? e.message : "Quizplayo could not link your account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="card stack" role="region" aria-label="Link your Quizplayo account">
      <p style={{ margin: 0 }}>
        You already have a Quizplayo account with <strong>{offer.email}</strong>. Link it to {me.school.name} to switch
        between them without signing in again.
      </p>
      {!linkToken ? (
        <div className="row"><button type="button" className="btn btn-primary" disabled={busy} onClick={start}>Link my account</button></div>
      ) : (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); confirm(); }}>
          {notice && <div className="alert alert-success">{notice}</div>}
          {mode === "password" ? (
            <div className="field">
              <label htmlFor="link-password">Your Quizplayo password</label>
              <PasswordInput id="link-password" value={password} onChange={setPassword} autoComplete="current-password" />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="link-code">The 6-digit code</label>
              <input id="link-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required
                     value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            </div>
          )}
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <button type="submit" className="btn btn-primary" disabled={busy || (mode === "password" ? !password : code.length !== 6)}>
              {busy ? "Linking…" : "Link"}
            </button>
            {mode === "password" && (
              <button type="button" className="btn btn-light" disabled={busy} onClick={sendCode}>Email me a code instead</button>
            )}
          </div>
        </form>
      )}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <p className="hint" style={{ margin: 0 }}>Changed your mind later? Leave the school under <Link href="/workspaces">Your workspaces</Link>.</p>
    </div>
  );
}
