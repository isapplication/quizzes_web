"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizePin } from "@/lib/pin";

/** "Joining a game?": the 6-digit PIN from the teacher's screen, then the game page. */
export function JoinWithPin() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  function join() {
    const clean = normalizePin(pin);
    if (!clean) {
      setError("A game PIN is 6 digits. Check the number on your teacher's screen.");
      return;
    }
    router.push("/play?pin=" + clean);
  }

  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); join(); }}>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <label htmlFor="join-pin" className="sr-only">Game PIN</label>
        <input id="join-pin" type="text" inputMode="numeric" autoComplete="off" maxLength={7} placeholder="Game PIN"
               value={pin} onChange={(e) => { setPin(e.target.value.replace(/[^\d ]/g, "")); setError(null); }}
               className="code-input" style={{ flex: "1 1 160px" }} />
        <button className="btn btn-primary btn-big" type="submit">Join</button>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
    </form>
  );
}
