"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { AiRunDetail, forWhom, OUTCOME, PURPOSE, RUN_STATUS, runChip, tokens, usd } from "@/lib/aiActivity";
import { when } from "@/lib/communication";
import { gradeLabel } from "@/lib/content";
import { LoadingState } from "@/components/ui/States";

const LETTERS = ["A", "B", "C", "D"];

/**
 * One AI Studio run in a native modal dialog: who asked, for whom, every draft with what became of it, and every call
 * to the AI. {@code path} is the admin's or the console's address of the run; only the console's answer has where the
 * request came from and the AI's replies (and opening it there is logged).
 */
export function AiRunDialog({ runId, path, onClose }: { runId: string; path: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<AiRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleId = "ai-run-" + runId;

  useEffect(() => {
    dialog.current?.showModal();
    api<AiRunDetail>(path).then(setDetail)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not open this AI Studio run."));
  }, [path]);

  const run = detail?.run;
  return (
    <dialog ref={dialog} className="email-dialog ai-run-dialog" aria-labelledby={titleId} onClose={onClose}>
      <div className="stack">
        <h2 id={titleId} style={{ margin: 0, fontSize: 20, overflowWrap: "anywhere" }}>{run ? run.topic : "AI Studio run"}</h2>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {!detail && !error && <LoadingState rows={4} label="Opening the run" />}
        {run && detail && (
          <>
            <dl>
              <dt>Asked by</dt>
              <dd>{run.requesterName ?? "Someone"}{run.role && <span className="muted"> · {roleText(run.role)}</span>}
                {run.requesterEmail && <div className="muted" style={{ overflowWrap: "anywhere" }}>{run.requesterEmail}</div>}</dd>
              {run.schoolName && <><dt>Workspace</dt><dd>{run.schoolName}</dd></>}
              <dt>For</dt><dd>{forWhom(run)}</dd>
              <dt>Asked on</dt><dd>{when(run.createdAt)}</dd>
              <dt>Topic</dt><dd>{gradeLabel(run.grade)} · {run.subject}{run.kind === "LESSON" && " · a lesson"}</dd>
              {run.sourceKind && run.sourceKind !== "TOPIC" && (
                <><dt>Drafted from</dt><dd>{run.sourceTitle ?? run.sourceKind}
                  {run.sourcePages ? <span className="muted"> · {run.sourcePages} {run.sourceKind === "PHOTOS" ? "photo" : "page"}{run.sourcePages === 1 ? "" : "s"}</span> : null}
                  <div className="muted">Not kept: only its title, size and fingerprint are recorded.</div></dd></>
              )}
              <dt>Status</dt><dd><span className={runChip(run.status)}>{RUN_STATUS[run.status]}</span>
                {run.errorMessage && <div className="muted">{run.errorMessage}</div>}</dd>
              {run.publishedQuizId && <><dt>Published</dt><dd>{run.publishedAt ? when(run.publishedAt) : "Yes"}</dd></>}
              <dt>Drafts</dt>
              <dd>{run.requested != null && <>{run.requested} asked for · </>}{run.received} written · {run.passed} passed the checks · {run.dropped} dropped</dd>
              <dt>AI</dt>
              <dd>{run.mode === "SAMPLE" ? "Sample mode (no AI called)" : run.model} · {run.calls} {run.calls === 1 ? "call" : "calls"} · {tokens(run.inputTokens + run.outputTokens)} tokens · {usd(run.costUsd)}</dd>
              {run.device && <><dt>Device</dt><dd>{run.device}</dd></>}
              {detail.origin && (
                <>
                  <dt>Signed in with</dt><dd>{detail.origin.signInMethod ?? "Not recorded"}</dd>
                  <dt>IP address</dt><dd>{detail.origin.clientIp ?? "Cleared after 90 days"}</dd>
                  <dt>Browser</dt><dd style={{ overflowWrap: "anywhere" }}>{detail.origin.userAgent ?? "Cleared after 90 days"}</dd>
                  <dt>Session</dt><dd><code>{detail.origin.sessionHash ?? "Not recorded"}</code></dd>
                </>
              )}
            </dl>

            <details open>
              <summary>Drafts ({detail.drafts.length})</summary>
              {detail.drafts.length === 0 && <p className="muted">No drafts were stored.</p>}
              <ol className="ai-drafts">
                {detail.drafts.map((d) => (
                  <li key={d.position}>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "baseline" }}>
                      <strong style={{ overflowWrap: "anywhere" }}>{d.draft.question}</strong>
                      <span className={d.outcome === "DROPPED" || d.checkStatus !== "PASSED" ? "chip chip-danger"
                        : d.outcome === "REMOVED" ? "chip chip-warn" : "chip chip-ok"}>
                        {d.outcome ? OUTCOME[d.outcome] : d.checkStatus === "PASSED" ? "Passed the checks" : "Dropped by a check"}
                      </span>
                    </div>
                    <ul className="ai-options">
                      {d.draft.options.map((o, i) => (
                        <li key={i}>{LETTERS[i]}) {o}{LETTERS[i] === d.draft.correctOption && <strong> (the key)</strong>}</li>
                      ))}
                    </ul>
                    {d.checkDetail && <p className="hint" style={{ margin: 0 }}>{d.checkDetail}</p>}
                    {d.finalQuestion && (
                      <p className="hint" style={{ margin: 0 }}>
                        Published as: “{d.finalQuestion.text}”
                        {d.finalQuestion.choices?.length > 0 && <> · {d.finalQuestion.choices.join(" / ")}</>}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </details>

            <details>
              <summary>Calls to the AI ({detail.calls.length})</summary>
              <div className="table-scroll" tabIndex={0} role="region" aria-labelledby={titleId + "-calls"}>
                <table className="sticky-head">
                  <caption id={titleId + "-calls"} className="sr-only">Calls to the AI, in order</caption>
                  <thead><tr><th>When</th><th>Call</th><th>Result</th><th>Asked / got</th><th>Tokens in / out</th><th>Cost</th><th>Time</th></tr></thead>
                  <tbody>
                    {detail.calls.map((c, i) => (
                      <tr key={i}>
                        <td style={{ whiteSpace: "nowrap" }}>{when(c.calledAt)}</td>
                        <td>{PURPOSE[c.purpose] ?? c.purpose}<div className="muted" style={{ fontSize: 12 }}>{c.answeredBy ?? c.model}</div></td>
                        <td>{c.status === "OK" ? "Worked" : "Failed"}{c.error && <div className="muted" style={{ fontSize: 12 }}>{c.error}</div>}</td>
                        <td>{c.asked} / {c.returned}</td>
                        <td>{tokens(c.inputTokens)} / {tokens(c.outputTokens)}</td>
                        <td>{usd(c.costUsd)}</td>
                        <td>{(c.durationMs / 1000).toFixed(1)} s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail.origin && detail.calls.map((c, i) => c.reply != null && (
                <details key={i} className="ai-reply">
                  <summary>Reply {i + 1}: {PURPOSE[c.purpose] ?? c.purpose}{c.providerId && <> · <code>{c.providerId}</code></>}</summary>
                  <pre className="email-text">{JSON.stringify(c.reply, null, 2)}</pre>
                </details>
              ))}
            </details>
          </>
        )}
        <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <form method="dialog">
            <button type="submit" className="btn btn-primary" autoFocus>Close</button>
          </form>
        </div>
      </div>
    </dialog>
  );
}

export function roleText(role: string): string {
  return role === "SCHOOL_ADMIN" ? "Admin" : role === "CONTENT_REVIEWER" ? "Content reviewer" : role === "TEACHER" ? "Teacher" : role;
}
