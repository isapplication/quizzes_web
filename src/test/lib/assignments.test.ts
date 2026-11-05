import { describe, expect, it } from "vitest";
import { rightText } from "../../lib/assignments";

describe("rightText: how an attempt went, in words", () => {
  it("counts only scored questions as right", () => {
    expect(rightText({ correct: 5, scored: 5, cards: 0, cardsKnown: 0 })).toBe("5 of 5 right");
  });

  it("counts flashcards as known, never as right", () => {
    expect(rightText({ correct: 0, scored: 0, cards: 8, cardsKnown: 6 })).toBe("knew 6 of 8 cards");
    expect(rightText({ correct: 1, scored: 1, cards: 2, cardsKnown: 1 })).toBe("1 of 1 right · knew 1 of 2 cards");
  });

  it("says nothing rather than 0 of 0 when only polls or slides were asked", () => {
    expect(rightText({ correct: 0, scored: 0, cards: 0, cardsKnown: 0 })).toBeNull();
  });

  it("reads an older server's answer, which has no scored count", () => {
    expect(rightText({ correct: 3, questions: 4 })).toBe("3 of 4 right");
  });
});
