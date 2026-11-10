import { describe, expect, it } from "vitest";
import { blank, fromServer, insideArea, missing, pickOf, revealStep, scored, toServer } from "../../lib/questionTypes";

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

  // Since the 2h/2f join the picture is the question's own upload ({mediaId, alt}), never a typed address.
  it("an image question needs an uploaded picture with a description, and a pin answer its areas", () => {
    const pin = { ...blank("PIN_ANSWER"), text: "Tap the barn" };
    pin.payload = { areas: [{ x: 0.5, y: 0.5, r: 0.1 }] };
    expect(missing(pin)).toBe("Add a picture to answer on.");
    pin.image = { mediaId: "m-1", alt: "", url: "/api/v1/media/m-1?e=1&s=2", width: 800, height: 400 };
    expect(missing(pin)).toBe("Describe the question's picture in a few words, for people who can't see it.");
    pin.image = { ...pin.image, alt: "A farm" };
    pin.payload = { areas: [] };
    expect(missing(pin)).toBe("Mark the right area on the image.");
    pin.payload = { areas: [{ x: 0.123456, y: 0.5, r: 0.1 }] };
    expect(missing(pin)).toBeNull();
    const wire = toServer(pin);
    expect(wire.payload).toEqual({ areas: [{ x: 0.1235, y: 0.5, r: 0.1 }] });
    expect(wire.image).toEqual({ mediaId: "m-1", alt: "A farm" });
    // An old typed address in a saved payload is not read back into the editor.
    const back = fromServer({ type: "PIN_ANSWER", payload: { image: { url: "https://x.test/a.png", alt: "A" }, areas: [] } });
    expect(back.payload).toEqual({ areas: [] });
    expect(back.image).toBeNull();
  });

  it("a quiz keeps an optional picture and its reveal flag", () => {
    const q = { ...blank("QUIZ"), text: "Who?", choices: ["A", "B"], correctIndexes: [0] };
    q.payload = { reveal: true };
    expect(missing(q)).toBe("Add a picture to uncover, or untick Uncover.");
    q.image = { mediaId: "m-2", alt: "A face", url: "/api/v1/media/m-2?e=1&s=2", width: 400, height: 300 };
    expect(missing(q)).toBeNull();
    expect(toServer(q).payload).toEqual({ reveal: true });
    expect(toServer(q).image).toEqual({ mediaId: "m-2", alt: "A face" });
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
