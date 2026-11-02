"use client";

import { useState } from "react";

/** A password box with an eye button that shows or hides what was typed. */
export function PasswordInput({ id, value, onChange, autoComplete, required = true, describedBy }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  describedBy?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="password-field">
      <input id={id} type={shown ? "text" : "password"} autoComplete={autoComplete} required={required} value={value}
             aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="eye-button" aria-label={shown ? "Hide password" : "Show password"}
              aria-pressed={shown} onClick={() => setShown((s) => !s)}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          {shown ? (
            <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />
          ) : (
            <>
              <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
              <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="2" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
