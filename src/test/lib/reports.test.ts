import { describe, expect, it } from "vitest";
import {
  classReteachPaths, countOf, defaultRange, hardQuestions, HARD_BELOW, isoDay, NEEDS_HELP_BELOW, percentTone, rangeQuery, sourceLink, withQuery,
} from "../../lib/reports";
import { changeType, fromServer, standardCode, standardOk, toServer } from "../../lib/questionTypes";
import type { ReportQuestion } from "../../components/QuestionResult";

const q = (n: number, answered: number, correct: number, extra: Partial<ReportQuestion> = {}): ReportQuestion =>
  ({ number: n, text: "Q" + n, type: "QUIZ", choices: [], correctIndex: 0, counts: [], answered, correct,
    percentCorrect: answered ? Math.round((100 * correct) / answered) : 0, counted: true, ...extra });

describe("the report range", () => {
  it("is the last 90 days, both days included", () => {
    expect(defaultRange(new Date(2026, 10, 9))).toEqual({ from: "2026-08-12", to: "2026-11-09" });
    expect(isoDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("sends only real days", () => {
    expect(rangeQuery({ from: "2026-09-01", to: "2026-09-30" })).toBe("from=2026-09-01&to=2026-09-30");
    expect(rangeQuery({ from: "yesterday", to: "" })).toBe("");
    expect(withQuery("/api/v1/reports/school", "")).toBe("/api/v1/reports/school");
    expect(withQuery("/api/v1/reports/school", "from=2026-09-01")).toBe("/api/v1/reports/school?from=2026-09-01");
  });

  it("gives a class report both re-teach addresses for its days", () => {
    expect(classReteachPaths("8B", "")).toEqual({
      reteach: "/api/v1/reports/classes/8B/reteach", aiReteach: "/api/v1/reports/classes/8B/reteach-ai",
    });
    expect(classReteachPaths("8 B/1", "from=2026-09-01&to=2026-09-30")).toEqual({
      reteach: "/api/v1/reports/classes/8%20B%2F1/reteach?from=2026-09-01&to=2026-09-30",
      aiReteach: "/api/v1/reports/classes/8%20B%2F1/reteach-ai?from=2026-09-01&to=2026-09-30",
    });
  });
});

describe("the lines", () => {
  it("keeps the needs-help and difficult lines the server uses", () => {
    expect(NEEDS_HELP_BELOW).toBe(50);
    expect(HARD_BELOW).toBe(35);
    expect(percentTone(49)).toBe("danger");
    expect(percentTone(50)).toBe("warn");
    expect(percentTone(69)).toBe("warn");
    expect(percentTone(70)).toBe("ok");
  });

  it("finds the questions a re-teach quiz copies: scored, answered and under 35% fully right", () => {
    const rows = [
      q(1, 20, 7),                           // exactly 35%: not hard
      q(2, 6, 2),                            // 33%: hard
      q(3, 0, 0),                            // nobody answered
      q(4, 10, 0, { counted: false }),       // a poll
      q(5, 8, 3),                            // 37.5%: not hard
      q(6, 4, 0),                            // hard
    ];
    expect(hardQuestions(rows).map((r) => r.number)).toEqual([2, 6]);
  });

  it("links to a game's or assignment's own report only when it can be opened", () => {
    expect(sourceLink({ source: "GAME", sourceId: "g1" })).toBe("/teacher/games/g1");
    expect(sourceLink({ source: "ASSIGNMENT", sourceId: "a1", canOpen: true })).toBe("/teacher/assignments/a1");
    expect(sourceLink({ source: "GAME", sourceId: null, canOpen: false })).toBeNull();
    expect(sourceLink({ source: "GAME", sourceId: "g1", canOpen: false })).toBeNull();
    expect(countOf(1, "question")).toBe("1 question");
    expect(countOf(3, "question")).toBe("3 questions");
  });
});

describe("standards on questions", () => {
  it("keeps codes in capitals and drops empty ones", () => {
    expect(standardCode(" 3.nf.a.1 ")).toBe("3.NF.A.1");
    expect(standardCode("   ")).toBeNull();
    expect(standardCode(null)).toBeNull();
  });

  it("accepts what the API accepts: 2 to 30 letters, digits, dots and dashes", () => {
    for (const ok of ["", " ", "3.NF.A.1", "ela.11.r", "MA-K.NSO", "A1", "X".repeat(30)]) expect(standardOk(ok), ok).toBe(true);
    for (const bad of ["3", "has space", "a/b", "<b>", "X".repeat(31), ".NF", "-1"]) expect(standardOk(bad), bad).toBe(false);
  });

  it("round-trips through the editor and survives a change of type", () => {
    const q = fromServer({ type: "QUIZ", text: "One", timeLimitSeconds: 20, points: 1, choices: ["a", "b"], correctIndexes: [0],
      payload: {}, explanation: null, standard: "3.NF.A.1" });
    expect(q.standard).toBe("3.NF.A.1");
    expect(toServer(q).standard).toBe("3.NF.A.1");
    expect(toServer({ ...q, standard: " 3.nf.a.2 " }).standard).toBe("3.NF.A.2");
    expect(toServer({ ...q, standard: "" }).standard).toBeNull();
    expect(changeType(q, "TRUE_FALSE").standard).toBe("3.NF.A.1");
    expect(fromServer({ type: "QUIZ", text: "x" }).standard).toBeNull();
  });
});
