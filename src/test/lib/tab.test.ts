import { describe, expect, it } from "vitest";
import { safeNext } from "../../lib/tab";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/library?grade=4")).toBe("/library?grade=4");
  });
  it("sends anything else home", () => {
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil", "/a\nb", "home"]) {
      expect(safeNext(bad)).toBe("/home");
    }
  });
});
