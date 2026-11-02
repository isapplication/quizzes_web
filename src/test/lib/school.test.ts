import { describe, expect, it } from "vitest";
import { gradesText, schoolStatus, tokenFromHash } from "../../lib/school";

describe("gradesText", () => {
  it("joins runs of grades and writes Kindergarten as K", () => {
    expect(gradesText([0, 1, 2, 5, 7, 8])).toBe("K–2, 5, 7–8");
    expect(gradesText([8, 6, 7, 7])).toBe("6–8");
    expect(gradesText([])).toBe("");
  });
});

describe("schoolStatus", () => {
  it("names a workspace's status in plain words", () => {
    expect(schoolStatus("ACTIVE")).toEqual({ label: "Live", tone: "ok" });
    expect(schoolStatus("SUSPENDED").label).toBe("Suspended");
    expect(schoolStatus("CLOSED").label).toBe("Closed");
  });
});

describe("tokenFromHash", () => {
  it("reads the confirmation token from the part of the link after #", () => {
    const token = "Zx3_kL9-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(tokenFromHash("#token=" + token)).toBe(token);
    expect(tokenFromHash("")).toBeNull();
    expect(tokenFromHash("#token=short")).toBeNull();
    expect(tokenFromHash("#token=<script>alert(1)</script>")).toBeNull();
  });
});
