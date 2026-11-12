import { describe, expect, it } from "vitest";
import {
  allowanceText, draftToEditor, estimateText, money, overAllowance, sourceProblem, startBody, startJson, type StartSettings, toPublish,
  WRITABLE,
} from "../../lib/aiStudio";
import { tryText } from "../../lib/assignments";
import { changeType, fromServer, offersSolution, toServer } from "../../lib/questionTypes";

const empty = { topic: "", text: "", wikipedia: "", files: [] as { name: string; size: number; type: string }[] };
const MB = 1024 * 1024;

describe("sourceProblem: each source's limits, said before anything is sent", () => {
  it("needs a topic only when drafting from a topic", () => {
    expect(sourceProblem("TOPIC", empty)).toMatch(/3 to 300/);
    expect(sourceProblem("TOPIC", { ...empty, topic: "Rain" })).toBeNull();
    expect(sourceProblem("WIKIPEDIA", { ...empty, wikipedia: "Water cycle" })).toBeNull();
    expect(sourceProblem("TOPIC", { ...empty, topic: "x".repeat(301) })).toMatch(/300/);
  });

  it("keeps pasted text between 100 and 20,000 characters", () => {
    expect(sourceProblem("TEXT", { ...empty, text: "short" })).toMatch(/at least 100/);
    expect(sourceProblem("TEXT", { ...empty, text: "a".repeat(100) })).toBeNull();
    expect(sourceProblem("TEXT", { ...empty, text: "a".repeat(20_001) })).toMatch(/20,001 characters/);
  });

  it("takes one PDF up to 10 MB, and 1 to 5 JPEG or PNG photos of up to 10 MB", () => {
    const pdf = { name: "notes.pdf", size: 2 * MB, type: "application/pdf" };
    expect(sourceProblem("PDF", { ...empty, files: [pdf] })).toBeNull();
    expect(sourceProblem("PDF", { ...empty, files: [] })).toMatch(/one PDF/);
    expect(sourceProblem("PDF", { ...empty, files: [{ ...pdf, size: 11 * MB }] })).toMatch(/10 MB/);
    expect(sourceProblem("PDF", { ...empty, files: [{ name: "x.docx", size: 1, type: "application/msword" }] })).toMatch(/isn't a PDF/);
    const photo = { name: "a.jpg", size: MB, type: "image/jpeg" };
    expect(sourceProblem("PHOTOS", { ...empty, files: [photo, photo] })).toBeNull();
    expect(sourceProblem("PHOTOS", { ...empty, files: Array(6).fill(photo) })).toMatch(/up to 5/);
    expect(sourceProblem("PHOTOS", { ...empty, files: [{ name: "a.svg", size: 10, type: "image/svg+xml" }] })).toMatch(/JPEG or PNG/);
  });
});

describe("startBody: JSON for text sources, an upload for files", () => {
  const base: StartSettings = { kind: "LESSON", sourceKind: "TEXT", topic: "  Rain ", text: "Rain falls.", wikipedia: "",
    grade: 6, subject: "Science", count: 10, classCode: "", types: ["QUIZ", "SLIDE"] };

  it("sends only the chosen source's own field", () => {
    expect(startJson(base)).toMatchObject({ topic: "Rain", kind: "LESSON", sourceKind: "TEXT", text: "Rain falls.",
      wikipedia: null, classCode: null, types: ["QUIZ", "SLIDE"] });
    expect(startJson({ ...base, sourceKind: "TOPIC" }).text).toBeNull();
  });

  it("sends a PDF as multipart: the settings as a JSON part and the file", async () => {
    const file = new File(["%PDF-1.7"], "notes.pdf", { type: "application/pdf" });
    const body = startBody({ ...base, sourceKind: "PDF" }, [file]);
    expect(body).toBeInstanceOf(FormData);
    const form = body as FormData;
    const request = form.get("request") as Blob;
    expect(request.type).toBe("application/json");
    expect(JSON.parse(await request.text())).toMatchObject({ sourceKind: "PDF", text: null });
    expect((form.getAll("files")[0] as File).name).toBe("notes.pdf");
    expect(startBody(base, [file])).not.toBeInstanceOf(FormData);
  });
});

describe("the estimate and the school's own monthly limit", () => {
  const allowance = { ceiling: 20, spent: 4.5, reserved: 0, remaining: 15.5 };
  const noLimit = { ceiling: null, spent: 4.5, reserved: 0, remaining: null };

  it("says the cost and what is left", () => {
    expect(money(0.123)).toBe("$0.12");
    expect(money(0.001)).toBe("under $0.01");
    expect(estimateText({ mode: "LIVE", usd: 0.12, withClaudeUsd: 0.12, upTo: false, allowance }))
      .toBe("This draft costs about $0.12 on your school's AI account (an estimate). Monthly limit $20.00, $15.50 left.");
    expect(estimateText({ mode: "LIVE", usd: 0.9, withClaudeUsd: 0.9, upTo: true, allowance })).toMatch(/^This draft costs up to \$0\.90/);
    expect(estimateText({ mode: "SAMPLE", usd: 0, withClaudeUsd: 0.12, upTo: false, allowance })).toMatch(/^Sample mode: this draft costs nothing/);
    expect(estimateText({ mode: "SAMPLE", usd: 0, withClaudeUsd: 0.12, upTo: false, allowance })).not.toMatch(/Claude/);
  });

  it("says when no monthly limit is set", () => {
    expect(allowanceText(noLimit)).toBe("No monthly limit set");
    expect(allowanceText(allowance)).toBe("Monthly limit $20.00, $15.50 left");
    expect(allowanceText({ ceiling: 10, remaining: -2 })).toBe("Monthly limit $10.00, $0.00 left");
    expect(estimateText({ mode: "LIVE", usd: 0.12, withClaudeUsd: 0.12, upTo: false, allowance: noLimit }))
      .toMatch(/No monthly limit set\.$/);
  });

  it("knows when the limit can't take a draft, and never stops a school with no limit", () => {
    expect(overAllowance({ mode: "LIVE", usd: 0.2, withClaudeUsd: 0.2, upTo: false, allowance })).toBe(false);
    expect(overAllowance({ mode: "LIVE", usd: 16, withClaudeUsd: 16, upTo: false, allowance })).toBe(true);
    expect(overAllowance({ mode: "SAMPLE", usd: 0, withClaudeUsd: 1, upTo: false,
      allowance: { ...allowance, spent: 20, remaining: 0 } })).toBe(true);
    expect(overAllowance({ mode: "LIVE", usd: 500, withClaudeUsd: 500, upTo: false, allowance: noLimit })).toBe(false);
  });
});

describe("AI drafts in the editor's shape", () => {
  it("offers every type but slides in a quiz", () => {
    expect(WRITABLE).toContain("CATEGORISE");
    expect(WRITABLE).toContain("POLL");
    expect(WRITABLE).not.toContain("SLIDE");
  });

  it("keeps a categorise draft's key and a worked solution through review and publishing", () => {
    const q = draftToEditor({ type: "CATEGORISE", text: "Sort these", choices: [], correctIndex: -1, timeLimitSeconds: 45,
      explanation: "Because.", payload: { categoryLabels: ["Solid", "Liquid"], items: ["Ice", "Milk"], correctCategory: { 0: 0, 1: 1 } },
      solution: null });
    expect(q.payload.catItems).toEqual([{ text: "Ice", category: 0 }, { text: "Milk", category: 1 }]);
    expect(toPublish({ position: 3, q })).toMatchObject({ position: 3, type: "CATEGORISE",
      payload: { categoryLabels: ["Solid", "Liquid"], items: ["Ice", "Milk"], correctCategory: { 0: 0, 1: 1 } } });

    const sum = draftToEditor({ type: "QUIZ", text: "2 + 3?", choices: ["4", "5"], correctIndexes: [1], correctIndex: 1,
      timeLimitSeconds: 20, explanation: "Count on.", payload: {}, solution: "2 + 3 = 5\nThe answer is 5." });
    expect(sum.solution).toBe("2 + 3 = 5\nThe answer is 5.");
    expect(toServer(sum).solution).toBe("2 + 3 = 5\nThe answer is 5.");
    expect(toServer(changeType(sum, "POLL")).solution).toBeNull();
    expect(toServer({ ...sum, solution: "   " }).solution).toBeNull();
  });

  it("offers a worked solution for scored Math and Science questions", () => {
    const q = fromServer({ type: "QUIZ", text: "?", choices: ["a", "b"], correctIndexes: [0] });
    expect(offersSolution(q, "Math")).toBe(true);
    expect(offersSolution(q, "ELA")).toBe(false);
    expect(offersSolution({ ...q, solution: "kept" }, "ELA")).toBe(true);
    expect(offersSolution({ ...q, type: "SLIDE" }, "Science")).toBe(false);
  });
});

describe("tryText: a practice assignment's later tries", () => {
  it("says which try, and nothing for the first", () => {
    expect(tryText(undefined)).toBeNull();
    expect(tryText(1)).toBeNull();
    expect(tryText(2)).toBe("Second try");
    expect(tryText(3)).toBe("Third try");
  });
});
