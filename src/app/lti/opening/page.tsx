"use client";

import { useEffect, useState } from "react";
import { LoadingState, StatusCard } from "@/components/ui/States";
import { codeFromHash, openPath } from "@/lib/lti";

/**
 * Where an LMS launch lands: /lti/opening#<code>, often inside the LMS's frame. Quizplayo needs its own tab (a framed
 * page can't keep a first-party sign-in), so a top-level page goes straight on to /lti/open; a framed one tries to
 * open a new tab and always offers a link, for when the browser blocks it. The code never goes to a server here.
 */
export default function LtiOpening() {
  const [state, setState] = useState<{ code: string | null } | null>(null);

  useEffect(() => {
    const code = codeFromHash(window.location.hash);
    if (code && window.top === window.self) {
      window.location.replace(openPath(code));
      return;
    }
    // Keep the code out of this page's address from now on: the link below carries it.
    if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    setState({ code });
    if (code) {
      try {
        const tab = window.open(openPath(code), "_blank");
        if (tab) tab.opener = null;
      } catch {
        // Blocked: the link below is the way.
      }
    }
  }, []);

  return (
    <main className="site-main narrow lti-opening">
      {!state ? (
        <LoadingState rows={2} label="Opening Quizplayo" />
      ) : state.code ? (
        <section className="status-card status-info" aria-live="polite">
          <div className="status-icon" aria-hidden="true">i</div>
          <h1>Opening Quizplayo</h1>
          <div className="status-body">
            <p>Quizplayo opens in its own tab. If it didn&apos;t open, use this button.</p>
          </div>
          <div className="status-actions">
            <a className="btn btn-primary" href={openPath(state.code)} target="_blank" rel="noopener">
              Open Quizplayo in a new tab
            </a>
          </div>
          <p className="muted">The button works once, for one minute. After that, open Quizplayo from your course again.</p>
        </section>
      ) : (
        <StatusCard tone="problem" title="Quizplayo could not open">
          <p>This link from your LMS is incomplete or has already been used. Open Quizplayo from your course again.</p>
        </StatusCard>
      )}
    </main>
  );
}
