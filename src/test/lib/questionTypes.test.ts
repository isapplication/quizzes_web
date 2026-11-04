import { describe, expect, it } from "vitest";
import {
  blank, changeType, decimalsOf, type EditorQuestion, formatNumber, fromServer, keyText, missing, normaliseTyped, onStep,
  outcomeOf, pickOf, position, QTYPES, sliderStart, snap, stepCount, toggle, toServer,
} from "../../lib/questionTypes";
import { SHAPE_NAMES, shapeName, shapeNumber } from "../../components/AnswerShape";
import { typedAnswer } from "../../lib/assignments";

function q(type: EditorQuestion["type"], patch: Partial<EditorQuestion> = {}): EditorQuestion {
  return { ...blank(type), text: "What?", ...patch };
}

describe("fromServer", () => {
  it("reads the old single correctIndex when correctIndexes is missing", () => {
    const e = fromServer({ type: "QUIZ", text: "a", timeLimitSeconds: 20, points: 1, choices: ["x", "y"], correctIndex: 1, explanation: null });
    expect(e.correctIndexes).toEqual([1]);
    expect(e.payload).toEqual({});
  });

  it("prefers correctIndexes and reads the payload per type", () => {
    expect(fromServer({ type: "MULTI_SELECT", choices: ["a", "b", "c"], correctIndexes: [0, 2], correctIndex: -1 }).correctIndexes).toEqual([0, 2]);
    expect(fromServer({ type: "TYPE_ANSWER", payload: { accept: ["Paris"] } }).payload.accept).toEqual(["Paris"]);
    expect(fromServer({ type: "SLIDER", payload: { min: 0, max: 10, step: 0.5, answer: 7.5, tol: 1, unit: "m" } }).payload)
      .toEqual({ min: 0, max: 10, step: 0.5, answer: 7.5, tol: 1, unit: "m" });
    expect(fromServer({ type: "SLIDE", text: "body", payload: { title: "Hi" } }).payload.title).toBe("Hi");
  });

  it("a poll and a puzzle have no correct indexes; an unknown type opens as a quiz", () => {
    expect(fromServer({ type: "POLL", choices: ["a", "b"], correctIndex: 0 }).correctIndexes).toEqual([]);
    expect(fromServer({ type: "PUZZLE", choices: ["a", "b", "c"], correctIndexes: [0] }).correctIndexes).toEqual([]);
    expect(fromServer({ type: "SOMETHING" }).type).toBe("QUIZ");
  });
});

describe("toServer", () => {
  it("drops empty optional answers and re-numbers the right ones", () => {
    const wire = toServer(q("MULTI_SELECT", { choices: ["a", "b", "", "d", ""], correctIndexes: [3, 0] }));
    expect(wire.choices).toEqual(["a", "b", "d"]);
    expect(wire.correctIndexes).toEqual([0, 2]);
    expect(wire.correctIndex).toBe(-1);
  });

  it("keeps correctIndex for quiz and true/false", () => {
    expect(toServer(q("QUIZ", { choices: ["a", "b", "", ""], correctIndexes: [1] })).correctIndex).toBe(1);
    expect(toServer(q("TRUE_FALSE", { correctIndexes: [0] }))).toMatchObject({ choices: ["True", "False"], correctIndex: 0, correctIndexes: [0] });
  });

  it("sends each type's payload and no choices where there are none", () => {
    expect(toServer(q("TYPE_ANSWER", { payload: { accept: [" Paris ", ""] } }))).toMatchObject({ choices: [], payload: { accept: ["Paris"] } });
    expect(toServer(q("SLIDER", { payload: { min: 0, max: 10, step: 1, answer: 4, tol: 0, unit: " cm " } })).payload)
      .toEqual({ min: 0, max: 10, step: 1, answer: 4, tol: 0, unit: "cm" });
    expect(toServer(q("SLIDE", { payload: { title: " Hi " } }))).toMatchObject({ choices: [], correctIndexes: [], payload: { title: "Hi" } });
    expect(toServer(q("POLL", { choices: ["a", "b"], correctIndexes: [0] })).correctIndexes).toEqual([]);
    expect(toServer(q("PUZZLE", { choices: ["a", "b", "c", ""] }))).toMatchObject({ choices: ["a", "b", "c"], correctIndexes: [], payload: {} });
  });
});

describe("missing (mirrors the contract's limits)", () => {
  it("every blank question says what to do", () => {
    for (const t of QTYPES) expect(missing(blank(t))).toBeTruthy();
  });

  it("quiz: two answers, all different, exactly one marked", () => {
    expect(missing(q("QUIZ", { choices: ["a", "", "", ""] }))).toBe("Write at least two answers.");
    expect(missing(q("QUIZ", { choices: ["a", "a"] }))).toBe("Make every answer different.");
    expect(missing(q("QUIZ", { choices: ["a", "b"] }))).toBe("Mark the correct answer.");
    expect(missing(q("QUIZ", { choices: ["a", "b", "c", "d", "e", "f"], correctIndexes: [5] }))).toBeNull();
    expect(missing(q("QUIZ", { choices: ["a", "b", "c", "d", "e", "f", "g"], correctIndexes: [0] }))).toMatch(/at most six/);
  });

  it("multi-select: at least one right, and not every one", () => {
    expect(missing(q("MULTI_SELECT", { choices: ["a", "b", "c"] }))).toBe("Mark at least one correct answer.");
    expect(missing(q("MULTI_SELECT", { choices: ["a", "b"], correctIndexes: [0, 1] }))).toMatch(/Leave at least one/);
    expect(missing(q("MULTI_SELECT", { choices: ["a", "b", "c"], correctIndexes: [0, 2] }))).toBeNull();
  });

  it("poll: answers only, no right one", () => {
    expect(missing(q("POLL", { choices: ["Yes", "No"] }))).toBeNull();
  });

  it("type answer: 1 to 5 texts of up to 20 characters, different once normalised", () => {
    expect(missing(q("TYPE_ANSWER", { payload: { accept: [""] } }))).toBe("Add at least one accepted answer.");
    expect(missing(q("TYPE_ANSWER", { payload: { accept: ["x".repeat(21)] } }))).toMatch(/20 characters/);
    expect(missing(q("TYPE_ANSWER", { payload: { accept: ["a", "b", "c", "d", "e", "f"] } }))).toMatch(/at most five/);
    expect(missing(q("TYPE_ANSWER", { payload: { accept: ["Paris", "paris!"] } }))).toMatch(/the same/);
    expect(missing(q("TYPE_ANSWER", { payload: { accept: ["Paris", ""] } }))).toMatch(/empty accepted/);
    expect(missing(q("TYPE_ANSWER", { payload: { accept: ["Paris", "Lutetia"] } }))).toBeNull();
  });

  it("slider: a sound scale and an answer on a step", () => {
    const s = (p: object) => missing(q("SLIDER", { payload: { min: 0, max: 10, step: 1, answer: 5, tol: 0, unit: "", ...p } }));
    expect(s({})).toBeNull();
    expect(s({ answer: null })).toBe("Enter the right answer.");
    expect(s({ min: 10 })).toMatch(/bigger than the lowest/);
    expect(s({ step: 0 })).toMatch(/bigger than 0/);
    expect(s({ step: 0.001 })).toMatch(/at most 1,000/);
    expect(s({ step: 3 })).toMatch(/divide the range/);
    expect(s({ answer: 11 })).toMatch(/between the lowest and highest/);
    expect(s({ step: 2, answer: 5 })).toMatch(/on a step/);
    expect(s({ tol: 11 })).toMatch(/tolerance/);
    expect(s({ unit: "kilometres!" })).toMatch(/unit/);
    expect(s({ min: 0, max: 1, step: 0.1, answer: 0.3 })).toBeNull();
  });

  it("puzzle: 3 to 6 different items of up to 30 characters", () => {
    expect(missing(q("PUZZLE", { choices: ["a", "b", ""] }))).toMatch(/at least three/);
    expect(missing(q("PUZZLE", { choices: ["a", "b", "b"] }))).toBe("Make every item different.");
    expect(missing(q("PUZZLE", { choices: ["a", "b", "x".repeat(31)] }))).toMatch(/30 characters/);
    expect(missing(q("PUZZLE", { choices: ["Seed", "Sprout", "Tree"] }))).toBeNull();
  });

  it("slide: a title of up to 120 characters, text optional up to 300", () => {
    expect(missing(q("SLIDE", { text: "" }))).toBe("Give the slide a title.");
    expect(missing(q("SLIDE", { text: "", payload: { title: "Photosynthesis" } }))).toBeNull();
    expect(missing(q("SLIDE", { text: "x".repeat(301), payload: { title: "T" } }))).toMatch(/300/);
  });
});

describe("changeType", () => {
  it("keeps the answers between choice types, and only what fits", () => {
    const multi = q("MULTI_SELECT", { choices: ["a", "b", "c"], correctIndexes: [0, 2] });
    expect(changeType(multi, "QUIZ")).toMatchObject({ text: "What?", choices: ["a", "b", "c"], correctIndexes: [0] });
    expect(changeType(multi, "POLL").correctIndexes).toEqual([]);
    expect(changeType(multi, "SLIDER")).toMatchObject({ text: "What?", choices: [], payload: { min: 0, max: 10 } });
  });
});

describe("slider helpers", () => {
  it("counts decimals, steps and snaps without float drift", () => {
    expect(decimalsOf(1)).toBe(0);
    expect(decimalsOf(0.25)).toBe(2);
    expect(decimalsOf(2.5)).toBe(1);
    expect(stepCount(0, 1, 0.1)).toBe(10);
    expect(stepCount(0, 10, 3)).toBeNull();
    expect(onStep(0.3, 0, 0.1)).toBe(true);
    expect(snap(0.30000000000000004, { min: 0, max: 1, step: 0.1 })).toBe(0.3);
    expect(snap(12, { min: 0, max: 10, step: 1 })).toBe(10);
    expect(sliderStart({ min: 0, max: 9, step: 2 })).toBe(4);
    expect(formatNumber(7.5, 0.5, "m")).toMatch(/^7[.,]5 m$/);
    expect(position(5, 0, 10)).toBe(50);
    expect(position(-1, 0, 10)).toBe(0);
  });
});

describe("normaliseTyped (as the server judges)", () => {
  it("NFKC, case, trailing punctuation and inner spaces", () => {
    expect(normaliseTyped("  Photo   Synthesis!? ")).toBe("photo synthesis");
    expect(normaliseTyped("ＡＢＣ")).toBe("abc");
    expect(normaliseTyped("e.g.")).toBe("e.g");
  });
});

describe("keyText", () => {
  it("writes each kind's answer in words", () => {
    expect(keyText("QUIZ", {}, ["a", "b"], [1])).toBe("b");
    expect(keyText("MULTI_SELECT", {}, ["a", "b", "c"], [0, 2])).toBe("a, c");
    expect(keyText("TYPE_ANSWER", { accept: ["Paris", "Lutetia"] }, [], [])).toBe("Paris or Lutetia");
    expect(keyText("SLIDER", { answer: 7.5, tol: 0.5, unit: "m" }, [], [], 0.5)).toMatch(/^7[.,]5 m \(± 0[.,]5\)$/);
    expect(keyText("SLIDER", { answer: 4, tol: 0, unit: "" }, [], [], 1)).toBe("4");
    expect(keyText("PUZZLE", { order: ["Seed", "Sprout", "Tree"] }, [], [])).toBe("Seed → Sprout → Tree");
    expect(keyText("POLL", {}, ["a"], [])).toBeNull();
  });
});

describe("outcomeOf", () => {
  it("reads fraction and counted", () => {
    expect(outcomeOf({ answered: true, correct: true, fraction: 1 })).toBe("correct");
    expect(outcomeOf({ answered: true, correct: false, fraction: 0.5 })).toBe("partial");
    expect(outcomeOf({ answered: true, correct: false, fraction: 0 })).toBe("wrong");
    expect(outcomeOf({ answered: true, correct: false })).toBe("wrong");
    expect(outcomeOf({ answered: false, correct: false })).toBe("none");
    expect(outcomeOf({ answered: true, correct: false, counted: false })).toBe("vote");
  });
});

describe("small pieces", () => {
  it("toggle keeps picks in order", () => {
    expect(toggle([2], 0)).toEqual([0, 2]);
    expect(toggle([0, 2], 2)).toEqual([0]);
  });

  it("pick per type matches the contract", () => {
    expect(["QUIZ", "TRUE_FALSE", "POLL", "MULTI_SELECT", "TYPE_ANSWER", "SLIDER", "PUZZLE", "SLIDE"].map(pickOf))
      .toEqual(["one", "one", "one", "many", "text", "number", "order", "none"]);
  });

  it("six different shapes; the room pattern's four come first", () => {
    expect(new Set(SHAPE_NAMES).size).toBe(6);
    expect(SHAPE_NAMES.slice(0, 4)).toEqual(["drop", "star", "hexagon", "wave"]);
    expect([0, 3, 4, 5, 6].map(shapeNumber)).toEqual([1, 4, 5, 6, 1]);
    expect(shapeName(5)).toBe("square");
  });

  it("assignment answers carry both the flat and the nested form", () => {
    expect(typedAnswer.choices([0, 2])).toEqual({ choices: [0, 2], answer: { choices: [0, 2] } });
    expect(typedAnswer.value(7.5)).toEqual({ value: 7.5, answer: { value: 7.5 } });
    expect(typedAnswer.seen()).toEqual({ answer: {} });
  });
});
