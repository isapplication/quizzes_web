"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { nextFromUrl, Started, startTab } from "@/lib/auth";
import { PasswordInput } from "@/components/PasswordInput";
import { PublicShell } from "@/components/ui/SiteChrome";

type Mode = "password" | "code";

/**
 * Sign-in for teachers and admins with their Quizplayo account: email and password, or a 6-digit code sent to
 * the email. It opens the workspace they used last. Students sign in on their school's page instead.
 */
export default function SignIn() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not sign you in. Please try again.");
      setBusy(false);
      return;
    }
    setBusy(false);
  }

  const signIn = () => run(async () => {
    startTab(await api<Started>("/api/v1/auth/login/account", {
      method: "POST", body: { email, password, next: nextFromUrl() },
    }));
  });

  const sendCode = () => run(async () => {
    const r = await api<{ message: string }>("/api/v1/auth/login/account/code", { method: "POST", body: { email } });
    setCodeSent(true);
    setCode("");
    setNotice(r.message);
  });

  const verify = () => run(async () => {
    startTab(await api<Started>("/api/v1/auth/login/account/code/verify", {
      method: "POST", body: { email, code, next: nextFromUrl() },
    }));
  });

  function switchMode(m: Mode) {
    setMode(m);
    setCodeSent(false);
    setError(null);
    setNotice(null);
  }

  return (
    <PublicShell narrow>
      <div className="card stack auth-card">
        <div>
          <h1 style={{ margin: 0 }}>Sign in</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>For teachers and school admins.</p>
        </div>

        {mode === "password" && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); signIn(); }}>
            <div className="field">
              <label htmlFor="in-email">Email</label>
              <input id="in-email" type="email" autoComplete="email" required value={email}
                     onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </div>
            <div className="field">
              <label htmlFor="in-pass">Password</label>
              <PasswordInput id="in-pass" value={password} onChange={setPassword} autoComplete="current-password" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || !email.trim() || !password}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <button type="button" className="btn btn-light" onClick={() => switchMode("code")}>
              Forgot your password, or never set one? Email me a code
            </button>
          </form>
        )}

        {mode === "code" && !codeSent && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); sendCode(); }}>
            <div className="field">
              <label htmlFor="in-code-email">Email</label>
              <input id="in-code-email" type="email" autoComplete="email" required value={email}
                     onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              <p className="hint">We email you a 6-digit code that works for 10 minutes.</p>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || !email.trim()}>
              {busy ? "Sending…" : "Email me a code"}
            </button>
            <button type="button" className="btn btn-light" onClick={() => switchMode("password")}>
              Use my password instead
            </button>
          </form>
        )}

        {mode === "code" && codeSent && (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); verify(); }}>
            {notice && <div className="alert">{notice}</div>}
            <div className="field">
              <label htmlFor="in-code">6-digit code sent to {email}</label>
              <input id="in-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required
                     value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} placeholder="123456"
                     className="code-input" autoFocus />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-light" onClick={() => setCodeSent(false)}>Use another email</button>
              <button type="button" className="btn btn-light" disabled={busy} onClick={sendCode}>Send a new code</button>
            </div>
          </form>
        )}

        {error && <div className="alert alert-danger" role="alert">{error}</div>}

        <div className="divider-text">New to Quizplayo?</div>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <Link className="btn btn-secondary" href="/sign-up/teacher">Sign up as a teacher</Link>
          <Link className="btn btn-secondary" href="/sign-up/school">Sign up your school</Link>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Student? <Link href="/#find-title">Find your school</Link> to sign in, or <Link href="/play">join a game with a PIN</Link>.
        </p>
      </div>
    </PublicShell>
  );
}
