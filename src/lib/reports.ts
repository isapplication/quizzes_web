/**
 * Reports over time (wave3-plan.md, 3b/3h): the shapes the Quiz API sends for a class, a student and the school, and the
 * small pure helpers the report screens share (the date range, the lines that decide "needs help" and "difficult", links
 * to a game's or assignment's own report, tones). The API decides every number; these only shape what people see.
 */
import type { ReportQuestion } from "@/components/QuestionResult";

/** A student below this accuracy over their last five scored sessions needs help (W43). */
export const NEEDS_HELP_BELOW = 50;
/** A scored question under this share fully right is difficult (W43), and "Make a re-teach quiz" copies it. */
export const HARD_BELOW = 35;

/** A game or assignment in a report. {@code sourceId} is only there when the viewer may open its report. */
export interface SessionRow {
  source: "GAME" | "ASSIGNMENT";
  sourceId: string | null;
  title: string;
  at: string;
  students: number;
  percent: number;
  canOpen: boolean;
}

export interface QuestionAccuracy {
  questionId: string;
  text: string;
  type: string;
  answered: number;
  percentRight: number;
  sources: SessionRow[];
}

export interface StandardAccuracy {
  standard: string;
  answered: number;
  percentRight: number;
  questions: QuestionAccuracy[];
}

export interface StudentRow {
  userId: string;
  name: string;
  sessions: number;
  answers: number;
  percent: number;
  recentPercent: number;
  /** Each of the last 10 scored sessions' percent, oldest first. */
  trend: number[];
  needsHelp: boolean;
}

export interface ClassReport {
  overview: {
    classCode: string;
    className: string;
    grade: number | null;
    from: string;
    to: string;
    totals: { sessions: number; students: number; answers: number; percent: number };
    questions: QuestionAccuracy[];
    difficult: QuestionAccuracy[];
    byStandard: StandardAccuracy[];
    sessions: SessionRow[];
  };
  students: StudentRow[];
  needsHelp: StudentRow[];
}

export interface StudentSession {
  source: "GAME" | "ASSIGNMENT";
  sourceId: string | null;
  canOpen: boolean;
  title: string;
  at: string;
  classCode: string | null;
  answers: number;
  percent: number;
}

export interface StudentReport {
  userId: string;
  name: string;
  grade: number | null;
  from: string;
  to: string;
  sessions: number;
  answers: number;
  percent: number;
  recentPercent: number;
  trend: number[];
  needsHelp: boolean;
  timeline: StudentSession[];
}

export interface SchoolReport {
  from: string;
  to: string;
  totals: { games: number; assignments: number; students: number; answers: number; percent: number };
  teachers: { userId: string; name: string; games: number; assignments: number; students: number }[];
  classes: { classCode: string; name: string; grade: number | null; sessions: number; students: number; answers: number;
    percent: number; below: boolean }[];
  grades: { grade: number | null; classes: number; sessions: number; students: number; percent: number }[];
  classesBelow: string[];
}

/** A day as the date input and the API write it: 2026-09-01. */
export function isoDay(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** The last 90 days up to {@code today}, both days included: what the API uses when no dates are sent. */
export function defaultRange(today: Date = new Date()): { from: string; to: string } {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89);
  return { from: isoDay(from), to: isoDay(today) };
}

/** {@code from=…&to=…} for the API, leaving out a day that is not a date. */
export function rangeQuery(range: { from?: string; to?: string }): string {
  const u = new URLSearchParams();
  if (range.from && /^\d{4}-\d{2}-\d{2}$/.test(range.from)) u.set("from", range.from);
  if (range.to && /^\d{4}-\d{2}-\d{2}$/.test(range.to)) u.set("to", range.to);
  return u.toString();
}

/** "?" plus the query, or nothing when there is none. */
export function withQuery(path: string, query: string): string {
  return query ? path + "?" + query : path;
}

/** How an accuracy reads at a glance: under the needs-help line, in between, or good. */
export function percentTone(percent: number): "ok" | "warn" | "danger" {
  return percent >= 70 ? "ok" : percent >= NEEDS_HELP_BELOW ? "warn" : "danger";
}

/** A game's or assignment's own report, for the teacher who made it (or a school admin); null when it can't be opened. */
export function sourceLink(s: { source: string; sourceId: string | null; canOpen?: boolean }): string | null {
  if (!s.sourceId || s.canOpen === false) return null;
  return (s.source === "GAME" ? "/teacher/games/" : "/teacher/assignments/") + s.sourceId;
}

/** The questions of one game's or assignment's report that "Make a re-teach quiz" copies: the same line as the server's. */
export function hardQuestions(questions: ReportQuestion[]): ReportQuestion[] {
  return questions.filter((q) => q.counted !== false && q.answered > 0 && q.correct !== undefined
    && 100 * q.correct < HARD_BELOW * q.answered);
}

/** "3 questions" / "1 question". */
export function countOf(n: number, word: string): string {
  return n + " " + word + (n === 1 ? "" : "s");
}
