import { type EditorQuestion, QTYPE_LABEL, type QType } from "./questionTypes";

export interface QuizSummary {
  quizId: string;
  title: string;
  subject: string;
  grade: number;
  course: string | null;
  standard: string | null;
  /** LIBRARY: a teacher's copy of a library quiz ("Edit a copy"). BANK: the retired per-school bank copies. */
  source: "BANK" | "AI" | "MANUAL" | "LIBRARY";
  status: string;
  bankRef: string | null;
  ownerUserId: string | null;
  /** The published version; null for a quiz that has only a draft so far. */
  versionId: string | null;
  questionCount: number;
  playableCount: number;
  updatedAt: string;
  /** For a copy of a library quiz: which one, and which of its versions was copied. */
  originLibraryQuizId: string | null;
  originVersionNo: number | null;
}

export interface QuestionView {
  id: string;
  position: number;
  type: QType;
  text: string;
  timeLimitSeconds: number;
  choices: string[];
  correctIndex: number;
  /** Every right choice: a multi-select's several, the one of a quiz or true/false; none for a poll. */
  correctIndexes?: number[];
  explanation: string | null;
  visual: string | null;
  answer: Record<string, unknown>;
  playableLive: boolean;
  /** Wave 2f: the question's picture and each answer's picture, with signed addresses. */
  image?: { mediaId: string; alt: string; url?: string | null; width?: number | null; height?: number | null } | null;
  choiceImages?: ({ mediaId: string; alt: string; url?: string | null; width?: number | null; height?: number | null } | null)[] | null;
  /** The standard code the question covers, or null. */
  standard?: string | null;
}

export interface QuizView {
  quiz: QuizSummary;
  versionNo: number;
  aiModel: string | null;
  aiPromptVersion: string | null;
  questions: QuestionView[];
}

export const TYPE_LABEL: Record<QuestionView["type"], string> = { ...QTYPE_LABEL, QUIZ: "Quiz" };

export function gradeLabel(grade: number): string {
  return grade === 0 ? "Kindergarten" : `Grade ${grade}`;
}

export const SUBJECTS = ["ELA", "Math", "Science", "Social Studies", "Other"] as const;
export const TIMES = [5, 10, 20, 30, 45, 60, 90, 120];
export const POINTS: { value: number; label: string }[] = [
  { value: 1, label: "Standard points" },
  { value: 2, label: "Double points" },
  { value: 0, label: "No points" },
];

/** One question in the editor: the per-type shape and rules live in lib/questionTypes.ts. */
export type { EditorQuestion } from "./questionTypes";

/** What the editor opens: the draft if there is one, otherwise the published version. */
export interface Editing {
  quizId: string;
  title: string;
  subject: string;
  grade: number;
  status: string;
  source: string;
  published: boolean;
  unpublishedChanges: boolean;
  questions: EditorQuestion[];
}
