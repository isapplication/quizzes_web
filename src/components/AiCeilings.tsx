"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { money } from "@/lib/aiStudio";
import { EmptyState, LoadingState } from "@/components/ui/States";

/** One workspace's monthly AI ceiling and this month's spend (PlatformAiCeiling.Ceiling), in US dollars. */
interface Ceiling {
  id: string;
  name: string;
  kind: string;
  status: string;
  ceilingUsd: number;
  spentUsd: number;
  runs: number;
}

/**
 * Platform console → AI → monthly ceilings (Wave 3, W53): what each workspace has spent on AI this month (UTC) and its
 * ceiling, which the platform team changes here. 0 switches AI drafting off; every change is written to the audit log.
 * A safety limit, not a price.
 */
export function AiCeilings({ onError, onNotice }: { onError: (m: string | null) => void; onNotice: (m: string | null) => void }) {
  const id = useId();
  const [rows, setRows] = useState<Ceiling[] | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      setRows(await api<Ceiling[]>("/api/v1/platform/ai/ceilings" + (q.trim() ? "?q=" + encodeURIComponent(q.trim()) : "")));
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "The AI ceilings could not be loaded.");
    }
  }, [onError]);

  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query, load]);

  async function save(row: Ceiling, e: React.FormEvent) {
    e.preventDefault();
    const value = Number(draft[row.id] ?? String(row.ceilingUsd));
    if (!Number.isFinite(value) || value < 0 || value > 10_000) {
      onError("Set a monthly AI ceiling from $0 (AI off) to $10,000.");
      return;
    }
    setBusy(row.id);
    onError(null);
    try {
      const saved = await api<Ceiling>("/api/v1/platform/workspaces/" + row.id + "/ai-ceiling", {
        method: "PUT", body: { ceilingUsd: value },
      });
      setRows((now) => now?.map((r) => (r.id === saved.id ? saved : r)) ?? null);
      setDraft((d) => {
        const next = { ...d };
        delete next[row.id];
        return next;
      });
      onNotice(saved.name + ": the monthly AI ceiling is now " + money(Number(saved.ceilingUsd))
        + (Number(saved.ceilingUsd) === 0 ? " (AI drafting is off)." : "."));
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "The ceiling could not be saved. Please try again.");
    }
    setBusy(null);
  }

  return (
    <section className="card stack" aria-labelledby={id + "-h"}>
      <h2 id={id + "-h"}>Monthly AI ceilings</h2>
      <p className="muted" style={{ margin: 0 }}>
        What each workspace has spent on AI this month (UTC) and the most it may spend. When it reaches its ceiling, its
        teachers are told it starts again on the 1st. Set 0 to switch AI drafting off. Every change is audited.
      </p>
      <div className="field" style={{ maxWidth: 360 }}>
        <label htmlFor={id + "-q"}>Find a workspace</label>
        <input id={id + "-q"} type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
      </div>
      {rows === null ? <LoadingState rows={3} label="Loading the AI ceilings" /> : rows.length === 0 ? (
        <EmptyState title="No workspaces match">Try another name.</EmptyState>
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-labelledby={id + "-caption"}>
          <table>
            <caption id={id + "-caption"} className="sr-only">Workspaces, their AI spend this month and their ceilings</caption>
            <thead><tr><th>Workspace</th><th>This month</th><th>Runs</th><th>Ceiling (US$)</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const spent = Number(r.spentUsd);
                const ceiling = Number(r.ceilingUsd);
                const at = ceiling <= 0 || spent >= ceiling;
                return (
                  <tr key={r.id}>
                    <td>{r.name} <span className="muted">{r.kind === "SCHOOL" ? "School" : "Teacher"} · {r.status}</span></td>
                    <td>{money(spent)}{at && <span className="chip chip-danger" style={{ marginInlineStart: 6 }}>At its ceiling</span>}</td>
                    <td>{r.runs}</td>
                    <td>
                      <form className="row" style={{ gap: 6, flexWrap: "nowrap" }} onSubmit={(e) => save(r, e)}>
                        <input type="number" min={0} max={10000} step={1} inputMode="decimal" style={{ width: 110 }}
                               aria-label={"Monthly AI ceiling for " + r.name + " in US dollars"}
                               value={draft[r.id] ?? String(ceiling)}
                               onChange={(e) => setDraft((d) => ({ ...d, [r.id]: e.target.value }))} />
                        <button type="submit" className="btn btn-light" disabled={busy === r.id || draft[r.id] === undefined}>
                          {busy === r.id ? "Saving…" : "Save"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
