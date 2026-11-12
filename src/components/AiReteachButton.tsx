"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { aiEnabled, aiOffMessage } from "@/lib/aiSettings";
import { useAiStatus } from "@/components/AiOffNotice";
import { ReteachStarted, studioRunLink } from "@/lib/reports";

/**
 * "Re-teach with AI" (wave3-plan.md, 3g): AI Studio drafts new questions like the hard ones (under 35 % right), checked
 * twice as any draft, and opens the run for the teacher to review and publish. Runs on the school's own AI key and counts
 * towards its monthly limit, if it has one; "Make a re-teach quiz" beside it copies the questions as they are, without
 * AI. While the school hasn't set up AI, the button is off and says why.
 */
export function AiReteachButton({ path, hard, onError, className = "btn btn-light" }: {
  /** The report's {@code reteach-ai} address. */
  path: string;
  /** How many hard questions there are; the button is off when there are none. */
  hard: number;
  onError: (message: string) => void;
  className?: string;
}) {
  const router = useRouter();
  const offId = useId();
  const status = useAiStatus();
  const [busy, setBusy] = useState(false);
  const off = !aiEnabled(status);

  async function start() {
    setBusy(true);
    try {
      const run = await api<ReteachStarted>(path, { method: "POST" });
      router.push(studioRunLink(run.runId));
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "AI Studio could not start the re-teach quiz. Please try again.");
      setBusy(false);
    }
  }

  if (off && status) {
    return (
      <>
        <button type="button" className={className} disabled aria-describedby={offId}>Re-teach with AI</button>
        <span id={offId} className="hint ai-off-inline">
          {aiOffMessage(status)}
          {status.canManage && <> <Link href="/admin/ai">Open AI settings</Link></>}
        </span>
      </>
    );
  }

  return (
    <button type="button" className={className} onClick={start} disabled={busy || hard === 0}
            title={hard === 0 ? "No question was under 35% right." : "AI drafts new questions like the hard ones, for you to review in AI Studio."}>
      {busy ? "Starting…" : "Re-teach with AI"}
    </button>
  );
}
