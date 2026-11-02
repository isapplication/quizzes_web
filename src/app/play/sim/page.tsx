"use client";

import { useEffect, useState } from "react";
import { PlayerGame } from "@/components/PlayerGame";

/**
 * Development only: one simulated student device inside the class simulator. Its game ticket comes in
 * the URL fragment (never sent to a server) from the teacher's class simulator page.
 */
export default function SimulatedDevice() {
  const [device, setDevice] = useState<{ t: string; u: string; p: string; n: string } | null>(null);

  useEffect(() => {
    const f = new URLSearchParams(window.location.hash.slice(1));
    const t = f.get("t");
    const u = f.get("u");
    const p = f.get("p");
    if (t && u && p) setDevice({ t, u, p, n: f.get("n") ?? "Student" });

    // The simulator page can ask this device to tap a random answer.
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== "auto-answer") return;
      const tiles = Array.from(document.querySelectorAll<HTMLButtonElement>(".answer-tile:not(:disabled)"));
      if (tiles.length > 0) tiles[Math.floor(Math.random() * tiles.length)].click();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!device) return <p style={{ padding: 12 }}>No game ticket.</p>;
  return <PlayerGame url={device.u} pin={device.p} ticket={device.t} name={device.n} compact />;
}
