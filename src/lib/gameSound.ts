"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Band } from "@/lib/gameLook";

/**
 * Live game sounds, made in the browser (no audio files to license or load). Each family has its own voice: soft
 * marimba for K–2, bright tones for 3–5, 8-bit blips for 6–8 and quiet chimes for 9–12. The host screen plays the
 * lobby tune, the reveal and the podium fanfare; every player's phone plays its own taps, ticks and right/wrong
 * sounds. The mute choice is kept on each device.
 *
 * Lobby music (wave2-plan.md, W36): the host picks one of the four family tunes, or none, and a volume, for any look; the
 * choice is kept on the host's device. All of it is made here, so there are no audio files and nothing to license. Sound
 * starts only after a tap or key press (a browser's rule), and the sound switch mutes the music too.
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

/** `level`: 0 to 1, the share of the family's usual volume (the host's volume control; 1 for everything else). */
function play(ctx: AudioContext, band: Band, sound: GameSoundName, level = 1) {
  const { wave, volume, base } = VOICE[band];
  const note = (semitones: number, at: number, length: number, v = volume) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + at;
    osc.type = wave;
    osc.frequency.value = base * Math.pow(2, semitones / 12);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, v * level), t + 0.01);
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

/** The four built-in lobby tunes, one per family, and "none". Any tune plays in any look. */
export type LobbyTune = Band | "off";

export const LOBBY_TUNES: { value: LobbyTune; label: string }[] = [
  { value: "k2", label: "Playful marimba (Kindergarten to 2)" },
  { value: "e35", label: "Bright tones (3 to 5)" },
  { value: "m68", label: "Retro blips (6 to 8)" },
  { value: "h912", label: "Calm chimes (9 to 12)" },
  { value: "off", label: "No music" },
];

export interface LobbyMusic {
  /** The host's tune; null until they choose, which plays the game's own family tune. */
  tune: LobbyTune | null;
  /** 0 to 100. */
  volume: number;
}

export const DEFAULT_LOBBY_VOLUME = 70;
const MUSIC = "quizplayo.sound.lobby";

/** Reads the saved choice. Anything unreadable gives the default (the game's own tune, volume 70). */
export function parseLobbyMusic(raw: string | null | undefined): LobbyMusic {
  const none: LobbyMusic = { tune: null, volume: DEFAULT_LOBBY_VOLUME };
  if (!raw) return none;
  try {
    const v = JSON.parse(raw) as { tune?: unknown; volume?: unknown };
    const tune = LOBBY_TUNES.some((t) => t.value === v.tune) ? (v.tune as LobbyTune) : null;
    const volume = typeof v.volume === "number" && Number.isFinite(v.volume) ? Math.round(Math.min(100, Math.max(0, v.volume))) : DEFAULT_LOBBY_VOLUME;
    return { tune, volume };
  } catch {
    return none;
  }
}

/** The tune that plays: the host's choice, else the game's own family tune. */
export function chosenTune(music: LobbyMusic, look: Band): LobbyTune {
  return music.tune ?? look;
}

/** The volume control's 0 to 100 as a gain: squared, so equal steps sound about equally different. */
export function lobbyLevel(volume: number): number {
  const v = Math.min(100, Math.max(0, volume)) / 100;
  return v * v;
}

/** Plays one pass of a lobby tune. False when the browser has not allowed sound yet (no tap or key press so far). */
function playLobbyPass(tune: Band, volume: number): boolean {
  if (!shared || shared.state !== "running") return false;
  play(shared, tune, "lobby", lobbyLevel(volume));
  return true;
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

/**
 * The host's lobby music while {@code active}: the chosen tune repeats while players join, at the chosen volume, and the
 * choice is kept on this device. A change plays at once, so the host hears it. {@code muted} (the sound switch) silences it.
 * Nothing plays until the browser lets this page make sound, which happens at the first tap or key press.
 */
export function useLobbyMusic(look: Band, active: boolean, muted: boolean) {
  const [music, setMusic] = useState<LobbyMusic>({ tune: null, volume: DEFAULT_LOBBY_VOLUME });
  const volumeRef = useRef(music.volume);
  volumeRef.current = music.volume;
  const tune = chosenTune(music, look);

  useEffect(() => {
    try {
      setMusic(parseLobbyMusic(window.localStorage.getItem(MUSIC)));
    } catch {
      // Storage blocked: the defaults apply.
    }
  }, []);

  const save = useCallback((next: LobbyMusic) => {
    setMusic(next);
    try {
      window.localStorage.setItem(MUSIC, JSON.stringify(next));
    } catch {
      // Storage blocked: the choice lasts until the page closes.
    }
  }, []);

  // The loop: a pass now, then another each time one has finished.
  useEffect(() => {
    if (!active || muted || tune === "off") return;
    let started = playLobbyPass(tune, volumeRef.current);
    const id = setInterval(() => { started = playLobbyPass(tune, volumeRef.current) || started; }, lobbyLength(tune) + 1500);
    // Before the first tap the browser stays silent: begin as soon as the host touches the page.
    const begin = () => {
      if (started) return;
      setTimeout(() => { started = playLobbyPass(tune, volumeRef.current); }, 60);
    };
    window.addEventListener("pointerdown", begin);
    window.addEventListener("keydown", begin);
    return () => {
      clearInterval(id);
      window.removeEventListener("pointerdown", begin);
      window.removeEventListener("keydown", begin);
    };
  }, [active, muted, tune]);

  // Moving the volume plays one pass shortly after the host stops, so they hear the new level.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!active || muted || tune === "off") return;
    const id = setTimeout(() => playLobbyPass(tune, volumeRef.current), 350);
    return () => clearTimeout(id);
  }, [music.volume]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    tune,
    volume: music.volume,
    setTune: (value: LobbyTune) => save({ ...music, tune: value }),
    setVolume: (value: number) => save({ ...music, volume: Math.round(Math.min(100, Math.max(0, value))) }),
  };
}
