"use client";

import { CHARACTERS, characterName } from "@/lib/characters";
import { CharacterAvatar } from "./CharacterAvatar";

/**
 * "Pick a character" on the join page: 24 animals as one radio group, so the keyboard (Tab to the group, then the arrow
 * keys) and a screen reader (each is read by name, with "n of 24") work without extra code. Optional: a player may pick
 * none. The choice is shown with a ring and a tick as well as a colour, and said in words below.
 */
export function CharacterPicker({ value, onChange }: { value: number | null; onChange: (character: number | null) => void }) {
  const name = characterName(value);
  return (
    <fieldset className="gl-chars">
      <legend>Pick a character <span className="hint">(optional)</span></legend>
      <div className="gl-char-grid">
        {CHARACTERS.map((c, i) => (
          <label key={c.name} className="gl-char-opt">
            <input type="radio" name="character" value={i} checked={value === i} onChange={() => onChange(i)} />
            <span className="gl-char-face"><CharacterAvatar character={i} size={44} /></span>
            <span className="sr-only">{c.name}</span>
          </label>
        ))}
      </div>
      <div className="gl-char-status" role="status">
        {name ? (
          <>
            <span>You&apos;re the <b>{name}</b>.</span>
            <button type="button" className="gl-quiet" onClick={() => onChange(null)}>No character</button>
          </>
        ) : (
          <span>No character picked.</span>
        )}
      </div>
    </fieldset>
  );
}
