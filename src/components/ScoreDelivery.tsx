"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { LoadingState } from "@/components/ui/States";

/** How the scores on their way to another system are doing (the score outbox): sent, waiting, failed. */
export interface ScoreSummary {
  sent: number;
  waiting: number;
  failed: number;
  lastError: string | null;
  lastErrorAt: string | null;
}

/**
 * Scores Quizplayo sends to another system (the school's own system, or the LMS gradebook): the counts, the last
 * problem with its time, and "Try again", which puts the failed ones back in the queue. {@code path} is the summary's
 * address; {@code path + "/retry"} retries.
 */
export function ScoreDelivery({ path, title, description }: { path: string; title: string; description: React.ReactNode }) {
  const headingId = useId();
  const [summary, setSummary] = useState<ScoreSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<ScoreSummary>(path).then(setSummary)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load how the scores are going."));
  }, [path]);
  useEffect(load, [load]);

  async function retry() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const s = await api<ScoreSummary>(path + "/retry", { method: "POST" });
      setSummary(s);
      setNotice("The scores that failed are waiting to be sent again.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not try again. Please try again in a minute.");
    }
    setBusy(false);
  }

  return (
    <section className="card stack" aria-labelledby={headingId}>
      <h2 id={headingId} style={{ margin: 0 }}>{title}</h2>
      <p className="muted" style={{ margin: 0 }}>{description}</p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {!summary && !error && <LoadingState rows={2} label="Loading the scores" />}
      {summary && (
        <>
          <dl className="score-counts">
            <div><dt>Scores sent (last 14 days)</dt><dd>{summary.sent}</dd></div>
            <div><dt>Waiting</dt><dd>{summary.waiting}</dd></div>
            <div className={summary.failed > 0 ? "failed" : undefined}>
              <dt>Failed</dt><dd>{summary.failed}{summary.failed > 0 && <span className="sr-only"> (need trying again)</span>}</dd>
            </div>
          </dl>
          {summary.lastError && (
            <div className="alert alert-warning">
              <strong>Last problem</strong>
              {summary.lastErrorAt && (
                <> <span className="muted">· <time dateTime={summary.lastErrorAt}>{new Date(summary.lastErrorAt).toLocaleString()}</time></span></>
              )}
              <p style={{ margin: "4px 0 0", overflowWrap: "anywhere" }}>{summary.lastError}</p>
            </div>
          )}
          {summary.failed > 0 && (
            <div className="row">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={retry}>
                {busy ? "Trying again…" : "Try again"}
              </button>
              <span className="hint" style={{ margin: 0 }}>Sends the {summary.failed} failed {summary.failed === 1 ? "score" : "scores"} again.</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
