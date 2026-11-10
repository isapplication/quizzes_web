/** AI use (quizplayo-docs/docs/ai-activity-plan.md): AI Studio runs, for the school admin and the platform console. */

export type RunStatus = "DRAFTING" | "CHECKING" | "READY" | "FAILED" | "PUBLISHED";

export interface AiRun {
  runId: string;
  createdAt: string;
  requesterId: string;
  requesterName: string | null;
  /** Masked for a school admin, unless it is their own. */
  requesterEmail: string | null;
  role: string | null;
  onBehalfKind: "WORKSPACE" | "CLASS" | null;
  onBehalfName: string | null;
  topic: string;
  grade: number;
  subject: string;
  mode: "LIVE" | "SAMPLE";
  model: string;
  status: RunStatus;
  errorMessage: string | null;
  requested: number | null;
  received: number;
  passed: number;
  dropped: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  publishedQuizId: string | null;
  publishedAt: string | null;
  /** "Laptop or desktop · macOS · Chrome". */
  device: string | null;
  /** Console only. */
  schoolName: string | null;
  /** Wave 3: QUIZ, LESSON, RETEACH (3g: new questions like a report's hard ones) or SUMMARY (3g: a class report's
   *  summary), and what it was drafted from; only the source's title and size are kept. */
  kind?: string | null;
  sourceKind?: "TOPIC" | "TEXT" | "WIKIPEDIA" | "PDF" | "PHOTOS" | null;
  sourceTitle?: string | null;
  sourcePages?: number | null;
}

export interface AiDraft {
  position: number;
  checkStatus: "PASSED" | "DROPPED_FORMAT" | "DROPPED_ANSWER_CHECK";
  checkDetail: string | null;
  outcome: "KEPT" | "EDITED" | "REMOVED" | "DROPPED" | null;
  draft: { type: string; question: string; options: string[]; correctOption: string; timeSeconds: number; explanation: string };
  finalQuestion: { text: string; choices: string[]; correctIndex: number; explanation: string | null } | null;
}

export interface AiCall {
  calledAt: string;
  purpose: "DRAFT" | "MORE" | "ANSWER_CHECK";
  model: string;
  answeredBy: string | null;
  status: "OK" | "FAILED";
  error: string | null;
  stopReason: string | null;
  asked: number;
  returned: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  costUsd: number;
  durationMs: number;
  /** Console only. */
  providerId: string | null;
  reply: unknown;
}

export interface AiOrigin {
  signInMethod: string | null;
  sessionHash: string | null;
  clientIp: string | null;
  userAgent: string | null;
}

export interface AiRunDetail {
  run: AiRun;
  /** Console only. */
  origin: AiOrigin | null;
  drafts: AiDraft[];
  calls: AiCall[];
}

export interface SchoolPage {
  runs: AiRun[];
  more: boolean;
  people: { userId: string; name: string }[];
  last30Days: { runs: number; published: number; questionsPassed: number; costUsd: number };
}

export interface ConsoleAiPage {
  runs: AiRun[];
  more: boolean;
  thisMonth: { tenantId: string; schoolName: string | null; runs: number; published: number; tokens: number; costUsd: number }[];
  library: { runs: number; tokens: number; costUsd: number };
}

export const RUN_STATUS: Record<RunStatus, string> = {
  DRAFTING: "Writing",
  CHECKING: "Checking",
  READY: "Ready to review",
  FAILED: "Failed",
  PUBLISHED: "Published",
};

export const OUTCOME: Record<string, string> = {
  KEPT: "Kept as written",
  EDITED: "Edited by the teacher",
  REMOVED: "Left out by the teacher",
  DROPPED: "Dropped by a check",
};

export const PURPOSE: Record<string, string> = {
  DRAFT: "First drafts",
  MORE: "More drafts",
  ANSWER_CHECK: "Answer check",
  SOLUTION_CHECK: "Worked solution check",
  SUMMARY: "Class summary",
};

/** What kind of AI run it was, for the run's details: null for a plain quiz. */
export function kindText(kind: string | null | undefined): string | null {
  switch (kind) {
    case "LESSON": return "a lesson";
    case "RETEACH": return "a re-teach quiz from a report's hard questions";
    case "SUMMARY": return "a class report summary";
    default: return null;
  }
}

/** A run's status in words: a class summary that is ready was simply written (there is nothing to review or publish). */
export function runStatusText(run: { status: RunStatus; kind?: string | null }): string {
  return run.kind === "SUMMARY" && run.status === "READY" ? "Written" : RUN_STATUS[run.status];
}

export function runChip(status: RunStatus, kind?: string | null): string {
  return status === "PUBLISHED" || (kind === "SUMMARY" && status === "READY") ? "chip chip-ok" : status === "FAILED" ? "chip chip-danger" : "chip chip-warn";
}

/** "$0.0123"; small amounts keep four decimals so a single call is not shown as $0.00. */
export function usd(amount: number): string {
  return "$" + Number(amount).toFixed(amount > 0 && amount < 1 ? 4 : 2);
}

export function tokens(n: number): string {
  return Number(n).toLocaleString();
}

/** "For class Grade 8 B (8B)" or "For the whole workspace". */
export function forWhom(run: Pick<AiRun, "onBehalfKind" | "onBehalfName">): string {
  if (run.onBehalfKind === "CLASS") return "For class " + (run.onBehalfName ?? "");
  return "For the whole workspace";
}
