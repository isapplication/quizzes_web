"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { AiRun, ConsoleAiPage, RUN_STATUS, RunStatus, tokens, usd } from "@/lib/aiActivity";
import { AiRunDialog } from "@/components/AiRunDialog";
import { AiRunTable } from "@/components/AiRunTable";
import { LoadingState } from "@/components/ui/States";

/**
 * The platform console's AI use tab: every workspace's AI Studio requests, this month's totals per workspace, and the
 * starter library's own runs beside them. Opening a request shows everything stored and is written to the audit log.
 */
export function AiConsole({ onError }: { onError: (m: string | null) => void }) {
  const [status, setStatus] = useState<"" | RunStatus>("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState<ConsoleAiPage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<AiRun | null>(null);

  const query = useCallback((before?: string) => {
    const u = new URLSearchParams();
    if (status) u.set("status", status);
    if (q) u.set("q", q);
    if (before) u.set("before", before);
    return "/api/v1/platform/ai-activity?" + u.toString();
  }, [status, q]);

  useEffect(() => {
    setPage(null);
    api<ConsoleAiPage>(query()).then(setPage)
      .catch((e: unknown) => onError(e instanceof ApiError ? e.message : "Quizplayo could not load AI use."));
  }, [query, onError]);

  async function more() {
    if (!page || page.runs.length === 0) return;
    setLoadingMore(true);
    try {
      const r = await api<ConsoleAiPage>(query(page.runs[page.runs.length - 1].createdAt));
      setPage({ ...r, runs: [...page.runs, ...r.runs] });
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Quizplayo could not load more requests.");
    }
    setLoadingMore(false);
  }

  return (
    <section className="stack" aria-labelledby="ai-use-title">
      <h2 id="ai-use-title" style={{ margin: 0 }}>AI use</h2>
      <p className="muted" style={{ margin: 0 }}>
        Every AI Studio request in every workspace: who asked, for whom, from where, each call to the AI and its cost.
        Opening a request is written to the audit log.
      </p>

      {page && (
        <div className="stack" style={{ gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>This month</h3>
          <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="ai-month-caption">
            <table className="sticky-head">
              <caption id="ai-month-caption" className="sr-only">AI cost this month per workspace, and the starter library</caption>
              <thead><tr><th>Workspace</th><th>Requests</th><th>Published</th><th>Tokens</th><th>Cost</th></tr></thead>
              <tbody>
                {page.thisMonth.map((m) => (
                  <tr key={m.tenantId}>
                    <td>{m.schoolName ?? "A workspace no longer here"}</td>
                    <td>{m.runs}</td><td>{m.published}</td><td>{tokens(m.tokens)}</td><td>{usd(m.costUsd)}</td>
                  </tr>
                ))}
                <tr>
                  <td>Starter library <span className="muted">(the Library tab)</span></td>
                  <td>{page.library.runs}</td><td className="muted">Not counted here</td><td>{tokens(page.library.tokens)}</td>
                  <td>{usd(page.library.costUsd)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <form className="library-filters" role="search" onSubmit={(e) => { e.preventDefault(); setQ(search.trim()); }}>
        <div className="field">
          <label htmlFor="aic-status">Status</label>
          <select id="aic-status" value={status} onChange={(e) => setStatus(e.target.value as "" | RunStatus)}>
            <option value="">Any status</option>
            {(Object.keys(RUN_STATUS) as RunStatus[]).map((s) => <option key={s} value={s}>{RUN_STATUS[s]}</option>)}
          </select>
        </div>
        <div className="field library-search">
          <label htmlFor="aic-q">Person or topic</label>
          <div className="row" style={{ gap: 8 }}>
            <input id="aic-q" type="search" maxLength={120} value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder="Name, address or topic" />
            <button type="submit" className="btn btn-light">Search</button>
          </div>
        </div>
      </form>

      {!page && <LoadingState rows={4} label="Loading AI use" />}
      {page && page.runs.length === 0 && <p className="muted" style={{ margin: 0 }}>No requests match.</p>}
      {page && page.runs.length > 0 && (
        <AiRunTable runs={page.runs} onOpen={setOpen} school caption="AI Studio requests in every workspace, newest first" />
      )}
      {page?.more && (
        <div className="row">
          <button type="button" className="btn btn-light" onClick={more} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Show older requests"}
          </button>
        </div>
      )}
      {open && <AiRunDialog runId={open.runId} path={"/api/v1/platform/ai-activity/" + open.runId} onClose={() => setOpen(null)} />}
    </section>
  );
}
