"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

/**
 * "Make a re-teach quiz" (wave3-plan.md, 3a): copies the hard questions (under 35 % right) as they were into a new draft
 * quiz of the teacher's own, with no AI, and opens it in the editor. On a game's report, an assignment's results and a
 * class report; "Re-teach with AI" sits beside it.
 */
export function ReteachButton({ path, hard, onError, className = "btn btn-primary", describedBy }: {
  /** The report's {@code reteach} address. */
  path: string;
  /** How many hard questions there are; the button is off when there are none. */
  hard: number;
  onError: (message: string) => void;
  className?: string;
  /** The id of the hint that says what it copies. */
  describedBy?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function make() {
    setBusy(true);
    try {
      const made = await api<{ quizId: string }>(path, { method: "POST" });
      router.push("/teacher/quiz/" + made.quizId + "/edit");
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Quizplayo could not make the re-teach quiz. Please try again.");
      setBusy(false);
    }
  }

  return (
    <button type="button" className={className} onClick={make} disabled={busy || hard === 0} aria-describedby={describedBy}>
      {busy ? "Making…" : "Make a re-teach quiz"}
    </button>
  );
}
