"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { aiOffMessage, type AiStatus } from "@/lib/aiSettings";

let cached: Promise<AiStatus | null> | null = null;

/** Forgets the loaded AI status (after AI settings change), so the next screen asks again. */
export function forgetAiStatus() {
  cached = null;
}

/**
 * The workspace's AI status (GET /api/v1/ai/status), loaded once per page and shared by every AI button on it. Null
 * while loading or when it couldn't be loaded: the buttons then stay on, and the API answers for itself.
 */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    let live = true;
    if (!cached) {
      cached = api<AiStatus>("/api/v1/ai/status").catch(() => {
        cached = null;
        return null;
      });
    }
    cached.then((s) => { if (live) setStatus(s); });
    return () => { live = false; };
  }, []);
  return status;
}

/** "Your school hasn't set up AI yet": the API's message, and for the school admin a link to AI settings. */
export function AiOffNotice({ status, id }: { status: Pick<AiStatus, "message" | "canManage">; id?: string }) {
  return (
    <div className="alert alert-warning ai-off" role="note" id={id}>
      <span>{aiOffMessage(status)}</span>
      {status.canManage && <> <Link href="/admin/ai">Open AI settings</Link></>}
    </div>
  );
}
