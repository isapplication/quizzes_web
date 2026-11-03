import { describe, expect, it } from "vitest";
import { partsLabel } from "../../lib/library";

describe("partsLabel", () => {
  it("counts a quiz's questions, an activity's rounds and a set's cards", () => {
    expect(partsLabel({ format: null, questionCount: 8 })).toBe("8 questions");
    expect(partsLabel({ format: "MATCH", questionCount: 3 })).toBe("3 rounds");
    expect(partsLabel({ format: "ORDER", questionCount: 1 })).toBe("1 round");
    expect(partsLabel({ format: "CARDS", questionCount: 8 })).toBe("8 cards");
  });
});
