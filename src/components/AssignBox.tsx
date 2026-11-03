"use client";

import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { AssignmentSummary, dueText } from "@/lib/assignments";
import { isIndependent, useMe } from "@/lib/me";
import type { HostTarget } from "@/components/HostGame";

/**
 * "Assign it": the same quiz done at each student's own pace instead of live. For a class (its students see it on
 * their home page) or anyone with the link, with an optional due time; then the link to share.
 */
export function AssignBox({ target }: { target: HostTarget }) {
  const me = useMe();
  const school = !isIndependent(me);
  const [classCode, setClassCode] = useState("");
  const [signedInOnly, setSignedInOnly] = useState(false);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<AssignmentSummary | null>(null);
  const [copied, setCopied] = useState(false);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setMade(await api<AssignmentSummary>("/api/v1/assignments", {
        method: "POST",
        body: {
          ...target, classCode: classCode || null, requireSignIn: school && signedInOnly,
          // The picker gives local time; the API wants an instant.
          dueAt: due ? new Date(due).toISOString() : null,
        },
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Quizplayo could not make the assignment. Please try again.");
    }
    setBusy(false);
  }

  async function copy() {
    if (!made) return;
    try {
      await navigator.clipboard.writeText(made.link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (made) {
    return (
      <div className="card stack" aria-live="polite">
        <h2>Assigned</h2>
        <p style={{ margin: 0 }}>
          Students open this link and do it at their own pace{made.classCode && <> (class {made.classCode} also sees it on their home page)</>}.
          {made.dueAt && <> {dueText(made.dueAt)}.</>}
        </p>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <input type="text" readOnly value={made.link} aria-label="Assignment link" style={{ flex: "1 1 260px", minWidth: 0 }}
                 onFocus={(e) => e.target.select()} />
          <button type="button" className="btn btn-primary" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
        </div>
        <p style={{ margin: 0 }}>
          <Link href={"/teacher/assignments/" + made.assignmentId}>See who has done it</Link> ·{" "}
          <button type="button" className="btn-inline" onClick={() => { setMade(null); setCopied(false); }}>Assign it again</button>
        </p>
      </div>
    );
  }

  return (
    <form className="card stack" onSubmit={assign}>
      <h2>Assign it</h2>
      <p className="muted" style={{ margin: 0 }}>
        Each student does it on their own device, at their own pace, with no timer. You see everyone&apos;s answers afterwards.
      </p>
      <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        {school && me.classes.length > 0 && (
          <div className="field">
            <label htmlFor="assign-class">For</label>
            <select id="assign-class" value={classCode} onChange={(e) => setClassCode(e.target.value)}>
              <option value="">Anyone with the link</option>
              {me.classes.map((c) => <option key={c} value={c}>Class {c}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="assign-due">Due (optional)</label>
          <input id="assign-due" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
      {school && (
        <label className="check">
          <input type="checkbox" checked={signedInOnly} onChange={(e) => setSignedInOnly(e.target.checked)} />
          <span>Only signed-in students of {me.school.name} <span className="muted">(results saved to each student)</span></span>
        </label>
      )}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="row">
        <button type="submit" className="btn btn-secondary" disabled={busy}>{busy ? "Assigning…" : "Assign"}</button>
      </div>
    </form>
  );
}
