"use client";

import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { standardCode, standardOk, STANDARD_MAX } from "@/lib/questionTypes";

/**
 * A "Standard" filter for the library and "My quizzes" (wave3-plan.md, W63): a code box with suggestions for the grade.
 * The code applies when the person presses Enter or leaves the box (not on every key), and an empty box clears it. A code
 * that is not 2 to 30 letters, digits, dots or dashes is flagged instead of sent.
 */
export function StandardFilter({ value, grade, onCommit, id: given }: {
  value: string;
  grade?: number | null;
  onCommit: (code: string) => void;
  id?: string;
}) {
  const own = useId();
  const id = given ?? own;
  const [text, setText] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const invalid = !standardOk(text);

  useEffect(() => setText(value), [value]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const u = new URLSearchParams();
      if (grade !== null && grade !== undefined) u.set("grade", String(grade));
      if (text.trim()) u.set("q", text.trim());
      api<{ code: string }[]>("/api/v1/standards/suggestions?" + u.toString()).then((r) => setSuggestions(r.map((s) => s.code)))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [text, grade]);

  function commit() {
    if (invalid) return;
    const code = standardCode(text) ?? "";
    if (code !== value) onCommit(code);
  }

  return (
    <div className="field">
      <label htmlFor={id}>Standard</label>
      <input id={id} type="text" className="standard-input" list={id + "-list"} maxLength={STANDARD_MAX} value={text}
             autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false} aria-invalid={invalid}
             aria-describedby={invalid ? id + "-error" : undefined} placeholder="e.g. 3.NF.A.1"
             onChange={(e) => setText(e.target.value)} onBlur={commit}
             onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } }} />
      <datalist id={id + "-list"}>{suggestions.map((c) => <option key={c} value={c} />)}</datalist>
      {invalid && <p className="hint hint-danger" id={id + "-error"} role="alert">2 to {STANDARD_MAX} letters, digits, dots or dashes.</p>}
    </div>
  );
}
