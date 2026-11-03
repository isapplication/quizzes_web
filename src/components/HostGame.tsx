"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { isIndependent, useMe } from "@/lib/me";
import { GAME_MODES } from "@/components/Stage";

/** One of the workspace's own quizzes, or a library quiz played in place (nothing is copied). */
export type HostTarget = { quizId: string } | { libraryQuizId: string };

/**
 * "Host a live game": the mode (Classic, Team with 2 to 6 teams, or untimed Accuracy), who can join (a school can limit
 * it to its signed-in students and a class), then the host screen. The same box on a teacher's own quiz and on a
 * library quiz.
 */
export function HostGame({ target, playable, total }: { target: HostTarget; playable: number; total: number }) {
  const me = useMe();
  const router = useRouter();
  const school = !isIndependent(me);
  const [signedInOnly, setSignedInOnly] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [mode, setMode] = useState<"CLASSIC" | "TEAM" | "ACCURACY">("CLASSIC");
  const [teams, setTeams] = useState(2);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipped = total - playable;

  useEffect(() => {
    if (me.classes.length > 0) setClassCode(me.classes[0]);
  }, [me.classes]);

  async function host() {
    setStarting(true);
    setError(null);
    try {
      const game = await api<{ pin: string }>("/api/v1/live/games", {
        method: "POST",
        body: {
          ...target, requireSignIn: signedInOnly, classCode: signedInOnly ? classCode || null : null,
          mode, teamCount: mode === "TEAM" ? teams : null,
        },
      });
      router.push("/teacher/host/" + game.pin);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The game could not start. Please try again.");
      setStarting(false);
    }
  }

  return (
    <div className="card stack">
      <h2>Host a live game</h2>
      <p>
        {playable} of {total} questions play live.
        {skipped > 0 && <> {skipped} type-answer, puzzle or slider questions are skipped in this version.</>}
      </p>
      <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
        <legend style={{ fontWeight: 600, marginBottom: 6 }}>How do you want to play?</legend>
        <div className="mode-choices">
          {GAME_MODES.map((m) => (
            <label key={m.value} className="mode-choice">
              <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} />
              <strong>{m.label}</strong>
              <span>{m.text}</span>
            </label>
          ))}
        </div>
        {mode === "TEAM" && (
          <div className="row" style={{ gap: 8 }}>
            <label htmlFor="team-count">Teams</label>
            <select id="team-count" value={teams} onChange={(e) => setTeams(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} teams</option>)}
            </select>
          </div>
        )}
      </fieldset>
      {school && (
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>Who can join?</legend>
          <label className="check">
            <input type="radio" name="who" checked={!signedInOnly} onChange={() => setSignedInOnly(false)} />
            <span>Anyone with the PIN <span className="muted">(players choose a nickname, no account needed)</span></span>
          </label>
          <label className="check">
            <input type="radio" name="who" checked={signedInOnly} onChange={() => setSignedInOnly(true)} />
            <span>Only signed-in students of {me.school.name} <span className="muted">(results saved to each student)</span></span>
          </label>
        </fieldset>
      )}
      <div className="row" style={{ flexWrap: "wrap" }}>
        {school && signedInOnly && (
          <>
            <label htmlFor="class">Class</label>
            <select id="class" value={classCode} onChange={(e) => setClassCode(e.target.value)}>
              {me.classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="">Any student of my school</option>
            </select>
          </>
        )}
        <button className="btn btn-primary" type="button" onClick={host} disabled={starting || playable === 0}>
          {starting ? "Starting…" : "Host live game"}
        </button>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
    </div>
  );
}
