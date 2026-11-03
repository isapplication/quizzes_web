"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PlayerGame } from "@/components/PlayerGame";
import { api, ApiError } from "@/lib/api";
import type { ShownBrand } from "@/lib/me";
import { formatPin, normalizePin } from "@/lib/pin";
import { OwnerBrandMark } from "@/components/OwnerBrand";

interface Joined {
  gameId: string;
  pin: string;
  quizTitle: string;
  cometdUrl: string;
  ticket: string;
  name: string;
  brand: ShownBrand;
  guest: boolean;
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
}

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
    setBusy(true);
    setError(null);
    try {
      const j = await api<Joined>("/api/v1/live/join", { method: "POST", body: { pin: info.pin, nickname } });
      save(j);
      setJoined(j);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not join you to the game. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const p = params.get("pin");
    if (p) lookUp(p);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (joined) {
    return <PlayerGame url={joined.cometdUrl} pin={joined.pin} ticket={joined.ticket} name={joined.name}
                       quizTitle={joined.quizTitle} brand={joined.brand} />;
  }

  return (
    <div className="stage">
      <div className="stage-bar">
        <OwnerBrandMark brand={info?.brand} />
        <span className="spacer" />
        <Link className="btn btn-light" style={{ padding: "4px 12px" }} href="/">Leave</Link>
      </div>
      <main className="stage-main" style={{ maxWidth: 480 }}>
        {!info ? (
          <form className="pin-box stack" onSubmit={(e) => { e.preventDefault(); lookUp(pin); }}>
            <label htmlFor="pin" style={{ fontSize: 18 }}>Game PIN</label>
            <input id="pin" type="text" inputMode="numeric" autoComplete="off" value={pin} autoFocus
                   onChange={(e) => { setPin(e.target.value.replace(/[^\d ]/g, "")); setError(null); }}
                   className="code-input" style={{ fontSize: 32, width: "100%" }} placeholder="123 456" maxLength={7} />
            <button className="btn btn-primary" type="submit" disabled={busy} style={{ fontSize: 20, width: "100%" }}>
              {busy ? "Looking…" : "Enter"}
            </button>
          </form>
        ) : (
          <div className="pin-box stack">
            <div>
              <p className="muted" style={{ margin: 0 }}>{info.workspaceName} · PIN {formatPin(info.pin)}</p>
              <h1 style={{ margin: "4px 0 0", fontSize: 24 }}>{info.quizTitle}</h1>
            </div>
            {info.joinAs === "SIGNED_IN" && (
              <>
                <p style={{ margin: 0 }}>You&apos;re playing as <strong>{info.name}</strong>: your result is saved.</p>
                <button className="btn btn-primary" type="button" disabled={busy} style={{ fontSize: 20, width: "100%" }}
                        onClick={join}>
                  {busy ? "Joining…" : "Join the game"}
                </button>
              </>
            )}
            {info.joinAs === "GUEST" && (
              <form className="stack" onSubmit={(e) => { e.preventDefault(); join(); }}>
                <label htmlFor="nickname" style={{ fontSize: 18 }}>Your nickname</label>
                <input id="nickname" type="text" autoComplete="nickname" value={nickname} maxLength={20} autoFocus
                       onChange={(e) => { setNickname(e.target.value); setError(null); }}
                       style={{ fontSize: 24, textAlign: "center", width: "100%" }} placeholder="e.g. Sam" />
                <p className="hint" style={{ margin: 0 }}>2 to 20 characters. Everyone in the game sees it.</p>
                <button className="btn btn-primary" type="submit" disabled={busy || nickname.trim().length < 2}
                        style={{ fontSize: 20, width: "100%" }}>
                  {busy ? "Joining…" : "Join the game"}
                </button>
              </form>
            )}
            {info.joinAs === "SIGN_IN_FIRST" && (
              <>
                <div className="alert alert-warning" style={{ margin: 0 }}>
                  This game is for signed-in students of {info.workspaceName}. Sign in, and you&apos;ll come straight back to it.
                </div>
                {info.signInUrl && <a className="btn btn-primary" href={info.signInUrl} style={{ fontSize: 20 }}>Sign in through your school</a>}
              </>
            )}
            <button type="button" className="btn btn-light" onClick={() => { setInfo(null); setError(null); }}>
              Use another PIN
            </button>
          </div>
        )}
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
      </main>
    </div>
  );
}
