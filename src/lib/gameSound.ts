"use client";

import { useCallback, useEffect, useState } from "react";
import type { Band } from "@/lib/gameLook";

/**
 * Live game sounds, made in the browser (no audio files to license or load). Each family has its own voice: soft
 * marimba for K–2, bright tones for 3–5, 8-bit blips for 6–8 and quiet chimes for 9–12. The host screen plays the
 * lobby tune, the reveal and the podium fanfare; every player's phone plays its own taps, ticks and right/wrong
 * sounds. The mute choice is kept on each device.
 */
export type GameSoundName =
  | "lobby" | "tick" | "reveal" | "fanfare"
  | "joined" | "tap" | "correct" | "wrong";

const MUTED = "quizplayo.sound.muted";

const VOICE: Record<Band, { wave: OscillatorType; volume: number; base: number }> = {
  k2: { wave: "sine", volume: 0.22, base: 523.25 },
  e35: { wave: "triangle", volume: 0.16, base: 440 },
  m68: { wave: "square", volume: 0.06, base: 330 },
  h912: { wave: "sine", volume: 0.12, base: 392 },
};

// One audio context for the whole tab: a browser lets it play only after a tap or key press, and the join tap on
// /play must still count once the game screen replaces the join form.
let shared: AudioContext | null = null;

/** Call from a tap or key handler (the join button, any tap on a game screen) so sound may play. */
export function unlockGameSound() {
  if (typeof window === "undefined" || !("AudioContext" in window)) return;
  shared ??= new AudioContext();
  if (shared.state === "suspended") void shared.resume();
}

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
    case "tap":
      note(12, 0, 0.08, volume * 0.7);
      break;
    case "joined":
      run([7, 12], 0.12, 0.3, volume * 0.8);
      break;
    case "correct":
      if (calm) run([7, 12], 0.12, 0.6);
      else run([0, 4, 7, 12], 0.07, 0.3);
      break;
    case "wrong":
      // Gentle and low, never a buzzer: a wrong answer is part of learning.
      run([3, -2], 0.18, calm ? 0.5 : 0.35, volume * 0.7);
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

/** Sounds for a game screen in this family, and the mute switch. Any tap on the page also unlocks sound. */
export function useGameSound(band: Band) {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTED) === "1");
    } catch {
      // Storage blocked: sound starts on.
    }
    window.addEventListener("pointerdown", unlockGameSound);
    window.addEventListener("keydown", unlockGameSound);
    return () => {
      window.removeEventListener("pointerdown", unlockGameSound);
      window.removeEventListener("keydown", unlockGameSound);
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
    if (muted || !shared || shared.state !== "running") return;
    play(shared, band, name);
  }, [band, muted]);

  /** A short buzz on phones that support it, with the right/wrong sound; nothing when muted. */
  const buzz = useCallback((pattern: number | number[]) => {
    if (muted) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      // Not supported: sound alone.
    }
  }, [muted]);

  return { sound, buzz, muted, toggle };
}
