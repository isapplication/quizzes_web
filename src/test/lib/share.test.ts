import { describe, expect, it } from "vitest";
import { classroomShareUrl, teamsShareUrl } from "../../lib/share";

const link = "https://quizplayo.example/a/AB12CD?x=1&y=two words#frag";

describe("share links", () => {
  it("puts only the encoded assignment link into Google Classroom's address", () => {
    const url = new URL(classroomShareUrl(link));
    expect(url.origin + url.pathname).toBe("https://classroom.google.com/share");
    expect([...url.searchParams.keys()]).toEqual(["url"]);
    expect(url.searchParams.get("url")).toBe(link);
    expect(classroomShareUrl(link)).toBe("https://classroom.google.com/share?url=" + encodeURIComponent(link));
    expect(url.hash).toBe("");
  });

  it("puts only the encoded assignment link into Teams' address", () => {
    const url = new URL(teamsShareUrl(link));
    expect(url.origin + url.pathname).toBe("https://teams.microsoft.com/share");
    expect([...url.searchParams.keys()]).toEqual(["href"]);
    expect(url.searchParams.get("href")).toBe(link);
    expect(teamsShareUrl(link)).toBe("https://teams.microsoft.com/share?href=" + encodeURIComponent(link));
    expect(url.hash).toBe("");
  });

  it("encodes characters that would otherwise add parameters", () => {
    for (const built of [classroomShareUrl(link), teamsShareUrl(link)]) {
      const query = built.split("?")[1];
      expect(query.split("&")).toHaveLength(1);
      expect(built).not.toContain("#");
      expect(built).not.toContain(" ");
    }
  });
});
