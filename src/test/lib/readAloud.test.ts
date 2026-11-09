import { describe, expect, it } from "vitest";
import { pickVoice, questionSpeech } from "../../lib/readAloud";

describe("what is read aloud", () => {
  it("the question, then each answer by number", () => {
    expect(questionSpeech("What is 2 + 2?", ["3", "4"])).toBe("What is 2 + 2?. Answer 1: 3. Answer 2: 4");
  });

  it("an answer that is only a picture is read as its description", () => {
    expect(questionSpeech("Which animal is this?", ["", "Neither"], [{ alt: "A ginger cat" }, null]))
      .toBe("Which animal is this?. Answer 1: A ginger cat. Answer 2: Neither");
  });

  it("an answer with nothing to say is skipped, and a slide has just its text", () => {
    expect(questionSpeech("Pick one", ["", "b"])).toBe("Pick one. Answer 2: b");
    expect(questionSpeech("Read this slide", [])).toBe("Read this slide");
  });
});

describe("the voice", () => {
  const voices = [{ lang: "en-GB" }, { lang: "en_IN" }, { lang: "hi-IN" }, { lang: "ar-SA" }];

  it("prefers the exact locale, then the same language", () => {
    expect(pickVoice(voices, "en-IN")).toEqual({ lang: "en_IN" });
    expect(pickVoice(voices, "hi")).toEqual({ lang: "hi-IN" });
    expect(pickVoice(voices, "en-US")).toEqual({ lang: "en-GB" });
    expect(pickVoice(voices, "ar_SA")).toEqual({ lang: "ar-SA" });
  });

  it("falls back to the browser's own default when there is no such language", () => {
    expect(pickVoice(voices, "fr-FR")).toBeNull();
    expect(pickVoice([], "en")).toBeNull();
  });
});
