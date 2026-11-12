"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/aiStudio";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { type AiUsageRow, limitText, providerModelText } from "@/lib/aiSettings";

/**
 * Platform console → AI (byok-ai-contract.md, section 3): read-only. Each workspace pays for its own AI with its own
 * provider key, so Quizplayo sets no ceiling: this shows each workspace's provider and model (or that it hasn't set up
 * AI), its own monthly limit, what it spent this month (UTC) on its key, and its runs. A key is never shown.
 */
export function AiCeilings({ onError }: { onError: (m: string | null) => void }) {
  const id = useId();
  const [rows, setRows] = useState<AiUsageRow[] | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async (q: string) => {
    try {
      setRows(await api<AiUsageRow[]>("/api/v1/platform/ai/ceilings" + (q.trim() ? "?q=" + encodeURIComponent(q.trim()) : "")));
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "The workspaces' AI use could not be loaded.");
    }
  }, [onError]);

  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  return (
    <section className="card stack" aria-labelledby={id + "-h"}>
      <h2 id={id + "-h"}>AI by workspace</h2>
      <p className="muted" style={{ margin: 0 }}>
        Each workspace uses its own AI provider key, set by its admin in AI settings, and pays its provider directly.
        This month (UTC): its provider and model, its own monthly limit, and what it has spent on its key.
      </p>
      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor={id + "-q"}>Find a workspace</label>
        <input id={id + "-q"} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </div>
      {rows === null ? <LoadingState rows={3} label="Loading the workspaces' AI use" /> : rows.length === 0 ? (
        <EmptyState title="No workspaces match">Try another name.</EmptyState>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby={id + "-caption"}>
          <table>
            <caption id={id + "-caption"} className="sr-only">Workspaces, their AI provider, monthly limit and AI spend this month</caption>
            <thead><tr><th>Workspace</th><th>Provider · model</th><th>Own monthly limit</th><th>Spent this month</th><th>Runs</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name} <span className="muted">{r.kind === "SCHOOL" ? "School" : "Teacher"} · {r.status}</span></td>
                  <td>{r.keySet ? providerModelText(r.provider, r.model) : <span className="muted">Not set up</span>}</td>
                  <td>{limitText(r.limitUsd)}</td>
                  <td>{money(Number(r.spentUsd ?? 0))}</td>
                  <td>{r.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
