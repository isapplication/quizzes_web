"use client";

import { useCallback, useEffect, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { AiRunDialog } from "@/components/AiRunDialog";
import { AiRunTable } from "@/components/AiRunTable";
import { api, ApiError } from "@/lib/api";
import { AiRun, RUN_STATUS, RunStatus, SchoolPage, usd } from "@/lib/aiActivity";
import { isSchoolAdmin, useMe } from "@/lib/me";
import { EmptyState, LoadingState, PageHeader } from "@/components/ui/States";

export default function AiUsePage() {
  return (
    <AppFrame wide>
      <AiUse />
    </AppFrame>
  );
}

/** The school admin's view of AI Studio: who used it, for which class, and what became of the drafts. */
function AiUse() {
  const me = useMe();
  const [person, setPerson] = useState("");
  const [status, setStatus] = useState<"" | RunStatus>("");
  const [page, setPage] = useState<SchoolPage | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [open, setOpen] = useState<AiRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useCallback((before?: string) => {
    const u = new URLSearchParams();
    if (person) u.set("person", person);
    if (status) u.set("status", status);
    if (before) u.set("before", before);
    return "/api/v1/admin/ai-activity?" + u.toString();
  }, [person, status]);

  useEffect(() => {
    if (!isSchoolAdmin(me)) return;
    setPage(null);
    setError(null);
    api<SchoolPage>(query()).then(setPage)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load AI use."));
  }, [me, query]);

  if (!isSchoolAdmin(me)) {
    return <div className="alert alert-danger">AI use is for your school&apos;s Quizplayo admins.</div>;
  }

  async function more() {
    if (!page || page.runs.length === 0) return;
    setLoadingMore(true);
    try {
      const r = await api<SchoolPage>(query(page.runs[page.runs.length - 1].createdAt));
      setPage({ ...r, runs: [...page.runs, ...r.runs] });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not load more runs.");
    }
    setLoadingMore(false);
  }

  return (
    <div className="stack">
      <PageHeader title="AI use"
                  description="Every time someone in your workspace asks AI Studio for questions: who asked, for which class, what the AI wrote, and what they kept." />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {page && (
        <div className="email-stats" aria-label="The last 30 days">
          <div className="stat"><strong>{page.last30Days.runs}</strong>Requests, last 30 days</div>
          <div className="stat"><strong>{page.last30Days.published}</strong>Published as quizzes</div>
          <div className="stat"><strong>{page.last30Days.questionsPassed}</strong>Questions that passed the checks</div>
          <div className="stat"><strong>{usd(page.last30Days.costUsd)}</strong>AI cost</div>
        </div>
      )}

      <form className="library-filters" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="ai-person">Person</label>
          <select id="ai-person" value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Everyone</option>
            {page?.people.map((p) => <option key={p.userId} value={p.userId}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ai-status">Status</label>
          <select id="ai-status" value={status} onChange={(e) => setStatus(e.target.value as "" | RunStatus)}>
            <option value="">Any status</option>
            {(Object.keys(RUN_STATUS) as RunStatus[]).map((s) => <option key={s} value={s}>{RUN_STATUS[s]}</option>)}
          </select>
        </div>
      </form>

      {!page && !error && <LoadingState rows={4} label="Loading AI use" />}
      {page && page.runs.length === 0 && (
        <EmptyState title="Nobody has used AI Studio yet">
          When a teacher asks AI Studio for questions, it shows here.
        </EmptyState>
      )}
      {page && page.runs.length > 0 && <AiRunTable runs={page.runs} onOpen={setOpen} caption="AI Studio requests in your workspace, newest first" />}
      {page?.more && (
        <div className="row">
          <button type="button" className="btn btn-light" onClick={more} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Show older requests"}
          </button>
        </div>
      )}
      {open && <AiRunDialog runId={open.runId} path={"/api/v1/admin/ai-activity/" + open.runId} onClose={() => setOpen(null)} />}
    </div>
  );
}
