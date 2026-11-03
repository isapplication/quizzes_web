"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { gradeLabel } from "@/lib/content";
import { LibraryCard, originLabel, REPORT_REASONS } from "@/lib/library";

/**
 * One library quiz as a card: the title links to its preview (the whole card is clickable), and Host and "Edit a copy"
 * are their own buttons. Hosting plays the library quiz in place; "Edit a copy" makes the teacher's own draft.
 */
export function LibraryQuizCard({ quiz, showGrade = false }: { quiz: LibraryCard; showGrade?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"host" | "copy" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function host() {
    setBusy("host");
    setError(null);
    try {
      const game = await api<{ pin: string }>("/api/v1/live/games", { method: "POST", body: { libraryQuizId: quiz.libraryQuizId } });
      router.push("/teacher/host/" + game.pin);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The game could not start. Please try again.");
      setBusy(null);
    }
  }

  async function copy() {
    setBusy("copy");
    setError(null);
    try {
      const r = await api<{ quizId: string }>("/api/v1/library/quizzes/" + quiz.libraryQuizId + "/copy", { method: "POST" });
      router.push("/teacher/quiz/" + r.quizId + "/edit");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not copy this quiz. Please try again.");
      setBusy(null);
    }
  }

  return (
    <article className="library-card">
      <header>
        <span className="library-card-visual" aria-hidden="true">{quiz.visual ?? "📘"}</span>
        <h3><Link className="card-link" href={"/library/" + quiz.libraryQuizId}>{quiz.title}</Link></h3>
      </header>
      <p className="muted">
        {showGrade && <>{gradeLabel(quiz.grade)} · </>}
        {quiz.courseName}
        {quiz.unit && <> · {quiz.unit}</>}
        <br />
        {quiz.questionCount} questions · <span className="chip chip-ai">{originLabel(quiz.origin)}</span>
      </p>
      <footer>
        <button type="button" className="btn btn-primary" onClick={host} disabled={busy !== null}>
          {busy === "host" ? "Starting…" : "Host"}<span className="sr-only"> {quiz.title}</span>
        </button>
        <button type="button" className="btn btn-light" onClick={copy} disabled={busy !== null}>
          {busy === "copy" ? "Copying…" : "Edit a copy"}<span className="sr-only"> of {quiz.title}</span>
        </button>
        {error && <p className="library-card-error" role="alert">{error}</p>}
      </footer>
    </article>
  );
}

/**
 * "Report a mistake" on one library question: a native modal dialog with the reason and an optional note. The
 * question is hidden from every school once three different people report it.
 */
export function ReportMistake({ questionId, number, onReported }: {
  questionId: string;
  number: number;
  onReported: (message: string, hidden: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("WRONG_ANSWER");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = "report-title-" + questionId;

  function open() {
    setError(null);
    dialog.current?.showModal();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ outcome: string; message: string }>("/api/v1/library/questions/" + questionId + "/report", {
        method: "POST", body: { reason, note: note.trim() || null },
      });
      dialog.current?.close();
      setNote("");
      onReported(r.message, r.outcome === "HIDDEN");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Quizplayo could not send your report. Please try again.");
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="btn btn-link report-button" onClick={open}>
        Report a mistake<span className="sr-only"> in question {number}</span>
      </button>
      <dialog ref={dialog} className="report-dialog" aria-labelledby={titleId}>
        <form className="stack" onSubmit={send}>
          <h2 id={titleId}>Report a mistake in question {number}</h2>
          <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 6 }}>
            <legend style={{ fontWeight: 600, marginBottom: 6 }}>What&apos;s wrong?</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.value} className="check">
                <input type="radio" name={"reason-" + questionId} value={r.value} checked={reason === r.value}
                       onChange={() => setReason(r.value)} />
                <span>{r.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor={"note-" + questionId}>A note for the Quizplayo team (optional)</label>
            <textarea id={"note-" + questionId} rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Option B is also correct." />
          </div>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}
          <div className="row" style={{ gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-light" onClick={() => dialog.current?.close()}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Send report"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
