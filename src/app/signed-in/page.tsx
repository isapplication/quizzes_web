"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { clearTabKey, safeNext, setTabKey } from "@/lib/tab";
import { PublicShell } from "@/components/ui/SiteChrome";
import { LoadingState, StatusCard } from "@/components/ui/States";

/**
 * Where every sign-in lands. This tab forgets any earlier person's key, claims the key of the session it has
 * just signed in with, and goes on to the page the person wanted.
 */
export default function SignedIn() {
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    clearTabKey();
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    api<{ key: string }>("/api/v1/auth/tab", { method: "POST" })
      .then((r) => {
        setTabKey(r.key);
        window.location.replace(next);
      })
      .catch((e: unknown) => {
        setProblem(e instanceof ApiError && e.status === 401
          ? "Your sign-in did not finish, or it has already ended. Please sign in again."
          : e instanceof Error ? e.message : "Quizplayo could not finish signing you in.");
      });
  }, []);

  return (
    <PublicShell narrow>
      {problem ? (
        <StatusCard tone="problem" title="Sign-in did not finish"
                    actions={[{ label: "Sign in again", href: "/login?next=/home", primary: true }, { label: "Get help", href: "/help" }]}>
          <p>{problem}</p>
        </StatusCard>
      ) : (
        <LoadingState rows={2} label="Signing you in" />
      )}
    </PublicShell>
  );
}
