import { describe, expect, it } from "vitest";
import { ADJECTIVES, ANIMALS, suggestNickname } from "../../lib/nicknames";

describe("suggestNickname", () => {
  it("always fits the server's 2 to 20 characters and allowed letters", () => {
    for (let i = 0; i < 500; i++) {
      const n = suggestNickname();
      expect(n.length).toBeGreaterThanOrEqual(2);
      expect(n.length).toBeLessThanOrEqual(20);
      expect(n).toMatch(/^[\p{L}\p{M}\p{N} ._'!-]+$/u);
    }
  });

  it("every word pair fits in 20 characters", () => {
    for (const a of ADJECTIVES) for (const b of ANIMALS) expect((a + " " + b).length).toBeLessThanOrEqual(20);
  });
});
