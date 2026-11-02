"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { api, ApiError } from "@/lib/api";
import { SUBJECTS } from "@/lib/content";
import { GRADES } from "@/lib/school";
import { PageHeader } from "@/components/ui/States";

export default function NewQuizPage() {
  return (
    <AppFrame>
      <NewQuiz />
    </AppFrame>
  );
}

/** "Create a quiz": a title, subject and grade, then the editor. */
function NewQuiz() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState<string>("Other");
  const [grade, setGrade] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ quizId: string }>("/api/v1/content/quizzes", { method: "POST", body: { title, subject, grade } });
      router.push("/teacher/quiz/" + r.quizId + "/edit");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not create the quiz. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 560 }}>
      <PageHeader title="Create a quiz" description="Give it a name; you add the questions next." />
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); create(); }}>
        <div className="field">
          <label htmlFor="nq-title">Title</label>
          <input id="nq-title" type="text" required maxLength={120} value={title} autoFocus
                 onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The water cycle" />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="nq-subject">Subject</label>
            <select id="nq-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nq-grade">Grade</label>
            <select id="nq-grade" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
              {GRADES.map((g) => <option key={g} value={g}>{g === 0 ? "Kindergarten" : "Grade " + g}</option>)}
            </select>
          </div>
        </div>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={busy || !title.trim()}>
            {busy ? "Creating…" : "Create and add questions"}
          </button>
        </div>
      </form>
    </div>
  );
}
