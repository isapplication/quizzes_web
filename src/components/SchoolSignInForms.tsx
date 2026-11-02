"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { nextFromUrl, Started, startTab } from "@/lib/auth";
import { PasswordInput } from "@/components/PasswordInput";

/**
 * Sign-in on a school's own page. Students use the username and password the school gave them; teachers and admins
 * sign in with their own Quizplayo account on /sign-in. The answer is this tab's own session key (see lib/tab.ts).
 */
export function SchoolSignInForms({ school, methods, portalUrl }: {
  school: string;
  methods: string[];
  portalUrl: string | null;
}) {
  const studentOk = methods.includes("PASSWORD");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      startTab(await api<Started>("/api/v1/auth/login/password", {
        method: "POST", body: { school, username, password, next: nextFromUrl() },
      }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not sign you in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {studentOk && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); signIn(); }}>
          <h3 style={{ margin: 0 }}>Students</h3>
          <div className="field">
            <label htmlFor="si-user">Username</label>
            <input id="si-user" type="text" autoComplete="username" autoCapitalize="none" required value={username}
                   onChange={(e) => setUsername(e.target.value)} placeholder="e.g. layla.a" />
          </div>
          <div className="field">
            <label htmlFor="si-pass">Password</label>
            <PasswordInput id="si-pass" value={password} onChange={setPassword} autoComplete="current-password"
                           describedBy="si-pass-hint" />
            <p className="hint" id="si-pass-hint">Your school gave you these. Forgot them? Ask your teacher to reset your password.</p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy || !username.trim() || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
        </form>
      )}

      {studentOk && <div className="divider-text">or</div>}
      <Link className="btn btn-light" href="/sign-in">Teacher or admin? Sign in with your email</Link>

      {portalUrl && <a className="btn btn-light" href={portalUrl}>Sign in with your school portal</a>}

      <p className="muted" style={{ textAlign: "center", margin: 0 }}>
        Joining a live game? <Link href="/play">Enter the game PIN</Link>, no account needed.
      </p>
    </div>
  );
}
