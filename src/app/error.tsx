"use client";

import { PublicShell } from "@/components/ui/SiteChrome";

/** Shown when a page fails unexpectedly; offers to try again. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <PublicShell narrow>
      <section className="status-card status-problem" role="alert">
        <div className="status-icon" aria-hidden="true">!</div>
        <h1>Something went wrong on this page</h1>
        <p className="status-body">Quizplayo could not show this page. Please try again; if it keeps happening, tell Quizplayo support.</p>
        <div className="status-actions">
          <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
          <a className="btn btn-light" href="/">Go to the home page</a>
        </div>
      </section>
    </PublicShell>
  );
}
