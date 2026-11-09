"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { PlayerGame } from "@/components/PlayerGame";
import { api, ApiError } from "@/lib/api";
import type { ShownBrand } from "@/lib/me";
import { formatPin, normalizePin } from "@/lib/pin";
import { OwnerBrandMark, useOwnerBrand } from "@/components/OwnerBrand";
import { GameLook } from "@/components/live/GameLook";
import { Buddy } from "@/components/live/LookArt";
import { JoinHero } from "@/components/live/GameBits";
import { unlockGameSound } from "@/lib/gameSound";
import { suggestNickname } from "@/lib/nicknames";
import { PatternPad } from "@/components/live/JoinExtras";

interface Joined {
  gameId: string;
  pin: string;
  quizTitle: string;
  cometdUrl: string;
  ticket: string;
  name: string;
  brand: ShownBrand;
  guest: boolean;
  lookGrade: number | null;
}

/** What the Quiz API says after the PIN: whose game it is and how this person can join it. */
interface JoinInfo {
  pin: string;
  quizTitle: string;
  workspaceName: string;
  brand: ShownBrand;
  joinAs: "SIGNED_IN" | "GUEST" | "SIGN_IN_FIRST";
  name: string | null;
  signInUrl: string | null;
  /** The game's look (0 to 12), so the join page already looks like the game. */
  lookGrade: number | null;
  /** A guest must also tap the four-shape pattern from the classroom screen. */
  roomCheck?: boolean;
  /** Wave 2d: SHARED when each device plays as one team, picked from {@code teams}, with up to 5 first names. */
  teamDevices?: "EACH" | "SHARED" | null;
  teams?: string[] | null;
}

/** The most people who can share one device in a team game. */
const MAX_MEMBERS = 5;

/** A refreshed tab goes back into its game (the ticket lasts the lesson); one game per tab. */
const SAVED = "quizplayo.play";

function saved(pin: string): Joined | null {
  try {
    const raw = window.sessionStorage.getItem(SAVED);
    const j = raw ? (JSON.parse(raw) as Joined) : null;
    return j && j.pin === pin ? j : null;
  } catch {
    return null;
  }
}

function save(j: Joined | null) {
  try {
    if (j) window.sessionStorage.setItem(SAVED, JSON.stringify(j));
    else window.sessionStorage.removeItem(SAVED);
  } catch {
    // Storage blocked: a refresh asks for the PIN again.
  }
}

export default function PlayPage() {
  return (
    <Suspense>
      <Play />
    </Suspense>
  );
}

/**
 * Joining a live game, open to everyone: the PIN, then a nickname (no account needed), or, signed in at the game's
 * school, as yourself so your result is kept. A game for signed-in students only offers the school's sign-in, which
 * comes back here.
 */
function Play() {
  const params = useSearchParams();
  const [pin, setPin] = useState(params.get("pin") ?? "");
  const [info, setInfo] = useState<JoinInfo | null>(null);
  const [nickname, setNickname] = useState("");
  const [joined, setJoined] = useState<Joined | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [backUrl, setBackUrl] = useState<string | null>(null);
  const [pattern, setPattern] = useState<number[]>([]);
  const [team, setTeam] = useState<number | null>(null);
  const [members, setMembers] = useState<string[]>(["", ""]);
  const autoJoined = useRef(false);
  // The join page takes the hosting school's colours as soon as the PIN is known.
  useOwnerBrand(info?.brand);

  async function lookUp(raw: string) {
    const clean = normalizePin(raw);
    if (!clean) {
      setError("A game PIN is 6 digits. Check the number on your teacher's screen.");
      return;
    }
    const back = saved(clean);
    if (back) {
      setJoined(back);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setInfo(await api<JoinInfo>("/api/v1/live/join/" + clean));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not find that game. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!info) return;
    // The join tap is the gesture that lets the game play sound on this phone.
    unlockGameSound();
    setBusy(true);
    setError(null);
    try {
      const j = await api<Joined>("/api/v1/live/join", {
        method: "POST", body: { pin: info.pin, nickname, pattern: info.roomCheck ? pattern : null,
          team: info.teamDevices === "SHARED" ? team : null,
          members: info.teamDevices === "SHARED" ? members.map((m) => m.trim()).filter(Boolean) : null },
      });
      save(j);
      setJoined(j);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not join you to the game. Please try again.");
      // A wrong pattern: start again from an empty pad (the screen may also show a new one by now).
      if (e instanceof ApiError && e.code === "wrong_room_pattern") setPattern([]);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const p = params.get("pin");
    if (p) lookUp(p);
    // Someone who came from their school's own system goes back to their dashboard there at the end.
    api<{ schoolSystemUrl: string | null }>("/api/v1/me").then((m) => setBackUrl(m.schoolSystemUrl)).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ?auto=1 (the "Join" in a student's school system): a signed-in student of the game's school joins at once.
  useEffect(() => {
    if (info?.joinAs === "SIGNED_IN" && params.get("auto") === "1" && !autoJoined.current) {
      autoJoined.current = true;
      join();
    }
  }, [info]); // eslint-disable-line react-hooks/exhaustive-deps

  if (joined) {
    return <PlayerGame url={joined.cometdUrl} pin={joined.pin} ticket={joined.ticket} name={joined.name}
                       quizTitle={joined.quizTitle} brand={joined.brand} lookGrade={joined.lookGrade}
                       backUrl={joined.guest ? null : backUrl} />;
  }

  return (
    <GameLook grade={info?.lookGrade} kind="player">
      <header className="gl-bar">
        <OwnerBrandMark brand={info?.brand} />
        <span className="gl-spacer" />
        <Link className="gl-quiet" href="/">Leave</Link>
      </header>
      <main className="gl-main">
        <div className="gl-center gl-in">
          {!info ? (
            <>
              <JoinHero title="Join a game" subtitle="Enter the PIN on your teacher's screen. No account needed." />
              <form className="gl-card gl-join-card gl-form" onSubmit={(e) => { e.preventDefault(); lookUp(pin); }}>
                <div className="gl-field">
                  <label htmlFor="pin">Game PIN</label>
                  <input id="pin" type="text" inputMode="numeric" autoComplete="off" value={pin} autoFocus
                         onChange={(e) => { setPin(e.target.value.replace(/[^\d ]/g, "")); setError(null); }}
                         placeholder="123 456" maxLength={7} aria-describedby={error ? "join-error" : undefined} />
                </div>
                <button className="gl-btn gl-btn-big" type="submit" disabled={busy}>{busy ? "Looking…" : "Enter"}</button>
              </form>
            </>
          ) : (
            <>
              <JoinHero brand={info.brand} title={info.quizTitle} subtitle={`${info.workspaceName} · PIN ${formatPin(info.pin)}`} />
              <Buddy grade={info.lookGrade} />
              {info.joinAs === "SIGNED_IN" && (
                <div className="gl-card gl-join-card gl-form">
                  <p style={{ margin: 0 }}>You&apos;re playing as <strong>{info.name}</strong>: your result is saved.</p>
                  <button className="gl-btn gl-btn-big" type="button" disabled={busy} onClick={join}>
                    {busy ? "Joining…" : "Join the game"}
                  </button>
                </div>
              )}
              {info.joinAs === "GUEST" && info.signInUrl && (
                <div className="gl-form">
                  <a className="gl-btn gl-btn-big" href={info.signInUrl}>Sign in through your school</a>
                  <p className="gl-sub" style={{ margin: 0, textAlign: "center" }}>
                    A student of {info.workspaceName}? Sign in to play as yourself and keep your result. Or join with a nickname:
                  </p>
                </div>
              )}
              {info.teamDevices === "SHARED" && info.teams && (
                <form className="gl-card gl-join-card gl-form" onSubmit={(e) => { e.preventDefault(); join(); }}>
                  <fieldset className="gl-field gl-team-pick">
                    <legend>Your team</legend>
                    {info.teams.map((name, i) => (
                      <label key={i} className={"gl-team-option" + (team === i + 1 ? " is-chosen" : "")}>
                        <input type="radio" name="team" checked={team === i + 1}
                               onChange={() => { setTeam(i + 1); setError(null); }} />
                        <span className={"team-badge team-" + (i + 1)}>{name}</span>
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="gl-field">
                    <legend>Who is playing on this device?</legend>
                    <span id="members-hint" className="hint">First names only, up to {MAX_MEMBERS}. Only your teacher sees them.</span>
                    {members.map((m, i) => (
                      <input key={i} type="text" value={m} maxLength={20} autoComplete="off" aria-describedby="members-hint"
                             aria-label={"First name " + (i + 1)}
                             onChange={(e) => { const next = [...members]; next[i] = e.target.value; setMembers(next); setError(null); }} />
                    ))}
                    {members.length < MAX_MEMBERS && (
                      <button type="button" className="gl-quiet" onClick={() => setMembers([...members, ""])}>Add a name</button>
                    )}
                  </fieldset>
                  {info.roomCheck && <PatternPad value={pattern} onChange={(update) => { setPattern(update); setError(null); }} />}
                  <button className="gl-btn gl-btn-big" type="submit"
                          disabled={busy || team === null || !members.some((m) => m.trim().length >= 2)
                            || (!!info.roomCheck && pattern.length < 4)}>
                    {busy ? "Joining…" : "Join as this team"}
                  </button>
                </form>
              )}
              {info.joinAs === "GUEST" && info.teamDevices !== "SHARED" && (
                <form className="gl-card gl-join-card gl-form" onSubmit={(e) => { e.preventDefault(); join(); }}>
                  <div className="gl-field">
                    <label htmlFor="nickname">Your nickname</label>
                    <input id="nickname" type="text" autoComplete="nickname" value={nickname} maxLength={20} autoFocus
                           onChange={(e) => { setNickname(e.target.value); setError(null); }} placeholder="e.g. Sam"
                           aria-describedby="nickname-hint" />
                    <span id="nickname-hint" className="hint">2 to 20 characters. Everyone in the game sees it.</span>
                    <button type="button" className="gl-quiet" onClick={() => { setNickname(suggestNickname()); setError(null); }}>
                      Suggest a name
                    </button>
                  </div>
                  {info.roomCheck && <PatternPad value={pattern} onChange={(update) => { setPattern(update); setError(null); }} />}
                  <button className="gl-btn gl-btn-big" type="submit"
                          disabled={busy || nickname.trim().length < 2 || (!!info.roomCheck && pattern.length < 4)}>
                    {busy ? "Joining…" : "Join the game"}
                  </button>
                </form>
              )}
              {info.joinAs === "SIGN_IN_FIRST" && (
                <div className="gl-form">
                  <div className="gl-alert">
                    This game is for signed-in students of {info.workspaceName}. Sign in, and you&apos;ll come straight back to it.
                  </div>
                  {info.signInUrl && <a className="gl-btn gl-btn-big" href={info.signInUrl}>Sign in through your school</a>}
                </div>
              )}
              <button type="button" className="gl-quiet" onClick={() => { setInfo(null); setError(null); }}>
                Use another PIN
              </button>
            </>
          )}
          {error && <div id="join-error" className="gl-alert danger" role="alert">{error}</div>}
        </div>
      </main>
    </GameLook>
  );
}
