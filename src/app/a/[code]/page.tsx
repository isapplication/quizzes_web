"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ActivityRound } from "@/components/ActivityRound";
import { AnswerTile } from "@/components/Stage";
import { OwnerBrandMark, useOwnerBrand } from "@/components/OwnerBrand";
import { api, ApiError } from "@/lib/api";
import { ACTIVITY_TYPES, ActivityAnswer, Answered, dueText, PlayInfo, PlayState } from "@/lib/assignments";
import { LoadingState } from "@/components/ui/States";

/** This device's key for the attempt at one assignment, kept so a reload carries on. */
function keyName(code: string) {
  return "quizplayo.assignment." + code.toUpperCase();
}

function savedKey(code: string): string | null {
  try {
    return window.localStorage.getItem(keyName(code));
  } catch {
    return null;
  }
}

function saveKey(code: string, key: string | null) {
  try {
    if (key) window.localStorage.setItem(keyName(code), key);
    else window.localStorage.removeItem(keyName(code));
  } catch {
    // Storage blocked: a reload starts again (a signed-in student still carries on).
  }
}

/**
 * Doing an assignment from its link, open to everyone: at your own pace, no timer. Signed in at its school you do it as
 * yourself (and carry on from any device); otherwise with a nickname, unless it is for signed-in students only. Each
 * answer is checked on the server, then you see whether it was right before going on. Activity rounds (put in order,
 * match the pairs, flashcards) are played by {@link ActivityRound}; a flashcard goes straight on to the next card.
 */
export default function AssignmentPage() {
  const { code } = useParams<{ code: string }>();
  const [info, setInfo] = useState<PlayInfo | null>(null);
  const [state, setState] = useState<PlayState | null>(null);
  const [feedback, setFeedback] = useState<(Answered & { chosen: number | null }) | null>(null);
  // The last round's type: the end screen speaks of cards after a set of flashcards.
  const [lastType, setLastType] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  useOwnerBrand(info?.brand);

  const keep = useCallback((s: PlayState) => {
    if (s.attemptKey) {
      saveKey(code, s.attemptKey);
      setKey(s.attemptKey);
    }
    setState(s);
  }, [code]);

  useEffect(() => {
    api<PlayInfo>("/api/v1/assignments/play/" + code).then(async (i) => {
      setInfo(i);
      const k = savedKey(code);
      if (k && i.joinAs !== "SIGNED_IN") {
        try {
          setKey(k);
          setState(await api<PlayState>("/api/v1/assignments/play/" + code + "/state", { method: "POST", body: { attemptKey: k } }));
        } catch {
          saveKey(code, null);
          setKey(null);
        }
      }
    }).catch((e: unknown) => setError(e instanceof ApiError ? e.message : "Quizplayo could not open this assignment."));
  }, [code]);

  async function start(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      keep(await api<PlayState>("/api/v1/assignments/play/" + code + "/start", { method: "POST", body: { nickname } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Quizplayo could not start the assignment. Please try again.");
    }
    setBusy(false);
  }

  async function answer(given: { choice: number } | ActivityAnswer) {
    if (!state?.question || busy || feedback) return;
    const type = state.question.type;
    setBusy(true);
    setError(null);
    try {
      const r = await api<Answered>("/api/v1/assignments/play/" + code + "/answer", {
        method: "POST", body: { attemptKey: key, index: state.question.index, ...given },
      });
      setLastType(type);
      if (type === "CARD") setState(r.state);
      else setFeedback({ ...r, chosen: "choice" in given ? given.choice : null });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Quizplayo could not save your answer. Please try again.");
    }
    setBusy(false);
  }

  function next() {
    if (!feedback) return;
    setState(feedback.state);
    setFeedback(null);
  }

  const q = state?.question ?? null;
  const activity = q !== null && ACTIVITY_TYPES.includes(q.type);
  const step = q?.type === "CARD" ? "Card" : activity ? "Round" : "Question";
  return (
    <div className="stage">
      <div className="stage-bar">
        <OwnerBrandMark brand={info?.brand} />
        <span className="spacer" />
        {state && <span className="status-pill">{(feedback?.state ?? state).score} pts</span>}
        <Link className="btn btn-light" style={{ padding: "4px 12px" }} href="/">Leave</Link>
      </div>
      <main className="stage-main" style={{ maxWidth: 760 }}>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {!info && !error && <LoadingState rows={3} label="Opening the assignment" />}

        {info && !state && (
          <div className="pin-box stack" style={{ maxWidth: 480, margin: "0 auto", width: "100%" }}>
            <div>
              <p className="muted" style={{ margin: 0 }}>{info.workspaceName} · {info.questions} questions{info.dueAt && <> · {dueText(info.dueAt)}</>}</p>
              <h1 style={{ margin: "4px 0 0", fontSize: 24 }}>{info.title}</h1>
            </div>
            {info.state === "CLOSED" && <div className="alert alert-warning" style={{ margin: 0 }}>This assignment has closed. Ask your teacher if you need more time.</div>}
            {info.state === "NOT_YET" && <div className="alert alert-warning" style={{ margin: 0 }}>This assignment hasn&apos;t opened yet.</div>}
            {info.state === "OPEN" && info.joinAs === "SIGNED_IN" && (
              <>
                <p style={{ margin: 0 }}>You&apos;re doing it as <strong>{info.name}</strong>: your answers are saved, and you can carry on from any device.</p>
                <button className="btn btn-primary" type="button" disabled={busy} style={{ fontSize: 20, width: "100%" }} onClick={() => start()}>
                  {busy ? "Opening…" : "Start"}
                </button>
              </>
            )}
            {info.state === "OPEN" && info.joinAs === "GUEST" && (
              <form className="stack" onSubmit={start}>
                <label htmlFor="nickname" style={{ fontSize: 18 }}>Your name</label>
                <input id="nickname" type="text" autoComplete="nickname" value={nickname} maxLength={20} autoFocus
                       onChange={(e) => { setNickname(e.target.value); setError(null); }}
                       style={{ fontSize: 24, textAlign: "center", width: "100%" }} placeholder="e.g. Sam" />
                <p className="hint" style={{ margin: 0 }}>2 to 20 characters. Your teacher sees it with your answers.</p>
                <button className="btn btn-primary" type="submit" disabled={busy || nickname.trim().length < 2}
                        style={{ fontSize: 20, width: "100%" }}>
                  {busy ? "Starting…" : "Start"}
                </button>
              </form>
            )}
            {info.state === "OPEN" && info.joinAs === "SIGN_IN_FIRST" && (
              <>
                <div className="alert alert-warning" style={{ margin: 0 }}>
                  This assignment is for signed-in students of {info.workspaceName}. Sign in, and you&apos;ll come straight back to it.
                </div>
                {info.signInUrl && <a className="btn btn-primary" href={info.signInUrl} style={{ fontSize: 20 }}>Sign in through your school</a>}
              </>
            )}
          </div>
        )}

        {state && q && activity && (
          <>
            <div className="assignment-progress">
              <span>{step} {q.index + 1} of {q.total}</span>
              <span>{q.type === "CARD" ? state.correct + " known so far" : state.score + " points so far"}</span>
            </div>
            {feedback && (
              <div className={"feedback assignment-feedback " + (feedback.correct ? "ok" : "no")} role="status">
                {feedback.correct ? "✓ All right" : "✕ " + feedback.right + " of " + feedback.parts + " right"}
                {feedback.points > 0 && <div style={{ fontSize: 18 }}>+{feedback.points} points</div>}
              </div>
            )}
            {q.visual && <span className="question-visual-big" aria-hidden="true">{q.visual}</span>}
            <div className="question-text">{q.text}</div>
            {q.type !== "CARD" || !feedback ? (
              <ActivityRound key={q.index} q={q} feedback={feedback} busy={busy} onAnswer={answer} />
            ) : null}
            {feedback?.explanation && <div className="card">{feedback.explanation}</div>}
            {feedback && (
              <div className="row" style={{ justifyContent: "center" }}>
                <button type="button" className="btn btn-primary" style={{ fontSize: 20 }} onClick={next} autoFocus>
                  {feedback.state.finished ? "See how you did" : "Next round"}
                </button>
              </div>
            )}
          </>
        )}

        {state && q && !activity && !feedback && (
          <>
            <div className="assignment-progress">
              <span>Question {q.index + 1} of {q.total}</span>
              <span>{state.correct} right so far</span>
            </div>
            {q.visual && <span className="question-visual-big" aria-hidden="true">{q.visual}</span>}
            <div className="question-text">{q.text}</div>
            <div className="answer-grid">
              {q.choices.map((c, i) => <AnswerTile key={i} index={i} text={c} onClick={() => answer({ choice: i })} />)}
            </div>
          </>
        )}

        {state && q && !activity && feedback && (
          <>
            <div className={"feedback assignment-feedback " + (feedback.correct ? "ok" : "no")} role="status">
              {feedback.correct ? "✓ Correct" : "✕ Not quite"}
              {feedback.correct && <div style={{ fontSize: 18 }}>+{feedback.points} points</div>}
            </div>
            <div className="question-text">{q.text}</div>
            <div className="answer-grid">
              {q.choices.map((c, i) => (
                // The right answer is marked; the player's own wrong choice stays visible; the rest fade.
                <AnswerTile key={i} index={i} text={c}
                            state={i === feedback.correctIndex ? "correct" : i === feedback.chosen ? "chosen" : "dim"} />
              ))}
            </div>
            {feedback.explanation && <div className="card">{feedback.explanation}</div>}
            <div className="row" style={{ justifyContent: "center" }}>
              <button type="button" className="btn btn-primary" style={{ fontSize: 20 }} onClick={next} autoFocus>
                {feedback.state.finished ? "See how you did" : "Next question"}
              </button>
            </div>
          </>
        )}

        {state && !q && (
          <div className="feedback neutral">
            Done, {state.name}!
            <div style={{ fontSize: 18, fontWeight: 400 }}>
              {lastType === "CARD"
                ? <>You knew {state.correct} of {state.total} cards. Go back over the others another time.</>
                : <>{state.correct} of {state.total} right · {state.score} points</>}
            </div>
            <div style={{ fontSize: 16, fontWeight: 400 }}>Your teacher can see your answers.</div>
          </div>
        )}
      </main>
    </div>
  );
}
