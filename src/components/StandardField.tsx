"use client";

import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { standardCode, standardOk, STANDARD_MAX } from "@/lib/questionTypes";

/** A suggested code from {@code GET /api/v1/standards/suggestions}: the library's own benchmark, or a code this school uses. */
interface Suggestion {
  code: string;
  description: string | null;
  source: "library" | "school";
}

/**
 * The standard a question covers (wave3-plan.md, W63): a short code such as 3.NF.A.1, typed or picked from suggestions for
 * the quiz's grade and subject (Quizplayo's own library benchmarks, and codes the school already uses). Optional. A code that
 * is not 2 to 30 letters, digits, dots or dashes is flagged once the person leaves the field, not while they type.
 */
export function StandardField({ value, grade, subject, onChange, label = "Standard (optional)" }: {
  value: string | null | undefined;
  grade: number;
  subject: string;
  onChange: (code: string | null) => void;
  label?: string;
}) {
  const id = useId();
  const [text, setText] = useState(value ?? "");
  const [touched, setTouched] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const invalid = touched && !standardOk(text);

  // Suggestions for what has been typed so far, after a short pause; a failed lookup just means no suggestions.
  useEffect(() => {
    const timer = setTimeout(() => {
      const u = new URLSearchParams({ grade: String(grade), subject });
      if (text.trim()) u.set("q", text.trim());
      api<Suggestion[]>("/api/v1/standards/suggestions?" + u.toString()).then(setSuggestions).catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [text, grade, subject]);

  function change(next: string) {
    setText(next);
    // Only a code the API accepts is kept on the question; a half-typed one waits.
    if (standardOk(next)) onChange(standardCode(next));
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" className="standard-input" list={id + "-list"} maxLength={STANDARD_MAX} value={text}
             autoComplete="off" autoCapitalize="characters" autoCorrect="off" spellCheck={false}
             aria-invalid={invalid} aria-describedby={id + "-hint"}
             onChange={(e) => change(e.target.value)} onBlur={() => setTouched(true)} placeholder="For example 3.NF.A.1" />
      <datalist id={id + "-list"}>
        {suggestions.map((s) => <option key={s.source + s.code} value={s.code}>{s.description ?? (s.source === "school" ? "Used in your school" : "")}</option>)}
      </datalist>
      <p className={invalid ? "hint hint-danger" : "hint"} id={id + "-hint"} role={invalid ? "alert" : undefined}>
        {invalid
          ? "A standard is 2 to " + STANDARD_MAX + " characters: letters, digits, dots and dashes, for example 3.NF.A.1."
          : "Reports can group by this code. Suggestions come from the library and your school's own questions."}
      </p>
    </div>
  );
}
