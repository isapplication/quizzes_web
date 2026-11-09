"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

/** One quick-launch template for a grade band, as the API lists it. */
interface Template {
  templateCode: string;
  templateName: string;
  description: string | null;
  presetQuestions: unknown[];
}

/** The grade band a grade's templates are written for. */
export function bandOf(grade: number): string {
  return grade <= 2 ? "K-2" : grade <= 5 ? "3-5" : grade <= 8 ? "6-8" : "9-12";
}

/**
 * Quick Launch in a native modal dialog: the templates for the teacher's grade band; picking one makes a new draft
 * quiz of their own from it (POST /api/v1/templates/{code}/launch) and hands its id to {@code onLaunched}.
 * Mount it to open it; it calls {@code onClose} however it is closed.
 */
export function TemplateSelector({ grade, onClose, onLaunched }: {
  grade: number;
  onClose: () => void;
  onLaunched: (quizId: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [launching, setLaunching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const band = bandOf(grade);

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    // Click-outside closes it where the browser has no closedby (Safari): pressed and released on the backdrop.
    if (!d || "closedBy" in HTMLDialogElement.prototype) return;
    const outside = (e: PointerEvent) => {
      const r = d.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    let pressedOutside = false;
    const down = (e: PointerEvent) => { pressedOutside = outside(e); };
    const up = (e: PointerEvent) => { if (pressedOutside && outside(e)) d.close(); };
    d.addEventListener("pointerdown", down);
    d.addEventListener("pointerup", up);
    return () => { d.removeEventListener("pointerdown", down); d.removeEventListener("pointerup", up); };
  }, []);

  useEffect(() => {
    api<Template[]>("/api/v1/templates?grade=" + encodeURIComponent(band))
      .then(setTemplates)
      .catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not load the templates. Close this and try again."));
  }, [band]);

  async function launch(t: Template) {
    setLaunching(t.templateCode);
    setError(null);
    try {
      const made = await api<{ quizId: string }>("/api/v1/templates/" + encodeURIComponent(t.templateCode) + "/launch",
        { method: "POST", body: { grade } });
      onLaunched(made.quizId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not make a quiz from this template. Try again.");
      setLaunching(null);
    }
  }

  return (
    <dialog ref={dialog} className="email-dialog template-dialog" aria-labelledby={titleId} onClose={onClose}
            {...({ closedby: "any" } as Record<string, string>)}>
      <div className="stack">
        <h2 id={titleId} style={{ margin: 0 }}>Quick Launch</h2>
        <p className="muted" style={{ margin: 0 }}>
          Pick a template for grades {band}. Quizplayo makes it a new quiz of yours; fill in the answers, then publish.
        </p>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {!templates && !error && <p className="muted">Loading the templates…</p>}
        {templates && templates.length === 0 && <p className="muted">There are no templates for grades {band} yet.</p>}
        {templates && templates.length > 0 && (
          <div className="template-grid">
            {templates.map((t) => (
              <button key={t.templateCode} type="button" className="card template-card"
                      disabled={launching !== null} onClick={() => launch(t)}>
                <h3>{t.templateName}</h3>
                {t.description && <p className="muted">{t.description}</p>}
                <span className="chip">
                  {launching === t.templateCode ? "Making your quiz…"
                    : t.presetQuestions.length + (t.presetQuestions.length === 1 ? " question" : " questions")}
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <form method="dialog">
            <button type="submit" className="btn btn-light" autoFocus>Close</button>
          </form>
        </div>
      </div>
    </dialog>
  );
}
