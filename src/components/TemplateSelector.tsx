"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface Template {
  code: string;
  name: string;
  description: string;
  questionCount: number;
}

const TEMPLATES: Template[] = [
  { code: "exit-ticket", name: "Exit Ticket", description: "3 quick questions to check what students learned today.", questionCount: 3 },
  { code: "warm-up", name: "Warm-Up", description: "A short review of yesterday's topic to get the class started.", questionCount: 3 },
  { code: "quick-check", name: "Quick Check", description: "5 questions on the current unit, mixed types.", questionCount: 5 },
  { code: "reflection", name: "Reflection", description: "Students think about what they learned and what was hard.", questionCount: 4 },
];

interface TemplateSelectorProps {
  grade: number;
  open: boolean;
  onClose: () => void;
  onSelect: (quiz: { title: string; questions: unknown[] }) => void;
}

export function TemplateSelector({ grade, open, onClose, onSelect }: TemplateSelectorProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) { setError(null); setLoading(null); }
  }, [open]);

  async function pick(template: Template) {
    setLoading(template.code);
    setError(null);
    const band = grade <= 2 ? "K-2" : grade <= 5 ? "3-5" : grade <= 8 ? "6-8" : "9-12";
    try {
      const quiz = await api<{ title: string; questions: unknown[] }>(`/api/templates/${template.code}?grade=${encodeURIComponent(band)}`);
      onSelect(quiz);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load the template. Please try again.");
      setLoading(null);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <dialog className="modal-dialog template-modal" open aria-label="Quick-launch templates"
              onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Quick Launch</h2>
          <button type="button" className="btn btn-light" onClick={onClose} aria-label="Close">×</button>
        </div>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          Pick a template and we&apos;ll pre-fill a quiz for your grade. You can edit it before publishing.
        </p>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.code} type="button" className="card template-card"
                    disabled={loading !== null} onClick={() => pick(t)}>
              <h3>{t.name}</h3>
              <p className="muted">{t.description}</p>
              <span className="chip">{t.questionCount} questions</span>
              {loading === t.code && <span className="muted">Loading…</span>}
            </button>
          ))}
        </div>
      </dialog>
    </div>
  );
}
