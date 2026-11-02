"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Started, startTab } from "@/lib/auth";
import { tokenFromHash } from "@/lib/school";
import { tabKey } from "@/lib/tab";
import { PasswordInput } from "@/components/PasswordInput";
import { PublicShell } from "@/components/ui/SiteChrome";
import { LoadingState, StatusCard } from "@/components/ui/States";

interface Invitation {
  schoolName: string;
  email: string;
  role: string;
  personName: string;
  state: "OPEN" | "EXPIRED" | "USED" | "REVOKED" | "CLOSED";
  accountReady: boolean;
}

interface Signed {
  name: string;
  account: { email: string } | null;
}

const ROLE_WORDS: Record<string, string> = {
  TEACHER: "a teacher", SCHOOL_ADMIN: "a school admin", CONTENT_REVIEWER: "a content reviewer",
};
const STORED = "isquiz:invite";

/**
 * The link in an invitation email: /invite#token=…. The token stays after '#', so it never reaches a server log.
 * It is kept in this tab while the person signs in, so they come back here to accept.
 */
export default function InvitePage() {
  const [token, setToken] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [signed, setSigned] = useState<Signed | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let t = tokenFromHash(window.location.hash);
    try {
      if (t) sessionStorage.setItem(STORED, t);
      else t = sessionStorage.getItem(STORED);
    } catch {
      // Storage may be blocked; the token from the address still works.
    }
    if (!t) {
      setError("This invitation link is incomplete. Open the link from the email again, or copy the whole address.");
      return;
    }
    setToken(t);
    if (window.location.hash) history.replaceState(null, "", "/invite");
    api<Invitation>("/api/v1/auth/invitation", { method: "POST", body: { token: t } })
      .then(setInvitation)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not open this invitation. Please try again."));
    // Only this tab's own session counts: another tab's person is someone else.
    if (tabKey()) {
      api<Signed>("/api/v1/me").then(setSigned).catch(() => setSigned(null));
    } else {
      setSigned(null);
    }
  }, []);

  if (error) {
    return (
      <PublicShell narrow>
        <StatusCard tone="problem" title="This invitation can't be opened"
                    actions={[{ label: "Sign in", href: "/sign-in", primary: true }, { label: "Get help", href: "/help" }]}>
          <p>{error}</p>
        </StatusCard>
      </PublicShell>
    );
  }
  if (!invitation || signed === undefined || !token) {
    return <PublicShell narrow><LoadingState rows={3} label="Opening your invitation" /></PublicShell>;
  }
  if (invitation.state !== "OPEN") {
    return (
      <PublicShell narrow>
        <StatusCard tone="problem" title={closedTitle(invitation.state)}
                    actions={[{ label: "Sign in", href: "/sign-in", primary: true }, { label: "Get help", href: "/help" }]}>
          <p>{closedText(invitation)}</p>
        </StatusCard>
      </PublicShell>
    );
  }

  return (
    <PublicShell narrow>
      <div className="stack">
        <div className="card stack">
          <h1 style={{ margin: 0 }}>Join {invitation.schoolName} on Quizplayo</h1>
          <p style={{ margin: 0 }}>
            {invitation.schoolName} invited <strong>{invitation.email}</strong> to join as {ROLE_WORDS[invitation.role] ?? "staff"}.
          </p>
        </div>
        <Accept token={token} invitation={invitation} signed={signed} />
      </div>
    </PublicShell>
  );
}

function Accept({ token, invitation, signed }: { token: string; invitation: Invitation; signed: Signed | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signInHere = "/sign-in?next=" + encodeURIComponent("/invite");

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<Started>("/api/v1/invitations/accept", { method: "POST", body: { token } });
      forget();
      startTab(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not accept the invitation. Please try again.");
      setBusy(false);
    }
  }

  if (signed?.account && signed.account.email === invitation.email) {
    return (
      <div className="card stack">
        <p style={{ margin: 0 }}>You&apos;re signed in as <strong>{signed.name}</strong>. {invitation.schoolName} is added to your
          account, and you can switch between your workspaces from the menu under your name.</p>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="row">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={accept}>
            {busy ? "Joining…" : "Join " + invitation.schoolName}
          </button>
        </div>
      </div>
    );
  }
  if (signed) {
    return (
      <div className="card stack">
        <div className="alert">
          This tab is signed in as <strong>{signed.account?.email ?? signed.name}</strong>, but the invitation is
          for <strong>{invitation.email}</strong>.
        </div>
        <div className="row"><a className="btn btn-primary" href={signInHere}>Sign in with {invitation.email}</a></div>
      </div>
    );
  }
  if (invitation.accountReady) {
    return (
      <div className="card stack">
        <p style={{ margin: 0 }}>{invitation.email} already has a Quizplayo account. Sign in to it, and you come back here
          to join.</p>
        <div className="row"><a className="btn btn-primary" href={signInHere}>Sign in to accept</a></div>
      </div>
    );
  }
  return <NewAccount token={token} invitation={invitation} signInHere={signInHere} />;
}

/** No confirmed account for the email yet: a name and password, and they land in the school. */
function NewAccount({ token, invitation, signInHere }: { token: string; invitation: Invitation; signInHere: string }) {
  const [name, setName] = useState(invitation.personName);
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<Started>("/api/v1/auth/login/invitation", {
        method: "POST", body: { token, name, password, acceptTerms },
      });
      forget();
      startTab(r);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not create your account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); join(); }}>
      <h2 style={{ margin: 0 }}>Choose your password</h2>
      <div className="field">
        <label htmlFor="inv-email">Email</label>
        <input id="inv-email" type="email" value={invitation.email} readOnly />
      </div>
      <div className="field">
        <label htmlFor="inv-name">Your name</label>
        <input id="inv-name" type="text" autoComplete="name" required maxLength={120} value={name}
               onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="inv-password">Password</label>
        <PasswordInput id="inv-password" value={password} onChange={setPassword} autoComplete="new-password"
                       describedBy="inv-password-hint" />
        <p className="hint" id="inv-password-hint">At least 8 characters. It works in every workspace you join.</p>
      </div>
      <label className="switch-row">
        <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
        <span>I accept the <Link href="/terms" target="_blank">terms of use</Link> and
          the <Link href="/privacy" target="_blank">privacy notice</Link>.</span>
      </label>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary" disabled={busy || !name.trim() || password.length < 8 || !acceptTerms}>
          {busy ? "Joining…" : "Join " + invitation.schoolName}
        </button>
        <a href={signInHere}>I already have a Quizplayo account</a>
      </div>
    </form>
  );
}

function forget() {
  try {
    sessionStorage.removeItem(STORED);
  } catch {
    // Nothing to forget.
  }
}

function closedTitle(state: Invitation["state"]): string {
  if (state === "USED") return "This invitation was already accepted";
  if (state === "EXPIRED") return "This invitation has expired";
  if (state === "REVOKED") return "This invitation was withdrawn";
  return "This school isn't available";
}

function closedText(i: Invitation): string {
  if (i.state === "USED") return "Sign in, and choose " + i.schoolName + " from your workspaces (the menu under your name).";
  if (i.state === "EXPIRED") return "Ask " + i.schoolName + "'s Quizplayo admin to send it again.";
  if (i.state === "REVOKED") return i.schoolName + " withdrew this invitation. Ask its Quizplayo admin if you think that's a mistake.";
  return i.schoolName + " isn't on Quizplayo at the moment, so its invitations can't be accepted.";
}
