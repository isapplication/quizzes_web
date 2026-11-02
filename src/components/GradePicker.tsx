"use client";

import { useEffect, useRef, useState } from "react";
import { GRADES, gradeLabel, gradesText } from "@/lib/school";

const STAGES: { label: string; grades: number[] }[] = [
  { label: "Elementary (KG–5)", grades: [0, 1, 2, 3, 4, 5] },
  { label: "Middle (6–8)", grades: [6, 7, 8] },
  { label: "High (9–12)", grades: [9, 10, 11, 12] },
];

/**
 * "Choose grades": a dropdown of check boxes with "All grades" and the three school stages on top. The closed
 * field shows the choice in short ("KG–5, 9") and as removable chips.
 */
export function GradePicker({ id, value, onChange }: { id: string; value: number[]; onChange: (g: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function away(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const chosen = new Set(value);
  const all = GRADES.every((g) => chosen.has(g));
  const set = (grades: Set<number>) => onChange([...grades].sort((a, b) => a - b));

  function toggle(grades: number[]) {
    const next = new Set(chosen);
    const every = grades.every((g) => next.has(g));
    grades.forEach((g) => (every ? next.delete(g) : next.add(g)));
    set(next);
  }

  const name = (g: number) => (g === 0 ? "Kindergarten" : "Grade " + gradeLabel(g));

  return (
    <div className="grade-picker" ref={box}>
      <button id={id} type="button" className="grade-picker-field" aria-haspopup="listbox" aria-expanded={open}
              onClick={() => setOpen((o) => !o)}>
        <span className={value.length ? undefined : "muted"}>
          {all ? "All grades (KG–12)" : value.length ? gradesText(value) : "Choose grades"}
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="grade-picker-panel" role="group" aria-label="Grades">
          <label className="gp-all">
            <input type="checkbox" checked={all} onChange={() => toggle(GRADES)} />
            All grades (KG–12)
          </label>
          <div className="gp-stages">
            {STAGES.map((s) => (
              <label key={s.label}>
                <input type="checkbox" checked={s.grades.every((g) => chosen.has(g))} onChange={() => toggle(s.grades)} />
                {s.label}
              </label>
            ))}
          </div>
          <div className="gp-grades">
            {GRADES.map((g) => (
              <label key={g} className={chosen.has(g) ? "on" : undefined}>
                <input type="checkbox" checked={chosen.has(g)} onChange={() => toggle([g])} />
                {g === 0 ? "KG" : g}
              </label>
            ))}
          </div>
          <div className="gp-actions">
            <button type="button" className="btn btn-light" onClick={() => set(new Set())}>Clear</button>
            <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
      {value.length > 0 && !all && (
        <div className="gp-chips">
          {value.map((g) => (
            <span key={g} className="chip">
              {name(g)}
              <button type="button" aria-label={"Remove " + name(g)} onClick={() => toggle([g])}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
