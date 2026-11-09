import { describe, expect, it } from "vitest";
import { blank, fromServer, imageProblem, insideArea, missing, pickOf, revealStep, scored, toServer } from "../../lib/questionTypes";

/** Wave 2 question types in the editor and screens (wave2-contract.md). */
describe("Wave 2 question types", () => {
  it("answer with their own picks and are never scored, except a pin answer", () => {
    expect(pickOf("SCALE")).toBe("scale");
    expect(pickOf("WORD_CLOUD")).toBe("word");
    expect(pickOf("OPEN_ENDED")).toBe("long");
    expect(pickOf("PIN_ANSWER")).toBe("point");
    expect(pickOf("DROP_PIN")).toBe("point");
    expect(pickOf("BRAINSTORM")).toBe("ideas");
    expect((["SCALE", "WORD_CLOUD", "OPEN_ENDED", "DROP_PIN", "BRAINSTORM"] as const).map((t) => scored(t))).toEqual([false, false, false, false, false]);
    expect(scored("PIN_ANSWER")).toBe(true);
  });

  it("a scale is checked and sent with its ends and labels", () => {
    const q = { ...blank("SCALE"), text: "How sure?" };
    expect(missing(q)).toBe("Label both ends of the scale.");
    q.payload = { min: 0, max: 10, lowLabel: " Not ", highLabel: "Very" };
    expect(missing(q)).toBeNull();
    expect(toServer(q).payload).toEqual({ min: 0, max: 10, lowLabel: "Not", highLabel: "Very" });
    expect(missing({ ...q, payload: { ...q.payload, min: 2 } })).toBe("Start the scale at 0 or 1.");
    expect(fromServer({ type: "SCALE", payload: { min: 1, max: 5, lowLabel: "a", highLabel: "b" } }).payload.max).toBe(5);
  });

  it("an image question needs a secure image with alt text, and a pin answer its areas", () => {
    expect(imageProblem(null)).toBe("Add an image.");
    expect(imageProblem({ url: "http://x.test/a.png", alt: "A" })).toContain("secure");
    expect(imageProblem({ url: "//x.test/a.png", alt: "A" })).toContain("secure");
    expect(imageProblem({ url: "/img/a.png", alt: "" })).toContain("alt text");
    const pin = { ...blank("PIN_ANSWER"), text: "Tap the barn" };
    pin.payload = { image: { url: "/img/a.png", alt: "A farm" }, areas: [] };
    expect(missing(pin)).toBe("Mark the right area on the image.");
    pin.payload = { ...pin.payload, areas: [{ x: 0.123456, y: 0.5, r: 0.1 }] };
    expect(missing(pin)).toBeNull();
    expect(toServer(pin).payload).toEqual({ image: { url: "/img/a.png", alt: "A farm" }, areas: [{ x: 0.1235, y: 0.5, r: 0.1 }] });
  });

  it("a quiz keeps an optional image and its reveal flag", () => {
    const q = { ...blank("QUIZ"), text: "Who?", choices: ["A", "B"], correctIndexes: [0] };
    q.payload = { image: { url: "/img/a.png", alt: "A face", width: 400, height: 300 }, reveal: true };
    expect(missing(q)).toBeNull();
    expect(toServer(q).payload).toEqual({ image: { url: "/img/a.png", alt: "A face", width: 400, height: 300 }, reveal: true });
    expect(missing({ ...q, payload: { reveal: true } })).toBe("Add an image.");
    expect(fromServer({ type: "QUIZ", choices: ["A", "B"], correctIndexes: [0], payload: {} }).payload).toEqual({});
  });

  it("judges a pin in the image's proportions, as the server does", () => {
    const area = { x: 0.5, y: 0.5, r: 0.1 };
    expect(insideArea({ x: 0.5, y: 0.68 }, area, 2)).toBe(true);   // wide image
    expect(insideArea({ x: 0.68, y: 0.5 }, area, 2)).toBe(false);
    expect(insideArea({ x: 0.5, y: 0.56 }, area, 0.5)).toBe(false); // tall image
  });

  it("uncovers an image in five steps over the time limit", () => {
    expect(revealStep(1000, 21000, 1000)).toBe(1);
    expect(revealStep(1000, 21000, 9000)).toBe(3);
    expect(revealStep(1000, 21000, 20999)).toBe(5);
    expect(revealStep(1000, 21000, 99999)).toBe(5);
  });

  it("a brainstorm's rounds have their limits", () => {
    const q = { ...blank("BRAINSTORM"), text: "Ideas?" };
    expect(missing(q)).toBeNull();
    expect(toServer(q).payload).toEqual({ ideaSeconds: 120, voteSeconds: 30 });
    expect(missing({ ...q, payload: { ideaSeconds: 300, voteSeconds: 30 } })).toContain("ideas round");
  });
});
