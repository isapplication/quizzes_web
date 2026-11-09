/** Assignments: a quiz done at each student's own pace, by link or for a class (starter-library plan, Step 3a). */
import type { ReportQuestion } from "@/components/QuestionResult";
import type { ShownBrand } from "@/lib/me";
import type { AnswerKey, Pick } from "@/lib/questionTypes";

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
  /** Practice (Wave 3): a question answered not fully right comes back at the end, up to 2 more times. */
  practice?: boolean;
}

export interface AssignmentResults {
  assignment: AssignmentSummary;
  /**
   * {@code correct} of {@code scored}: the questions that count towards "right" (not polls, slides or flashcards);
   * {@code cardsKnown} of {@code cards}: the flashcards the student knew.
   */
  attempts: { name: string; guest: boolean; score: number; correct: number; answered: number; questions: number;
    startedAt: string; finishedAt: string | null; scored?: number; cards?: number; cardsKnown?: number;
    /** Right at any try: a practice assignment's "right by the third try" (else the same as correct). */
    rightInTheEnd?: number }[];
  /** Per type, as a live game's report (slides left out, polls not counted); first tries only. */
  questions: (ReportQuestion & { rightInTheEnd?: number })[];
}

/** A student's own: {@code status} NOT_STARTED, IN_PROGRESS or DONE. */
/**
 * How an attempt went, in words: "5 of 5 right", "knew 6 of 8 cards", both for a mix, or null when nothing is scored
 * and there are no cards (only polls or slides), so no screen says "0 of 0 right".
 */
export function rightText(r: { correct: number | null; scored?: number | null; cards?: number | null;
  cardsKnown?: number | null; questions?: number }): string | null {
  const cards = r.cards ?? 0;
  const scored = r.scored ?? r.questions ?? 0;
  const knew = cards > 0 ? "knew " + (r.cardsKnown ?? 0) + " of " + cards + " cards" : null;
  const right = scored > 0 ? (r.correct ?? 0) + " of " + scored + " right" : null;
  return [right, knew].filter(Boolean).join(" · ") || null;
}

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
  /** Once started: the questions that count towards "right", and the flashcards known (missing from an older server). */
  scored?: number | null;
  cards?: number | null;
  cardsKnown?: number | null;
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
  /** Wave 1b: how it is answered (from the type when missing), the slider's scale, and a slide's title. */
  pick?: Pick;
  slider?: { min: number; max: number; step: number; unit?: string } | null;
  title?: string | null;
  /** CATEGORISE: the categories and the items shuffled; answered by the items' shown places. */
  categorise?: { categories: string[]; items: string[] } | null;
  /** 1, or 2 or 3 when a practice assignment brings the question back. */
  tryNumber?: number;
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
  /** The questions that count towards "right": not polls, slides or flashcards. Missing from an older server. */
  scored?: number;
  /** The attempt's flashcards, and how many the student knew. */
  cards?: number;
  cardsKnown?: number;
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
  /** Wave 1b: every right choice (multi-select), the judged share 0 to 1, false for a poll, and the answer key. */
  correctIndexes?: number[];
  fraction?: number;
  counted?: boolean;
  key?: AnswerKey;
  /** Wave 3: the worked solution, shown only now, after the answer; null when the question has none. */
  steps?: string | null;
  /** Practice: which try this was, and whether the question comes back at the end (the answer is kept back till then). */
  tryNumber?: number;
  comesBack?: boolean;
}

/** "Second try", "Third try", or null for a first try. */
export function tryText(tryNumber: number | undefined): string | null {
  if (!tryNumber || tryNumber <= 1) return null;
  return tryNumber === 2 ? "Second try" : tryNumber === 3 ? "Third try" : "Try " + tryNumber;
}

/** What a student sends for one activity round. */
export type ActivityAnswer = { order: number[] } | { matches: number[] } | { knew: boolean };

/**
 * What a student sends for a Wave 1b question. The value is sent both on its own ({choices}, {text}, {value}, as
 * {order} already is) and inside {answer: {...}}, the live game's form, so either reading of the request works.
 */
export type TypedAnswer =
  | { choices: number[]; answer: { choices: number[] } }
  | { text: string; answer: { text: string } }
  | { value: number; answer: { value: number } }
  | { answer: { categories: Record<number, number> } }
  | { answer: Record<string, never> };

export const typedAnswer = {
  choices: (choices: number[]): TypedAnswer => ({ choices, answer: { choices } }),
  text: (text: string): TypedAnswer => ({ text, answer: { text } }),
  value: (value: number): TypedAnswer => ({ value, answer: { value } }),
  /** A categorise question: each item's shown place to the category it was put in (only nested: it has no flat form). */
  categories: (categories: Record<number, number>): TypedAnswer => ({ answer: { categories } }),
  /** A slide: nothing to answer, Continue moves the attempt on. */
  seen: (): TypedAnswer => ({ answer: {} }),
};

export const ACTIVITY_TYPES = ["PUZZLE", "MATCH", "CARD"];

/** "Due Tue 4 Nov, 15:00" in the viewer's own time zone, or null. */
export function dueText(dueAt: string | null): string | null {
  if (!dueAt) return null;
  return "Due " + new Date(dueAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
