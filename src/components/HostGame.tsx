"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { isIndependent, useMe } from "@/lib/me";
import { CONFIDENCE_MODES, GAME_MODES, type GameModeValue, TEAM_TALK_SECONDS } from "@/components/Stage";
import { lookChoices } from "@/lib/gameLook";

/** One of the workspace's own quizzes, or a library quiz played in place (nothing is copied). */
export type HostTarget = { quizId: string } | { libraryQuizId: string };

/**
 * "Host a live game": the mode (Classic, Team with 2 to 6 teams, or untimed Accuracy), the game look (the quiz's grade,
 * or another), who can join (a school can limit it to its signed-in students and a class), then the host screen. The
 * same box on a teacher's own quiz and on a library quiz.
 */
export function HostGame({ target, playable, total, grade }: { target: HostTarget; playable: number; total: number; grade: number }) {
  const me = useMe();
  const router = useRouter();
  const school = !isIndependent(me);
  const [signedInOnly, setSignedInOnly] = useState(false);
  const [classCode, setClassCode] = useState("");
  const [mode, setMode] = useState<GameModeValue>("CLASSIC");
  const [confidence, setConfidence] = useState(false);
  const unplugged = mode === "UNPLUGGED";
  const canBoost = CONFIDENCE_MODES.includes(mode);
  const [teams, setTeams] = useState(2);
  // Team games (Wave 2d): one device per player or per team, a talk pause, and names the teacher may change.
  const [teamDevices, setTeamDevices] = useState<"EACH" | "SHARED">("EACH");
  const [talk, setTalk] = useState(5);
  const [builtInNames, setBuiltInNames] = useState<string[]>([]);
  const [teamNames, setTeamNames] = useState<string[]>([]);
  const looks = lookChoices(grade);
  const [look, setLook] = useState(looks[0].value);
  const [shuffle, setShuffle] = useState(false);
  const [roomCheck, setRoomCheck] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const skipped = total - playable;

  useEffect(() => {
    if (me.classes.length > 0) setClassCode(me.classes[0]);
  }, [me.classes]);

  // The built-in names, loaded once when the teacher first picks Team.
  useEffect(() => {
    if (mode !== "TEAM" || builtInNames.length > 0) return;
    api<string[]>("/api/v1/live/team-names").then(setBuiltInNames).catch(() => undefined);
  }, [mode, builtInNames.length]);
  const shownNames = Array.from({ length: teams }, (_, i) => teamNames[i] ?? builtInNames[i] ?? "");
  const shared = mode === "TEAM" && teamDevices === "SHARED";

  async function host() {
    setStarting(true);
    setError(null);
    try {
      const game = await api<{ pin: string }>("/api/v1/live/games", {
        method: "POST",
        body: {
          ...target, requireSignIn: !unplugged && !shared && signedInOnly,
          classCode: !unplugged && !shared && signedInOnly ? classCode || null : null,
          teamDevices: mode === "TEAM" ? teamDevices : null, teamTalkSeconds: mode === "TEAM" ? talk : null,
          // Only names the teacher changed are sent; untouched teams keep the built-in names on the server.
          teamNames: mode === "TEAM" && teamNames.some((n) => n !== undefined) ? shownNames : null,
          mode, teamCount: mode === "TEAM" ? teams : null, lookGrade: look, shuffle,
          roomCheck: !unplugged && !signedInOnly && roomCheck, confidence: canBoost && confidence,
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
          <div className="stack" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <label htmlFor="team-count">Teams</label>
              <select id="team-count" value={teams} onChange={(e) => setTeams(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} teams</option>)}
              </select>
              <label htmlFor="team-talk">Team talk</label>
              <select id="team-talk" value={talk} onChange={(e) => setTalk(Number(e.target.value))} aria-describedby="team-talk-hint">
                {TEAM_TALK_SECONDS.map((s) => <option key={s} value={s}>{s === 0 ? "None" : s + " seconds"}</option>)}
              </select>
              <span id="team-talk-hint" className="muted">Each question shows first, then answers open.</span>
            </div>
            <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 6 }}>
              <legend style={{ fontWeight: 600, marginBottom: 4 }}>Devices</legend>
              <label className="check">
                <input type="radio" name="team-devices" checked={teamDevices === "EACH"} onChange={() => setTeamDevices("EACH")} />
                <span>One device per player <span className="muted">(players are put in even teams; you can move them in the lobby)</span></span>
              </label>
              <label className="check">
                <input type="radio" name="team-devices" checked={teamDevices === "SHARED"} onChange={() => setTeamDevices("SHARED")} />
                <span>One device per team <span className="muted">(each team shares one device and adds its first names; every device plays as a guest)</span></span>
              </label>
            </fieldset>
            <fieldset className="team-names" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontWeight: 600, marginBottom: 4 }}>Team names</legend>
              {shownNames.map((n, i) => (
                <label key={i} className="team-name-field">
                  <span className="sr-only">Team {i + 1} name</span>
                  <input type="text" value={n} maxLength={20} minLength={2} required
                         onChange={(e) => setTeamNames((old) => {
                           const next = [...old];
                           for (let k = 0; k < teams; k++) next[k] = next[k] ?? builtInNames[k] ?? "";
                           next[i] = e.target.value;
                           return next;
                         })} />
                </label>
              ))}
            </fieldset>
          </div>
        )}
        {canBoost && (
          <label className="check">
            <input type="checkbox" checked={confidence} onChange={(e) => setConfidence(e.target.checked)} />
            <span>Confidence <span className="muted">(after answering, players may bet 50, 75 or 100 points that they&apos;re right: won if right, lost if wrong)</span></span>
          </label>
        )}
      </fieldset>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <label htmlFor="game-look" style={{ fontWeight: 600 }}>Game look</label>
        <select id="game-look" value={look} onChange={(e) => setLook(Number(e.target.value))} aria-describedby="game-look-hint">
          {looks.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <span id="game-look-hint" className="muted">The screens&apos; pictures, fonts and motion suit this grade, in your school&apos;s colours.</span>
      </div>
      <label className="check">
        <input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} />
        <span>Shuffle questions and answers <span className="muted">(the same order for every player)</span></span>
      </label>
      {!signedInOnly && !unplugged && (
        <label className="check">
          <input type="checkbox" checked={roomCheck} onChange={(e) => setRoomCheck(e.target.checked)} />
          <span>Players must be in the room <span className="muted">(they also tap a pattern from your screen, so a shared PIN is not enough)</span></span>
        </label>
      )}
      {school && !unplugged && !shared && (
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
        {school && signedInOnly && !unplugged && !shared && (
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
