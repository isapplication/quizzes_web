"use client";

import { roleText } from "@/components/AiRunDialog";
import { AiRun, forWhom, runChip, runStatusText, usd } from "@/lib/aiActivity";
import { when } from "@/lib/communication";
import { gradeLabel } from "@/lib/content";

/** The runs table, shared with the console's AI use tab ({@code school} adds its Workspace column). */
export function AiRunTable({ runs, onOpen, caption, school = false }: {
  runs: AiRun[];
  onOpen: (run: AiRun) => void;
  caption: string;
  school?: boolean;
}) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-labelledby="ai-runs-caption">
      <table className="sticky-head">
        <caption id="ai-runs-caption" className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th>When</th><th>Who</th>{school && <th>Workspace</th>}<th>Topic</th><th>For</th><th>Questions</th><th>Status</th><th>Cost</th><th />
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.runId}>
              <td style={{ whiteSpace: "nowrap" }}>{when(r.createdAt)}</td>
              <td style={{ overflowWrap: "anywhere" }}>
                {r.requesterName ?? "Someone"}
                {r.role && <div className="muted" style={{ fontSize: 12 }}>{roleText(r.role)}{r.requesterEmail && <> · {r.requesterEmail}</>}</div>}
              </td>
              {school && <td>{r.schoolName ?? <span className="muted">None</span>}</td>}
              <td style={{ overflowWrap: "anywhere" }}>
                {r.topic}
                <div className="muted" style={{ fontSize: 12 }}>{gradeLabel(r.grade)} · {r.subject}</div>
              </td>
              <td>{forWhom(r).replace(/^For /, "")}</td>
              <td>{r.kind === "SUMMARY" ? <span className="muted">A summary, no questions</span> : <>{r.passed} of {r.received} passed</>}</td>
              <td><span className={runChip(r.status, r.kind)}>{runStatusText(r)}</span></td>
              <td>{r.mode === "SAMPLE" ? <span className="muted">Sample</span> : usd(r.costUsd)}</td>
              <td>
                <button type="button" className="btn btn-light" onClick={() => onOpen(r)}>
                  Open<span className="sr-only"> the request on {r.topic}</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
