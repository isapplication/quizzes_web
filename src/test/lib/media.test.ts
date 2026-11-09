import { describe, expect, it } from "vitest";
import {
  clock, embedUrl, newFloaters, NO_REACTIONS, parseTime, pictureProblem, REACTIONS, reactionCounts, shown, videoProblem, visibleText,
} from "../../lib/media";

describe("pictureProblem", () => {
  it("accepts a JPEG or PNG up to 5 MB", () => {
    expect(pictureProblem({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(pictureProblem({ type: "image/png", size: 5 * 1024 * 1024 })).toBeNull();
  });

  it("says what is wrong in plain words", () => {
    expect(pictureProblem({ type: "image/svg+xml", size: 100 })).toContain("JPEG or PNG");
    expect(pictureProblem({ type: "image/gif", size: 100 })).toContain("JPEG or PNG");
    expect(pictureProblem({ type: "application/pdf", size: 100 })).toContain("JPEG or PNG");
    expect(pictureProblem({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toMatch(/MB.*up to 5 MB/);
    expect(pictureProblem({ type: "image/png", size: 0 })).toContain("empty");
  });
});

describe("pictures as shown", () => {
  it("only a picture with an address can be shown", () => {
    expect(shown(null)).toBeNull();
    expect(shown({ mediaId: "a", alt: "A cat" })).toBeNull();
    expect(shown({ mediaId: "a", alt: "A cat", url: "/api/v1/media/a?e=1&s=2", width: 10, height: 20 }))
      .toEqual({ url: "/api/v1/media/a?e=1&s=2", alt: "A cat", width: 10, height: 20 });
  });

  it("an answer that is only its picture's description shows no label", () => {
    const cat = { url: "/x", alt: "A ginger cat" };
    expect(visibleText("A ginger cat", cat)).toBe("");
    expect(visibleText("Cat", cat)).toBe("Cat");
    expect(visibleText("Cat", null)).toBe("Cat");
  });
});

describe("a slide's video", () => {
  it("plays through youtube-nocookie.com with its start and end, never autoplay", () => {
    const url = embedUrl({ id: "dQw4w9WgXcQ", start: 5, end: 65 });
    expect(url.startsWith("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?")).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get("start")).toBe("5");
    expect(q.get("end")).toBe("65");
    expect(q.get("rel")).toBe("0");
    expect(q.has("autoplay")).toBe(false);
    expect(new URL(embedUrl({ id: "dQw4w9WgXcQ", start: 0, end: null })).searchParams.has("start")).toBe(false);
  });

  it("an id can't break out of the address", () => {
    expect(embedUrl({ id: "a/../b?x=1" })).toContain("/embed/a%2F..%2Fb%3Fx%3D1?");
  });

  it("reads and writes times like 1:05, 65 and 65s", () => {
    expect(parseTime("1:05")).toBe(65);
    expect(parseTime("65")).toBe(65);
    expect(parseTime("65s")).toBe(65);
    expect(parseTime("0:00")).toBe(0);
    expect(parseTime("")).toBeNull();
    expect(parseTime("1:75")).toBeNull();
    expect(parseTime("abc")).toBeNull();
    expect(clock(65)).toBe("1:05");
    expect(clock(0)).toBe("0:00");
    expect(clock(null)).toBe("");
  });

  it("says what is missing in plain words", () => {
    expect(videoProblem(null)).toBeNull();
    expect(videoProblem({ start: null, end: null })).toBeNull();
    expect(videoProblem({ url: "https://youtu.be/dQw4w9WgXcQ", start: 0, end: null })).toContain("end time");
    expect(videoProblem({ id: "dQw4w9WgXcQ", start: 30, end: 30 })).toContain("end after it starts");
    expect(videoProblem({ id: "dQw4w9WgXcQ", start: 0, end: 601 })).toContain("10 minutes");
    expect(videoProblem({ id: "dQw4w9WgXcQ", start: 60, end: 660 })).toBeNull();
  });
});

describe("reactions", () => {
  it("there are five, each an icon with a word", () => {
    expect(REACTIONS).toHaveLength(5);
    expect(REACTIONS.map((r) => r.word)).toEqual(["Got it", "Love it", "Funny", "Confused", "Wow"]);
    expect(REACTIONS.every((r) => r.icon.length > 0 && r.word.length > 0)).toBe(true);
  });

  it("reads the host's counts, and anything odd as none", () => {
    expect(reactionCounts({ counts: [1, 2, 3, 0, 0], taps: [2, 2, 3, 0, 0], total: 6 })).toEqual({ counts: [1, 2, 3, 0, 0], taps: [2, 2, 3, 0, 0], total: 6 });
    expect(reactionCounts({ counts: [1, 2], taps: [1, 2] })).toBe(NO_REACTIONS);
    expect(reactionCounts(undefined)).toBe(NO_REACTIONS);
    expect(reactionCounts({ counts: "x" })).toBe(NO_REACTIONS);
  });

  it("floats one icon per new tap, and never more than the cap", () => {
    expect(newFloaters([0, 0, 0, 0, 0], [2, 0, 1, 0, 0])).toEqual([0, 0, 2]);
    expect(newFloaters([1, 1, 1, 1, 1], [1, 1, 1, 1, 1])).toEqual([]);
    expect(newFloaters([5, 5, 5, 5, 5], [2, 2, 2, 2, 2])).toEqual([]);
    expect(newFloaters([0, 0, 0, 0, 0], [100, 100, 0, 0, 0], 12)).toHaveLength(12);
  });
});
