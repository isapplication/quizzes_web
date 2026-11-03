import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, lookBand, lookCharacter, lookChoices, lookGrade } from "../../lib/gameLook";

describe("game looks", () => {
  it("puts each grade in its family", () => {
    expect([0, 1, 2].map(lookBand)).toEqual(["k2", "k2", "k2"]);
    expect([3, 4, 5].map(lookBand)).toEqual(["e35", "e35", "e35"]);
    expect([6, 7, 8].map(lookBand)).toEqual(["m68", "m68", "m68"]);
    expect([9, 10, 11, 12].map(lookBand)).toEqual(["h912", "h912", "h912", "h912"]);
  });

  it("shows the default look for a game without one", () => {
    for (const none of [null, undefined, -1, 13, 4.5]) expect(lookGrade(none)).toBe(DEFAULT_LOOK);
    expect(lookBand(null)).toBe("h912");
  });

  it("gives Kindergarten to Grade 5 a character and older grades none", () => {
    expect([0, 1, 2, 3, 4, 5].map(lookCharacter)).toEqual(["owl", "fox", "turtle", "rocket", "whale", "toucan"]);
    expect([6, 9, 12].map(lookCharacter)).toEqual([null, null, null]);
  });

  it("lists every grade once, the quiz's own first", () => {
    const choices = lookChoices(4);
    expect(choices[0]).toEqual({ value: 4, label: "Grade 4 (this quiz)" });
    expect(choices.map((c) => c.value).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(lookChoices(0)[0].label).toBe("Kindergarten (this quiz)");
  });
});
