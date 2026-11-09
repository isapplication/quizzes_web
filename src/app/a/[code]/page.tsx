"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ActivityRound } from "@/components/ActivityRound";
import { AnswerTile } from "@/components/Stage";
import { OwnerBrandMark, useOwnerBrand } from "@/components/OwnerBrand";
import { api, ApiError } from "@/lib/api";
import { CategoriseForm, MultiSelectForm, SliderForm, TypeAnswerForm } from "@/components/AnswerInputs";
import { ACTIVITY_TYPES, ActivityAnswer, Answered, dueText, PlayInfo, PlayState, tryText, type TypedAnswer, typedAnswer } from "@/lib/assignments";
import { keyText, outcomeOf, pickOf } from "@/lib/questionTypes";
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
  const [feedback, setFeedback] = useState<(Answered & { chosen: number[] }) | null>(null);
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

  async function answer(given: { choice: number } | ActivityAnswer | TypedAnswer) {
    if (!state?.question || busy || feedback) return;
    const type = state.question.type;
    const slide = (state.question.pick ?? pickOf(type)) === "none";
    setBusy(true);
    setError(null);
    try {
      const r = await api<Answered>("/api/v1/assignments/play/" + code + "/answer", {
        method: "POST", body: { attemptKey: key, index: state.question.index, ...given },
      });
      setLastType(type);
      if (type === "CARD" || slide) setState(r.state);
      else setFeedback({ ...r, chosen: "choice" in given ? [given.choice] : "choices" in given ? given.choices : [] });
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
  const pick = q ? q.pick ?? pickOf(q.type) : "one";
  const outcome = feedback ? outcomeOf({ answered: true, correct: feedback.correct, fraction: feedback.fraction, counted: feedback.counted }) : null;
  const rightChoices = feedback ? feedback.correctIndexes ?? (feedback.correctIndex >= 0 ? [feedback.correctIndex] : []) : [];
  const comesBack = !!feedback?.comesBack;
  const retry = feedback && (feedback.tryNumber ?? 1) > 1;
  const answerWords = feedback && q && !comesBack && (outcome === "wrong" || outcome === "partial")
    && (pick === "text" || pick === "number" || pick === "many" || pick === "categorise")
    ? keyText(q.type, feedback.key, q.choices, rightChoices, q.slider?.step ?? 1) : null;
  // A puzzle is a question like any other in a quiz (Wave 1b); matching and flashcards stay activity rounds.
  const step = q?.type === "CARD" ? "Card" : activity && q?.type !== "PUZZLE" ? "Round" : "Question";
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
              <span>{step} {q.index + 1} of {q.total}{tryText(q.tryNumber) && <span className="chip try-chip">{tryText(q.tryNumber)}</span>}</span>
              <span>{q.type === "CARD" ? state.correct + " known so far" : state.score + " points so far"}</span>
            </div>
            {feedback && (
              <div className={"feedback assignment-feedback " + (feedback.correct ? "ok" : comesBack ? "neutral" : "no")} role="status">
                {feedback.correct ? "✓ All right" : comesBack ? "Not quite yet" : "✕ " + feedback.right + " of " + feedback.parts + " right"}
                {feedback.points > 0 && <div style={{ fontSize: 18 }}>+{feedback.points} points</div>}
                {comesBack && <div style={{ fontSize: 18, fontWeight: 400 }}>This one comes back at the end for another try.</div>}
                {retry && feedback.correct && <div style={{ fontSize: 18, fontWeight: 400 }}>Right this time. Only first tries count for points.</div>}
              </div>
            )}
            {q.visual && <span className="question-visual-big" aria-hidden="true">{q.visual}</span>}
            <div className="question-text">{q.text}</div>
            {q.type !== "CARD" || !feedback ? (
              <ActivityRound key={q.index} q={q} feedback={feedback} busy={busy} onAnswer={answer} />
            ) : null}
            {feedback?.explanation && <div className="card">{feedback.explanation}</div>}
            {feedback?.steps && <Steps steps={feedback.steps} />}
            {feedback && (
              <div className="row" style={{ justifyContent: "center" }}>
                <button type="button" className="btn btn-primary" style={{ fontSize: 20 }} onClick={next} autoFocus>
                  {feedback.state.finished ? "See how you did" : step === "Question" ? "Next question" : "Next round"}
                </button>
              </div>
            )}
          </>
        )}

        {state && q && !activity && pick === "none" && (
          <>
            <div className="assignment-progress">
              <span>{q.index + 1} of {q.total}</span>
              <span>{state.correct} right so far</span>
            </div>
            <article className="assignment-slide">
              <h1>{q.title}</h1>
              {q.text && <p>{q.text}</p>}
            </article>
            <div className="row" style={{ justifyContent: "center" }}>
              <button type="button" className="btn btn-primary" style={{ fontSize: 20 }} disabled={busy} onClick={() => answer(typedAnswer.seen())} autoFocus>
                {busy ? "Opening…" : "Continue"}
              </button>
            </div>
          </>
        )}

        {state && q && !activity && pick !== "none" && !feedback && (
          <>
            <div className="assignment-progress">
              <span>Question {q.index + 1} of {q.total}{tryText(q.tryNumber) && <span className="chip try-chip">{tryText(q.tryNumber)}</span>}</span>
              <span>{state.correct} right so far</span>
            </div>
            {q.visual && <span className="question-visual-big" aria-hidden="true">{q.visual}</span>}
            <div className="question-text">{q.text}</div>
            {pick === "one" && (
              <div className="answer-grid">
                {q.choices.map((c, i) => <AnswerTile key={i} index={i} text={c} disabled={busy} onClick={() => answer({ choice: i })} />)}
              </div>
            )}
            {pick === "many" && (
              <MultiSelectForm key={q.index} variant="stage" choices={q.choices} busy={busy} onSubmit={(c) => answer(typedAnswer.choices(c))} />
            )}
            {pick === "text" && <TypeAnswerForm key={q.index} variant="stage" busy={busy} onSubmit={(t) => answer(typedAnswer.text(t))} />}
            {pick === "number" && q.slider && (
              <SliderForm key={q.index} variant="stage" slider={q.slider} busy={busy} onSubmit={(v) => answer(typedAnswer.value(v))} />
            )}
            {pick === "categorise" && q.categorise && (
              <CategoriseForm key={q.index} variant="stage" data={q.categorise} busy={busy}
                              onSubmit={(c) => answer(typedAnswer.categories(c))} />
            )}
          </>
        )}

        {state && q && !activity && pick !== "none" && feedback && (
          <>
            <div className={"feedback assignment-feedback " + (comesBack ? "neutral" : outcome === "correct" || outcome === "partial" ? "ok" : outcome === "vote" ? "neutral" : "no")}
                 role="status">
              {comesBack ? "Not quite yet" : outcome === "correct" ? "✓ Correct" : outcome === "partial" ? "✓ Partly right" : outcome === "vote" ? "Thanks for voting" : "✕ Not quite"}
              {!comesBack && !retry && (outcome === "correct" || outcome === "partial") && <div style={{ fontSize: 18 }}>+{feedback.points} points</div>}
              {comesBack && <div style={{ fontSize: 18, fontWeight: 400 }}>This one comes back at the end for another try.</div>}
              {retry && !comesBack && (outcome === "correct" || outcome === "partial") && (
                <div style={{ fontSize: 18, fontWeight: 400 }}>Right this time. Only first tries count for points.</div>
              )}
              {answerWords && <div style={{ fontSize: 18, fontWeight: 400 }}>The answer: {answerWords}</div>}
            </div>
            <div className="question-text">{q.text}</div>
            {(pick === "one" || pick === "many") && (
              <div className="answer-grid">
                {q.choices.map((c, i) => (
                  // The right answers are marked (none in a poll); the student's own choices stay visible; the rest fade.
                  <AnswerTile key={i} index={i} text={c}
                              state={rightChoices.includes(i) && outcome !== "vote" ? "correct" : feedback.chosen.includes(i) ? "chosen" : "dim"} />
                ))}
              </div>
            )}
            {feedback.explanation && <div className="card">{feedback.explanation}</div>}
            {feedback.steps && <Steps steps={feedback.steps} />}
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
              {state.cards !== undefined
                ? (state.scored === 0 && state.cards > 0
                  ? <>You knew {state.cardsKnown} of {state.cards} cards. Go back over the others another time.</>
                  : state.scored === 0
                    ? <>{state.score} points</>
                    : <>{state.correct} of {state.scored} right · {state.score} points
                      {state.cards > 0 && <> · you knew {state.cardsKnown} of {state.cards} cards</>}</>)
                : lastType === "CARD"
                  ? <>You knew {state.correct} of {state.total} cards. Go back over the others another time.</>
                  : <>{state.correct} of {state.scored ?? state.total} right · {state.score} points</>}
            </div>
            <div style={{ fontSize: 16, fontWeight: 400 }}>Your teacher can see your answers.</div>
          </div>
        )}
      </main>
    </div>
  );
}

/** A worked solution (Wave 3), folded away until the student opens it: the steps, one per line. */
function Steps({ steps }: { steps: string }) {
  return (
    <details className="card steps">
      <summary>Show the steps</summary>
      <ol className="steps-list">
        {steps.split("\n").map((line) => line.trim()).filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
      </ol>
    </details>
  );
}
