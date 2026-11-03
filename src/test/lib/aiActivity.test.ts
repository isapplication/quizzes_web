import { describe, expect, it } from "vitest";
import { forWhom, runChip, usd } from "../../lib/aiActivity";

describe("AI use", () => {
  it("shows small costs with four decimals so one call isn't $0.00", () => {
    expect(usd(0.0123)).toBe("$0.0123");
    expect(usd(0)).toBe("$0.00");
    expect(usd(12.5)).toBe("$12.50");
  });

  it("says whom a run was for", () => {
    expect(forWhom({ onBehalfKind: "CLASS", onBehalfName: "Grade 8 B (8B)" })).toBe("For class Grade 8 B (8B)");
    expect(forWhom({ onBehalfKind: "WORKSPACE", onBehalfName: "Quizplayo Demo School" })).toBe("For the whole workspace");
    expect(forWhom({ onBehalfKind: null, onBehalfName: null })).toBe("For the whole workspace");
  });

  it("colours a run by its status", () => {
    expect(runChip("PUBLISHED")).toContain("chip-ok");
    expect(runChip("FAILED")).toContain("chip-danger");
    expect(runChip("READY")).toContain("chip-warn");
  });
});
