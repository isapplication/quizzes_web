"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { clashWarning, type Clash, type RegistrationStatus } from "@/lib/lti";
import { schoolStatus } from "@/lib/school";
import { EmptyState, LoadingState } from "@/components/ui/States";

/** A school's LMS registration as the platform console sees it (PlatformLti.Registration). */
interface Registration {
  id: string;
  schoolId: string;
  school: string;
  schoolStatus: string;
  name: string;
  issuer: string;
  clientId: string;
  deploymentIds: string[];
  authLoginUrl: string;
  authTokenUrl: string;
  tokenAudience: string | null;
  keysetUrl: string;
  enabled: boolean;
  status: RegistrationStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  clashes: Clash[];
}

const VIEWS: [RegistrationStatus, string][] = [["PENDING", "Pending"], ["APPROVED", "Approved"], ["REJECTED", "Rejected"]];
const MAX_REASON = 500;

/**
 * Platform console → LMS registrations (decision O4): a school's LMS registration is used only once the platform team
 * approves it. Pending ones come first, the longest waiting at the top, each with its school, issuer, client ID and
 * deployment IDs, and a warning when another school registered the same issuer and client ID (the squatting case).
 * Rejecting one, or withdrawing an approval, needs a reason the school admin sees. Every decision is audited.
 */
export function LtiApprovals({ onError, onNotice }: { onError: (m: string | null) => void; onNotice: (m: string | null) => void }) {
  const [view, setView] = useState<RegistrationStatus>("PENDING");
  const [rows, setRows] = useState<Registration[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await api<Registration[]>("/api/v1/platform/lti/registrations?status=" + view));
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "The LMS registrations could not be loaded.");
    }
  }, [view, onError]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  async function decide(r: Registration, action: "approve" | "reject") {
    setBusy(r.id);
    onError(null);
    onNotice(null);
    try {
      await api<Registration>(`/api/v1/platform/lti/registrations/${encodeURIComponent(r.id)}/${action}`, {
        method: "POST",
        body: action === "approve" ? { submittedAt: r.submittedAt } : { reason: reason.trim() },
      });
      onNotice(action === "approve"
        ? `${r.school}'s LMS is approved: launches from it work now.`
        : r.status === "APPROVED"
          ? `${r.school}'s LMS approval is withdrawn. Their admin sees your reason.`
          : `${r.school}'s LMS is rejected. Their admin sees your reason.`);
      setRejecting(null);
      setReason("");
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "That did not work. Please try again.");
    }
    setBusy(null);
    load();
  }

  return (
    <section className="stack" aria-labelledby="lti-approvals">
      <h2 id="lti-approvals" style={{ margin: 0 }}>LMS registrations</h2>
      <p className="muted" style={{ margin: 0 }}>
        A school&apos;s LMS works with Quizplayo only after you approve it here. Check that the issuer and client ID really
        belong to that school&apos;s LMS: if another school registered them first, it could receive their launches.
      </p>
      <div className="segmented" role="tablist" aria-label="Show" style={{ gridTemplateColumns: "repeat(3, auto)", alignSelf: "start" }}>
        {VIEWS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? "on" : ""}
                  onClick={() => { setView(k); setRejecting(null); }}>
            {label}
          </button>
        ))}
      </div>
      {!rows && <LoadingState rows={3} label="Loading the LMS registrations" />}
      {rows && rows.length === 0 && (
        <EmptyState title={view === "PENDING" ? "No LMS registration is waiting" : "None here"}>
          {view === "PENDING" ? "When a school admin saves their LMS's details, they show here for you to approve." : "Choose another list above."}
        </EmptyState>
      )}
      {rows && rows.map((r) => (
        <RegistrationCard key={r.id} r={r} busy={busy === r.id} disabled={busy !== null}
                          rejecting={rejecting === r.id} reason={reason} onReason={setReason}
                          onStartReject={() => { setRejecting(r.id); setReason(""); }}
                          onCancelReject={() => setRejecting(null)}
                          onApprove={() => decide(r, "approve")} onReject={() => decide(r, "reject")} />
      ))}
    </section>
  );
}

function RegistrationCard({ r, busy, disabled, rejecting, reason, onReason, onStartReject, onCancelReject, onApprove, onReject }: {
  r: Registration;
  busy: boolean;
  disabled: boolean;
  rejecting: boolean;
  reason: string;
  onReason: (v: string) => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const id = useId();
  const warning = clashWarning(r.clashes);
  const held = r.clashes.some((c) => c.status === "APPROVED");
  const st = schoolStatus(r.schoolStatus);
  const reasonOk = reason.trim().length > 0 && reason.trim().length <= MAX_REASON;
  return (
    <article className="card stack lti-review" aria-labelledby={id + "-school"}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3 id={id + "-school"} style={{ margin: 0 }}>{r.school}</h3>
          <div className="hint">{r.name}</div>
        </div>
        <span className={"chip chip-" + st.tone}>School: {st.label}</span>
      </div>
      <dl>
        <dt>Issuer</dt><dd><code>{r.issuer}</code></dd>
        <dt>Client ID</dt><dd><code>{r.clientId}</code></dd>
        <dt>Deployment IDs</dt><dd>{r.deploymentIds.map((d) => <code key={d} style={{ display: "block" }}>{d}</code>)}</dd>
        <dt>Login address</dt><dd>{r.authLoginUrl}</dd>
        <dt>Token address</dt><dd>{r.authTokenUrl}</dd>
        {r.tokenAudience && <><dt>Token audience</dt><dd>{r.tokenAudience}</dd></>}
        <dt>Key set address</dt><dd>{r.keysetUrl}</dd>
        <dt>Sent for approval</dt><dd><time dateTime={r.submittedAt}>{new Date(r.submittedAt).toLocaleString()}</time></dd>
        {r.reviewedAt && (
          <>
            <dt>{r.status === "APPROVED" ? "Approved" : "Rejected"}</dt>
            <dd>
              <time dateTime={r.reviewedAt}>{new Date(r.reviewedAt).toLocaleString()}</time>
              {r.reviewedBy ? " by " + r.reviewedBy : ""}
            </dd>
          </>
        )}
        {r.reviewNote && <><dt>Reason</dt><dd>{r.reviewNote}</dd></>}
      </dl>
      {warning && <div className={"alert " + (held ? "alert-danger" : "alert-warning")}>{warning}</div>}
      {rejecting ? (
        <div className="stack">
          <label htmlFor={id + "-reason"}>
            {r.status === "APPROVED" ? "Why are you withdrawing the approval?" : "Why are you rejecting it?"}
          </label>
          <p className="hint" id={id + "-reason-hint"} style={{ margin: 0 }}>
            The school admin sees this, so say what to correct. Up to {MAX_REASON} characters.
          </p>
          <textarea id={id + "-reason"} rows={2} required maxLength={MAX_REASON} aria-describedby={id + "-reason-hint"}
                    value={reason} onChange={(e) => onReason(e.target.value)} />
          <div className="row">
            <button className="btn btn-danger" type="button" disabled={disabled || !reasonOk} onClick={onReject}>
              {busy ? "Saving…" : r.status === "APPROVED" ? "Withdraw approval" : "Reject"}
            </button>
            <button className="btn btn-light" type="button" onClick={onCancelReject}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          {r.status !== "APPROVED" && (
            <button className="btn btn-primary" type="button" disabled={disabled || held} onClick={onApprove}
                    aria-describedby={held ? id + "-held" : undefined}>
              {busy ? "Approving…" : "Approve"}<span className="sr-only"> {r.school}&apos;s LMS</span>
            </button>
          )}
          {r.status !== "REJECTED" && (
            <button className="btn btn-light" type="button" disabled={disabled} onClick={onStartReject}>
              {r.status === "APPROVED" ? "Withdraw approval…" : "Reject…"}<span className="sr-only"> {r.school}&apos;s LMS</span>
            </button>
          )}
          {held && <span className="hint" id={id + "-held"}>Another school&apos;s approved registration uses this issuer and client ID.</span>}
        </div>
      )}
    </article>
  );
}
