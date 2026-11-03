/** Assignments: a quiz done at each student's own pace, by link or for a class (starter-library plan, Step 3a). */
import type { ShownBrand } from "@/lib/me";

export interface AssignmentSummary {
  assignmentId: string;
  code: string;
  /** The address students open. */
  link: string;
  title: string;
  classCode: string | null;
  requireSignIn: boolean;
  dueAt: string | null;
  closedAt: string | null;
  /** Students can start or carry on now. */
  open: boolean;
  started: number;
  finished: number;
  createdAt: string;
}

export interface AssignmentResults {
  assignment: AssignmentSummary;
  attempts: { name: string; guest: boolean; score: number; correct: number; answered: number; questions: number;
    startedAt: string; finishedAt: string | null }[];
  questions: { number: number; text: string; choices: string[]; correctIndex: number; counts: number[]; answered: number;
    percentCorrect: number }[];
}

/** A student's own: {@code status} NOT_STARTED, IN_PROGRESS or DONE. */
export interface MyAssignment {
  code: string;
  title: string;
  classCode: string | null;
  dueAt: string | null;
  open: boolean;
  status: "NOT_STARTED" | "IN_PROGRESS" | "DONE";
  score: number | null;
  correct: number | null;
  questions: number;
}

export interface PlayInfo {
  code: string;
  title: string;
  workspaceName: string;
  brand: ShownBrand;
  questions: number;
  dueAt: string | null;
  state: "OPEN" | "CLOSED" | "NOT_YET";
  joinAs: "SIGNED_IN" | "GUEST" | "SIGN_IN_FIRST";
  name: string | null;
  signInUrl: string | null;
}

export interface PlayQuestion {
  index: number;
  total: number;
  type: string;
  text: string;
  visual: string | null;
  choices: string[];
  /** PUZZLE: the items to put in order, shuffled. */
  items: string[];
  /** MATCH: the left side in order, and the right side shuffled. */
  left: string[];
  right: string[];
  /** CARD: the back of the card. */
  back: string | null;
}

export interface PlayState {
  /** Only when a new key was made: the device keeps it to carry on. */
  attemptKey: string | null;
  title: string;
  name: string;
  answered: number;
  total: number;
  score: number;
  correct: number;
  finished: boolean;
  question: PlayQuestion | null;
}

export interface Answered {
  correct: boolean;
  /** -1 for an activity round. */
  correctIndex: number;
  explanation: string | null;
  points: number;
  /** Activity rounds: how many of the parts (items, pairs) were right. */
  right: number;
  parts: number;
  /** PUZZLE: the items in the right order; MATCH: the right pairs, [left, right]; otherwise null. */
  solution: string[] | [string, string][] | null;
  state: PlayState;
}

/** What a student sends for one activity round. */
export type ActivityAnswer = { order: number[] } | { matches: number[] } | { knew: boolean };

export const ACTIVITY_TYPES = ["PUZZLE", "MATCH", "CARD"];

/** "Due Tue 4 Nov, 15:00" in the viewer's own time zone, or null. */
export function dueText(dueAt: string | null): string | null {
  if (!dueAt) return null;
  return "Due " + new Date(dueAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
