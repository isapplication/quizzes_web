"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { Started, startTab } from "@/lib/auth";
import { tokenFromHash } from "@/lib/school";
import { PasswordInput } from "@/components/PasswordInput";
import { PublicShell } from "@/components/ui/SiteChrome";
import { LoadingState, StatusCard } from "@/components/ui/States";

interface Lookup {
  state: "OK" | "USED" | "EXPIRED" | "CLOSED";
  name: string;
  username: string;
  schoolName: string;
}

/**
 * A student's invite link: /choose-password#token=…. The token stays after '#', so it never reaches a server log.
 * The student chooses their own password (nobody else ever knows it) and is signed in.
 */
export default function ChoosePasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const t = tokenFromHash(window.location.hash);
    if (!t) { setMissing(true); return; }
    setToken(t);
    api<Lookup>("/api/v1/auth/student-invite/lookup", { method: "POST", body: { token: t } })
      .then(setLookup)
      .catch((e: unknown) => { setMissing(true); setError(e instanceof ApiError ? e.message : null); });
  }, []);

  async function choose(e: FormEvent) {
    e.preventDefault();
    if (password !== again) { setError("The two passwords are different. Type the same password in both boxes."); return; }
    setBusy(true);
    setError(null);
    try {
      startTab(await api<Started>("/api/v1/auth/student-invite/accept", { method: "POST", body: { token, password } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Quizplayo could not save your password. Please try again.");
      setBusy(false);
    }
  }

  return (
    <PublicShell narrow>
      {missing && (
        <StatusCard tone="problem" title="This link can't be opened">
          {error ?? "Check that you opened the whole link, or ask your teacher for a new one."}
        </StatusCard>
      )}
      {!missing && !lookup && <LoadingState rows={2} label="Opening your link" />}
      {lookup && lookup.state !== "OK" && (
        <StatusCard tone="problem" title={lookup.state === "USED" ? "This link was already used" : lookup.state === "EXPIRED" ? "This link no longer works" : "Quizplayo isn't open for you right now"}>
          {lookup.state === "USED"
            ? "Sign in with your username and the password you chose. If you forgot it, ask your teacher for a new link."
            : lookup.state === "EXPIRED"
              ? "It is too old, or a newer link was made. Ask your teacher for a new one."
              : "Ask your teacher."}
        </StatusCard>
      )}
      {lookup && lookup.state === "OK" && (
        <form className="card stack" onSubmit={choose} aria-labelledby="choose-title">
          <h1 id="choose-title" style={{ margin: 0, fontSize: 24 }}>Hello, {lookup.name}</h1>
          <p style={{ margin: 0 }}>Choose your password for Quizplayo at <strong>{lookup.schoolName}</strong>. Your username is <strong>{lookup.username}</strong>.</p>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <div className="field">
            <label htmlFor="choose-password">Your new password</label>
            <PasswordInput id="choose-password" value={password} onChange={setPassword} autoComplete="new-password" describedBy="choose-hint" />
            <div id="choose-hint" className="hint">At least 8 characters. Keep it to yourself.</div>
          </div>
          <div className="field">
            <label htmlFor="choose-again">Type it again</label>
            <PasswordInput id="choose-again" value={again} onChange={setAgain} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || password.length === 0}>
            {busy ? "Saving…" : "Save and open Quizplayo"}
          </button>
        </form>
      )}
    </PublicShell>
  );
}
