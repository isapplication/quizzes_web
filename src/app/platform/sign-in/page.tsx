"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Started, startTab } from "@/lib/auth";
import { PasswordInput } from "@/components/PasswordInput";
import { PublicShell } from "@/components/ui/SiteChrome";

/**
 * The platform team's sign-in to the console: their Quizplayo account's password, then a 6-digit code sent to their
 * email. Only emails on the console's allowlist get past the first step.
 */
export default function PlatformSignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"password" | "code">("password");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not sign you in. Please try again.");
    }
    setBusy(false);
  }

  const checkPassword = () => run(async () => {
    const r = await api<{ message: string }>("/api/v1/auth/login/platform", { method: "POST", body: { email, password } });
    setNotice(r.message);
    setCode("");
    setStep("code");
  });

  const verify = () => run(async () => {
    startTab(await api<Started>("/api/v1/auth/login/platform/verify", { method: "POST", body: { email, code } }));
  });

  return (
    <PublicShell narrow>
      <div className="card stack auth-card">
        <div>
          <h1 style={{ margin: 0 }}>Platform console</h1>
          <p className="muted" style={{ margin: "6px 0 0" }}>For the Quizplayo platform team. Two steps: your password, then a 6-digit code.</p>
        </div>
        {step === "password" ? (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); checkPassword(); }}>
            <div className="field">
              <label htmlFor="ps-email">Email</label>
              <input id="ps-email" type="email" autoComplete="email" required value={email}
                     onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ps-pass">Password</label>
              <PasswordInput id="ps-pass" value={password} onChange={setPassword} autoComplete="current-password" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || !email.trim() || !password}>
              {busy ? "Checking…" : "Continue"}
            </button>
          </form>
        ) : (
          <form className="stack" onSubmit={(e) => { e.preventDefault(); verify(); }}>
            {notice && <div className="alert">{notice}</div>}
            <div className="field">
              <label htmlFor="ps-code">6-digit code for {email}</label>
              <input id="ps-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required
                     value={code} onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ""))} className="code-input"
                     placeholder="123456" autoFocus />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy || code.replace(/\s/g, "").length !== 6}>
              {busy ? "Signing in…" : "Open the console"}
            </button>
            <button type="button" className="btn btn-light" onClick={() => { setStep("password"); setError(null); }}>Start again</button>
          </form>
        )}
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
      </div>
    </PublicShell>
  );
}
