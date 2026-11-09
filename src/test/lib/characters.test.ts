import { describe, expect, it } from "vitest";
import { CHARACTER_COUNT, CHARACTERS, characterName, isCharacter, readStoredCharacter, slotColor } from "../../lib/characters";

describe("player characters: the built-in set", () => {
  it("has exactly the 24 characters the Quiz API and the game server allow", () => {
    expect(CHARACTERS).toHaveLength(CHARACTER_COUNT);
    expect(CHARACTER_COUNT).toBe(24);
  });

  it("gives every character its own name and some shapes to draw", () => {
    expect(new Set(CHARACTERS.map((c) => c.name)).size).toBe(24);
    for (const c of CHARACTERS) expect(c.pieces.length).toBeGreaterThan(3);
  });

  it("draws only with theme colours, never raw ones", () => {
    for (const c of CHARACTERS) {
      for (const piece of c.pieces) {
        for (const slot of [piece.fill, piece.stroke]) {
          if (slot) expect(slotColor(slot)).toMatch(/^var\(--[a-z0-9-]+(, var\(--[a-z0-9-]+\))?\)$/);
        }
        expect(Object.values(piece.attrs).join(" ")).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
      }
    }
  });

  it("knows a character from a number outside the set", () => {
    expect(isCharacter(0)).toBe(true);
    expect(isCharacter(23)).toBe(true);
    expect(isCharacter(24)).toBe(false);
    expect(isCharacter(-1)).toBe(false);
    expect(isCharacter(2.5)).toBe(false);
    expect(isCharacter(null)).toBe(false);
    expect(isCharacter("3")).toBe(false);
    expect(characterName(1)).toBe("Dog");
    expect(characterName(99)).toBeNull();
    expect(characterName(undefined)).toBeNull();
  });

  it("reads the choice kept on the device, and ignores anything else", () => {
    expect(readStoredCharacter("7")).toBe(7);
    expect(readStoredCharacter("0")).toBe(0);
    expect(readStoredCharacter("24")).toBeNull();
    expect(readStoredCharacter("fox")).toBeNull();
    expect(readStoredCharacter("")).toBeNull();
    expect(readStoredCharacter(null)).toBeNull();
  });
});
