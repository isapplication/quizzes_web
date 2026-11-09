"use client";

import { useId } from "react";
import { LOBBY_TUNES, type LobbyTune } from "@/lib/gameSound";

/**
 * The host's lobby music: one of the four built-in tunes (any look may play any of them) or none, and a volume. Native
 * select and range controls, so the keyboard and screen readers work as they are. The header's sound switch still
 * mutes everything, music included. Kept on this device (lib/gameSound.ts).
 */
export function LobbyMusic({ tune, volume, muted, onTune, onVolume }: {
  tune: LobbyTune;
  volume: number;
  muted: boolean;
  onTune: (tune: LobbyTune) => void;
  onVolume: (volume: number) => void;
}) {
  const id = useId();
  return (
    <div className="gl-card gl-music gl-in">
      <div className="gl-music-field">
        <label htmlFor={id + "-tune"}>Lobby music</label>
        <select id={id + "-tune"} value={tune} onChange={(e) => onTune(e.target.value as LobbyTune)}>
          {LOBBY_TUNES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className="gl-music-field">
        <label htmlFor={id + "-volume"}>Volume</label>
        <input id={id + "-volume"} type="range" min={0} max={100} step={5} value={volume} disabled={tune === "off"}
               aria-valuetext={volume + " percent"} onChange={(e) => onVolume(Number(e.target.value))} />
      </div>
      {muted && tune !== "off" && <p className="gl-music-note" role="status">Sound is off: turn it on to hear the music.</p>}
    </div>
  );
}
