import { describe, expect, it } from "vitest";
import { studioRunLink, summaryText } from "../../lib/reports";
import { kindText, PURPOSE, runChip, runStatusText } from "../../lib/aiActivity";

describe("the class report's AI summary (3g)", () => {
  it("copies as plain text with its three parts and the steps numbered", () => {
    expect(summaryText({ wentWell: " Good work. ", revisit: "Fractions.", nextSteps: ["Re-teach.", " Practise.", "Check again."] }))
      .toBe("What went well\nGood work.\n\nWhat to revisit\nFractions.\n\nNext steps\n1. Re-teach.\n2. Practise.\n3. Check again.");
  });

  it("opens a re-teach run in AI Studio by its id", () => {
    expect(studioRunLink("3f2a-9")).toBe("/teacher/studio?run=3f2a-9");
    expect(studioRunLink("a b")).toBe("/teacher/studio?run=a%20b");
  });
});

describe("AI activity for 3g runs", () => {
  it("names the kind of run and the summary call", () => {
    expect(kindText("SUMMARY")).toBe("a class report summary");
    expect(kindText("RETEACH")).toContain("re-teach");
    expect(kindText("LESSON")).toBe("a lesson");
    expect(kindText("QUIZ")).toBeNull();
    expect(kindText(undefined)).toBeNull();
    expect(PURPOSE.SUMMARY).toBe("Class summary");
    expect(PURPOSE.SOLUTION_CHECK).toBeDefined();
  });

  it("calls a finished summary written, not ready to review", () => {
    expect(runStatusText({ status: "READY", kind: "SUMMARY" })).toBe("Written");
    expect(runStatusText({ status: "READY", kind: "RETEACH" })).toBe("Ready to review");
    expect(runStatusText({ status: "FAILED", kind: "SUMMARY" })).toBe("Failed");
    expect(runChip("READY", "SUMMARY")).toBe("chip chip-ok");
    expect(runChip("READY", "QUIZ")).toBe("chip chip-warn");
    expect(runChip("READY")).toBe("chip chip-warn");
  });
});
