import { describe, expect, it } from "vitest";
import { safeNext } from "../../lib/tab";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/teacher/bank?x=1")).toBe("/teacher/bank?x=1");
  });
  it("sends anything else home", () => {
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/\\evil", "/a\nb", "home"]) {
      expect(safeNext(bad)).toBe("/home");
    }
  });
});
