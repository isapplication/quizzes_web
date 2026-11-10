"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { ClassSummaryView, summaryText, withQuery } from "@/lib/reports";

/**
 * "Write a summary" on a class report (wave3-plan.md, 3g, W52): AI writes about 150 words (what went well, what to
 * revisit, three next steps) from the class's totals and question texts only, never a student's name or answer. It is a
 * draft the teacher reads, copies or writes again; each one counts towards the school's monthly AI limit. The newest one
 * for the class and days comes back without another AI call.
 */
export function ClassSummary({ classCode, query }: { classCode: string; query: string }) {
  const id = useId();
  const [summary, setSummary] = useState<ClassSummaryView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessage = useRef("");
  const path = withQuery("/api/v1/reports/classes/" + encodeURIComponent(classCode) + "/summary", query);

  useEffect(() => {
    let live = true;
    setSummary(null);
    setLoaded(false);
    setError(null);
    api<ClassSummaryView | undefined>(path)
      .then((s) => { if (live) setSummary(s ?? null); })
      .catch(() => undefined)   // no saved summary to show: the button still works
      .finally(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [path]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function write() {
    setBusy(true);
    setError(null);
    try {
      setSummary(await api<ClassSummaryView>(path, { method: "POST" }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not write the summary. Please try again.");
    }
    setBusy(false);
  }

  /** Copies the summary; the message beside the button is also the live region, so everyone hears the same result. */
  async function copy() {
    if (!summary) return;
    let message: string;
    try {
      await navigator.clipboard.writeText(summaryText(summary));
      message = "Copied";
    } catch {
      message = "Copy failed: select the text and copy it instead";
    }
    if (message === lastMessage.current) message += " ";   // a repeat is still announced
    lastMessage.current = message;
    if (timer.current) clearTimeout(timer.current);
    setCopied("");
    requestAnimationFrame(() => setCopied(message));
    timer.current = setTimeout(() => setCopied(""), 2500);
  }

  return (
    <section className="card stack class-summary" aria-labelledby={id + "-title"} aria-busy={busy}>
      <div className="row class-summary-head">
        <h2 id={id + "-title"}>Summary</h2>
        {summary && <span className="chip chip-warn">Draft</span>}
      </div>
      <p className="muted" id={id + "-note"}>
        AI writes it from the class&apos;s totals and question texts only, never a student&apos;s name or answer. Read it before you share it.
        Each summary counts towards your school&apos;s monthly AI limit.
      </p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {busy && <p className="muted" role="status">Writing the summary…</p>}
      {summary && !busy && (
        <div className="stack class-summary-body">
          <div>
            <h3>What went well</h3>
            <p>{summary.wentWell}</p>
          </div>
          <div>
            <h3>What to revisit</h3>
            <p>{summary.revisit}</p>
          </div>
          <div>
            <h3>Next steps</h3>
            <ol>{summary.nextSteps.map((step, i) => <li key={i}>{step}</li>)}</ol>
          </div>
          <p className="muted class-summary-meta">
            Written {new Date(summary.writtenAt).toLocaleString()}
            {summary.mode === "SAMPLE" ? " · sample mode: put together from the numbers, no AI called" : ""}
          </p>
        </div>
      )}
      <div className="row class-summary-actions">
        <button type="button" className={summary ? "btn btn-light" : "btn btn-primary"} onClick={write}
                disabled={busy || !loaded} aria-describedby={id + "-note"}>
          {busy ? "Writing…" : summary ? "Write again" : "Write a summary"}
        </button>
        {summary && !busy && (
          <span className="copy-with-status">
            <button type="button" className="btn btn-light" onClick={copy}>Copy</button>
            <span className="muted copy-status" role="status">{copied}</span>
          </span>
        )}
      </div>
    </section>
  );
}
