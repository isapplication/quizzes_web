"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { api } from "@/lib/api";
import { normalizePin } from "@/lib/pin";

interface SimTicket {
  userId: string;
  name: string;
  ticket: string;
}

/**
 * Development only (isquiz.dev-tools): play one live game as up to 30 students of the class, each in its
 * own frame with its own CometD connection and game ticket, so a single person can run a full class game
 * by hand. Open the host screen in another window.
 */
export default function ClassSimulatorPage() {
  return (
    <AppFrame wide>
      <Suspense>
        <ClassSimulator />
      </Suspense>
    </AppFrame>
  );
}

function ClassSimulator() {
  const params = useSearchParams();
  const [pin, setPin] = useState(params.get("pin") ?? "");
  const [count, setCount] = useState(30);
  const [devices, setDevices] = useState<SimTicket[]>([]);
  const [cometdUrl, setCometdUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const frames = useRef<(HTMLIFrameElement | null)[]>([]);

  async function open(e: React.FormEvent) {
    e.preventDefault();
    const clean = normalizePin(pin);
    if (!clean) {
      setError("Enter the 6-digit PIN of a game you are hosting.");
      return;
    }
    setError(null);
    try {
      const host = await api<{ cometdUrl: string }>(`/api/v1/live/games/${clean}/host`);
      setCometdUrl(host.cometdUrl);
      setDevices(await api<SimTicket[]>(`/api/v1/dev/live/${clean}/class-tickets`, { method: "POST", body: { count } }));
      setPin(clean);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open the class.");
    }
  }

  function everyoneAnswers() {
    frames.current.forEach((f, i) =>
      setTimeout(() => f?.contentWindow?.postMessage({ type: "auto-answer" }, window.location.origin), 150 + i * 60 + Math.random() * 1500),
    );
  }

  return (
    <div className="stack">
      <h1>Class simulator</h1>
      <p className="muted">
        Development only. Each frame below is one student device with its own connection and game ticket. Tap answers in
        each frame by hand, or let everyone answer at random.
      </p>
      <form className="row card" onSubmit={open}>
        <label htmlFor="pin">Game PIN</label>
        <input id="pin" type="text" value={pin} onChange={(e) => setPin(e.target.value)} style={{ width: 120 }} />
        <label htmlFor="count">Students</label>
        <input id="count" type="number" min={1} max={60} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 80 }} />
        <button className="btn btn-primary" type="submit">Open the class</button>
        <span className="spacer" />
        {devices.length > 0 && (
          <button className="btn btn-secondary" type="button" onClick={everyoneAnswers}>Everyone answers</button>
        )}
      </form>
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="sim-grid">
        {devices.map((d, i) => (
          <iframe
            key={d.userId}
            ref={(el) => {
              frames.current[i] = el;
            }}
            title={d.name}
            src={`/play/sim#${new URLSearchParams({ t: d.ticket, u: cometdUrl, p: pin, n: d.name }).toString()}`}
          />
        ))}
      </div>
    </div>
  );
}
