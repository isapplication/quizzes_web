"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { codeFromHash } from "@/lib/lti";
import { clearTabKey, safeNext, setTabKey } from "@/lib/tab";
import { PublicShell } from "@/components/ui/SiteChrome";
import { LoadingState, StatusCard } from "@/components/ui/States";

/**
 * The new tab an LMS launch opens: /lti/open#<code>. It takes the one-time code out of the address, trades it for this
 * tab's own session (like /signed-in), and goes on to the page the launch was for.
 */
export default function LtiOpen() {
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    const code = codeFromHash(window.location.hash);
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    clearTabKey();
    if (!code) {
      setProblem("This link from your LMS is incomplete or has already been used. Open Quizplayo from your course again.");
      return;
    }
    api<{ key: string; next: string }>("/api/v1/auth/login/lti", { method: "POST", body: { code } })
      .then((r) => {
        setTabKey(r.key);
        window.location.replace(safeNext(r.next));
      })
      .catch((e: unknown) => {
        setProblem(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Quizplayo could not finish signing you in.");
      });
  }, []);

  return (
    <PublicShell narrow>
      {problem ? (
        <StatusCard tone="problem" title="Sign-in did not finish" actions={[{ label: "Get help", href: "/help" }]}>
          <p>{problem}</p>
        </StatusCard>
      ) : (
        <LoadingState rows={2} label="Signing you in" />
      )}
    </PublicShell>
  );
}
