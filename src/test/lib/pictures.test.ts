import { describe, expect, it } from "vitest";
import { blank, changeType, type EditorQuestion, fromServer, missing, toServer } from "../../lib/questionTypes";

const pic = (id: string, alt = "A picture") => ({ mediaId: id, alt, url: "/api/v1/media/" + id, width: 10, height: 10 });

function quiz(patch: Partial<EditorQuestion> = {}): EditorQuestion {
  return { ...blank("QUIZ"), text: "Which animal is this?", choices: ["", "", "", ""], correctIndexes: [1], ...patch };
}

describe("pictures in the editor", () => {
  it("reads a question's picture and its answers' pictures from the API", () => {
    const e = fromServer({
      type: "QUIZ", text: "t", choices: ["", "Dog", "Bird"], correctIndexes: [1],
      image: { mediaId: "q", alt: "A pet", url: "/api/v1/media/q?e=1&s=2", width: 640, height: 480 },
      choiceImages: [{ mediaId: "c", alt: "A cat" }, null, null],
    });
    expect(e.image).toMatchObject({ mediaId: "q", alt: "A pet", width: 640 });
    expect(e.choiceImages?.[0]).toMatchObject({ mediaId: "c", alt: "A cat" });
    expect(e.choiceImages?.[1]).toBeNull();
  });

  it("a question with no pictures reads with none", () => {
    const e = fromServer({ type: "QUIZ", text: "t", choices: ["a", "b"], correctIndexes: [0] });
    expect(e.image).toBeNull();
    expect(e.choiceImages).toEqual([]);
  });

  it("sends only the id and the trimmed description, and keeps a picture-only answer", () => {
    const wire = toServer(quiz({ image: pic("q", "  A pet  "), choiceImages: [pic("cat", "A cat"), pic("dog", "A dog"), null, null],
      choices: ["", "", "", ""] }));
    expect(wire.image).toEqual({ mediaId: "q", alt: "A pet" });
    expect(wire.choices).toEqual(["", ""]);
    expect(wire.choiceImages).toEqual([{ mediaId: "cat", alt: "A cat" }, { mediaId: "dog", alt: "A dog" }]);
    expect(wire.correctIndexes).toEqual([1]);
  });

  it("an empty optional answer without a picture is still dropped, and the pictures follow their answers", () => {
    const wire = toServer(quiz({ choices: ["Cat", "Dog", "", "Bird"], choiceImages: [null, pic("dog"), null, pic("bird")], correctIndexes: [1] }));
    expect(wire.choices).toEqual(["Cat", "Dog", "Bird"]);
    expect(wire.choiceImages?.map((c) => c?.mediaId ?? null)).toEqual([null, "dog", "bird"]);
  });

  it("a picture still waiting for its description is not sent, so a draft saves without it", () => {
    const wire = toServer(quiz({ image: pic("q", "  "), choices: ["Cat", "Dog", "", ""], choiceImages: [pic("cat", ""), null, pic("x", ""), null] }));
    expect(wire.image).toBeNull();
    expect(wire.choiceImages).toEqual([]);
    expect(wire.choices).toEqual(["Cat", "Dog"]);
  });

  it("only quiz, multi-select and poll answers send pictures", () => {
    const tf = { ...blank("TRUE_FALSE"), text: "t", correctIndexes: [0], choiceImages: [pic("a"), pic("b")] };
    expect(toServer(tf).choiceImages).toEqual([]);
    expect(toServer({ ...tf, type: "SLIDE", payload: { title: "x" } }).choiceImages).toEqual([]);
  });

  it("a picture needs a description before the question can be published", () => {
    expect(missing(quiz({ choices: ["a", "b", "c", "d"], image: pic("q", "   ") }))).toContain("Describe the question's picture");
    expect(missing(quiz({ choices: ["a", "b", "c", "d"], image: pic("q", "A pet") }))).toBeNull();
    expect(missing(quiz({ choices: ["", "b", "c", "d"], choiceImages: [pic("c", ""), null, null, null] }))).toContain("answer 1's picture");
  });

  it("an answer may be only a picture, but not nothing, and two the same are not different", () => {
    expect(missing(quiz({ choices: ["", "Dog", "", ""], choiceImages: [pic("cat"), null, null, null] }))).toBeNull();
    expect(missing(quiz({ choices: ["", "", "c", "d"], choiceImages: [], correctIndexes: [2] }))).toContain("empty answer");
    expect(missing(quiz({ choices: ["", "", "c", "d"], choiceImages: [pic("x"), pic("y"), null, null], correctIndexes: [2] }))).toBeNull();
    expect(missing(quiz({ choices: ["", "", "c", "d"], choiceImages: [pic("x"), pic("x"), null, null], correctIndexes: [2] }))).toContain("different");
    // Two pictures, nothing else, count as two answers.
    expect(missing(quiz({ choices: ["", ""], choiceImages: [pic("x"), pic("y")], correctIndexes: [0] }))).toBeNull();
  });

  it("changing the type keeps the picture, and the answers' pictures between choice types only", () => {
    const q = quiz({ image: pic("q"), choices: ["a", "b", "c", "d"], choiceImages: [pic("a"), null, null, null] });
    expect(changeType(q, "MULTI_SELECT").choiceImages?.[0]).toMatchObject({ mediaId: "a" });
    expect(changeType(q, "POLL").image).toMatchObject({ mediaId: "q" });
    const typed = changeType(q, "TYPE_ANSWER");
    expect(typed.image).toMatchObject({ mediaId: "q" });
    expect(typed.choiceImages ?? []).toEqual([]);
  });
});

describe("a slide's video in the editor", () => {
  it("reads the stored id and times", () => {
    const e = fromServer({ type: "SLIDE", text: "", payload: { title: "Water", video: { id: "dQw4w9WgXcQ", start: 5, end: 65 } } });
    expect(e.payload.video).toEqual({ id: "dQw4w9WgXcQ", start: 5, end: 65 });
    expect(fromServer({ type: "SLIDE", payload: { title: "Water" } }).payload.video).toBeNull();
  });

  it("sends a pasted link as it is (the server keeps only the id), or the id when the link was not touched", () => {
    const slide = { ...blank("SLIDE"), payload: { title: "Water" } };
    expect(toServer({ ...slide, payload: { title: "Water", video: { url: " https://youtu.be/dQw4w9WgXcQ ", start: 0, end: 30 } } }).payload)
      .toEqual({ title: "Water", video: { url: "https://youtu.be/dQw4w9WgXcQ", start: 0, end: 30 } });
    expect(toServer({ ...slide, payload: { title: "Water", video: { id: "dQw4w9WgXcQ", start: 5, end: 65 } } }).payload)
      .toEqual({ title: "Water", video: { id: "dQw4w9WgXcQ", start: 5, end: 65 } });
    expect(toServer({ ...slide, payload: { title: "Water", video: null } }).payload).toEqual({ title: "Water" });
  });

  it("a slide with a video needs an end time, and the clip is at most ten minutes", () => {
    const slide = (video: { id: string; start: number | null; end: number | null }) =>
      ({ ...blank("SLIDE"), payload: { title: "Water", video } });
    expect(missing(slide({ id: "dQw4w9WgXcQ", start: 0, end: null }))).toContain("end time");
    expect(missing(slide({ id: "dQw4w9WgXcQ", start: 0, end: 700 }))).toContain("10 minutes");
    expect(missing(slide({ id: "dQw4w9WgXcQ", start: 0, end: 60 }))).toBeNull();
  });
});
