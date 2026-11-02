"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { PublicShell } from "@/components/ui/SiteChrome";
import { LoadingState, StatusCard } from "@/components/ui/States";
import { tokenFromHash } from "@/lib/school";

/**
 * The link in the "confirm your email" email: /verify-email#token=…. The token is after '#', so it never reaches a
 * server log; the page sends it in the body of a POST.
 */
export default function VerifyEmail() {
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = tokenFromHash(window.location.hash);
    if (!token) {
      setState("failed");
      setMessage("This link is incomplete. Open the link from the email again, or copy the whole address.");
      return;
    }
    api("/api/v1/auth/verify-email", { method: "POST", body: { token } })
      .then(() => setState("done"))
      .catch((e: unknown) => {
        setState("failed");
        setMessage(e instanceof ApiError ? e.message : "Quizplayo could not confirm your email. Please try again.");
      });
  }, []);

  return (
    <PublicShell narrow>
      {state === "working" && <LoadingState rows={2} label="Confirming your email" />}
      {state === "done" && (
        <StatusCard tone="success" title="Your email is confirmed"
                    actions={[{ label: "Go to Quizplayo", href: "/home", primary: true }]}>
          <p>Thank you. Schools can now invite you, and your account is safer.</p>
        </StatusCard>
      )}
      {state === "failed" && (
        <StatusCard tone="problem" title="This link did not work"
                    actions={[{ label: "Sign in", href: "/sign-in", primary: true }, { label: "Get help", href: "/help" }]}>
          <p>{message}</p>
        </StatusCard>
      )}
    </PublicShell>
  );
}
