"use client";

import { useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/me";
import { PageHeader } from "@/components/ui/States";

/**
 * Choosing a password: a student right after the school set or reset theirs (or whenever they like); a teacher or
 * admin for their Quizplayo account, including one who has only signed in with email codes so far.
 */
export default function PasswordPage() {
  return (
    <AppFrame>
      <ChangePassword />
    </AppFrame>
  );
}

function ChangePassword() {
  const me = useMe();
  const first = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("first") === "1";
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const account = me.account !== null;
  if (!account && me.signedInWith !== "PASSWORD") {
    return (
      <div className="stack" style={{ maxWidth: 560 }}>
        <PageHeader title="Your password" />
        <div className="alert">You sign in through your school&apos;s own system, so you have no Quizplayo password.</div>
      </div>
    );
  }

  async function save() {
    if (next !== again) {
      setError("The two new passwords are different. Type the same password twice.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/v1/auth/password", { method: "POST", body: { currentPassword: current, newPassword: next } });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not change your password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="stack" style={{ maxWidth: 560 }}>
        <PageHeader title="Password changed" />
        <div className="alert alert-success">Your new password is saved. Use it next time you sign in.</div>
        <p><a className="btn btn-primary" href="/home">Go to your home page</a></p>
      </div>
    );
  }

  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <PageHeader title={first ? "Choose your own password" : "Change your password"}
                  description={first && account
                    ? "Your code confirmed that " + me.account?.email + " is yours. For your safety, any password set "
                      + "before that was removed: choose one only you know. It works in every workspace you belong to."
                    : first ? "Your school gave you a first password. Choose one only you know."
                    : account ? "For " + me.account?.email + ". It works in every workspace you belong to." : undefined} />
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
        {!(first && account) && <div className="field">
          <label htmlFor="pw-current">{first ? "The password your school gave you" : "Current password"}</label>
          <input id="pw-current" type={show ? "text" : "password"} autoComplete="current-password" required={!account}
                 value={current} onChange={(e) => setCurrent(e.target.value)} aria-describedby={account ? "pw-current-hint" : undefined} />
          {account && <p className="hint" id="pw-current-hint">Never set one? Leave this empty.</p>}
        </div>}
        <div className="field">
          <label htmlFor="pw-new">New password</label>
          <input id="pw-new" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8}
                 value={next} onChange={(e) => setNext(e.target.value)} />
          <p className="hint">At least 8 characters. A few words together are easy to remember and hard to guess.</p>
        </div>
        <div className="field">
          <label htmlFor="pw-again">New password again</label>
          <input id="pw-again" type={show ? "text" : "password"} autoComplete="new-password" required
                 value={again} onChange={(e) => setAgain(e.target.value)} />
        </div>
        <label className="switch-row">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          <span>Show passwords</span>
        </label>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={busy || (!account && !current) || next.length < 8 || !again}>
            {busy ? "Saving…" : "Save new password"}
          </button>
        </div>
      </form>
    </div>
  );
}
