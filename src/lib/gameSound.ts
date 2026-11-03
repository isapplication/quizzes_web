"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Band } from "@/lib/gameLook";

/**
 * The host screen's sounds, made in the browser (no audio files to license or load). Each family has its own voice:
 * soft marimba for K–2, bright tones for 3–5, 8-bit blips for 6–8 and quiet chimes for 9–12. Players' phones stay
 * silent. The mute choice is kept on this device.
 */
export type GameSoundName = "lobby" | "tick" | "reveal" | "fanfare";

const MUTED = "quizplayo.sound.muted";

const VOICE: Record<Band, { wave: OscillatorType; volume: number; base: number }> = {
  k2: { wave: "sine", volume: 0.22, base: 523.25 },
  e35: { wave: "triangle", volume: 0.16, base: 440 },
  m68: { wave: "square", volume: 0.06, base: 330 },
  h912: { wave: "sine", volume: 0.12, base: 392 },
};

function play(ctx: AudioContext, band: Band, sound: GameSoundName) {
  const { wave, volume, base } = VOICE[band];
  const note = (semitones: number, at: number, length: number, v = volume) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + at;
    osc.type = wave;
    osc.frequency.value = base * Math.pow(2, semitones / 12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(v, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + length + 0.05);
  };
  const run = (notes: (number | null)[], step: number, length: number, v?: number) =>
    notes.forEach((n, i) => n !== null && note(n, i * step, length, v));
  const calm = band === "h912";
  switch (sound) {
    case "tick":
      note(band === "m68" ? 22 : 17, 0, 0.06, volume * 0.6);
      break;
    case "reveal":
      if (calm) note(7, 0, 1.2);
      else run([0, 4, 7, 12], 0.09, 0.35);
      break;
    case "fanfare":
      if (calm) run([0, 4, 7], 0.25, 1.6);
      else run([0, 4, 7, 12, null, 7, 12], 0.13, 0.4);
      break;
    case "lobby":
      if (calm) run([0, 7, 4, 9], 0.6, 1.1, volume * 0.6);
      else run([0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 12, 9, 7, 4, 0], 0.16, 0.2, volume * 0.7);
      break;
  }
}

/** How long one pass of the lobby tune lasts, so it can repeat while players join. */
export function lobbyLength(band: Band): number {
  return band === "h912" ? 4000 : 3200;
}

/** Sounds for the host screen in this family, and the mute switch. A browser plays sound only after a click. */
export function useGameSound(band: Band) {
  const ctx = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTED) === "1");
    } catch {
      // Storage blocked: sound starts on.
    }
    // Browsers keep audio locked until the page is clicked: unlock it on the first click.
    const unlock = () => {
      ctx.current ??= new AudioContext();
      if (ctx.current.state === "suspended") void ctx.current.resume();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      void ctx.current?.close();
      ctx.current = null;
    };
  }, []);

  const toggle = useCallback(() => {
    setMuted((m) => {
      try {
        window.localStorage.setItem(MUTED, m ? "0" : "1");
      } catch {
        // Storage blocked: the choice lasts until the page closes.
      }
      return !m;
    });
  }, []);

  const sound = useCallback((name: GameSoundName) => {
    const c = ctx.current;
    if (muted || !c || c.state !== "running") return;
    play(c, band, name);
  }, [band, muted]);

  return { sound, muted, toggle };
}
