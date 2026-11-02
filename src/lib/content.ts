export interface QuizSummary {
  quizId: string;
  title: string;
  subject: string;
  grade: number;
  course: string | null;
  standard: string | null;
  source: "BANK" | "AI" | "MANUAL";
  status: string;
  bankRef: string | null;
  ownerUserId: string | null;
  /** The published version; null for a quiz that has only a draft so far. */
  versionId: string | null;
  questionCount: number;
  playableCount: number;
  updatedAt: string;
}

export interface QuestionView {
  id: string;
  position: number;
  type: "QUIZ" | "TRUE_FALSE" | "TYPE_ANSWER" | "PUZZLE" | "SLIDER";
  text: string;
  timeLimitSeconds: number;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
  visual: string | null;
  answer: Record<string, unknown>;
  playableLive: boolean;
}

export interface QuizView {
  quiz: QuizSummary;
  versionNo: number;
  aiModel: string | null;
  aiPromptVersion: string | null;
  questions: QuestionView[];
}

export const TYPE_LABEL: Record<QuestionView["type"], string> = {
  QUIZ: "Quiz",
  TRUE_FALSE: "True or false",
  TYPE_ANSWER: "Type answer",
  PUZZLE: "Puzzle",
  SLIDER: "Slider",
};

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

/** One question in the editor; {@code correctIndex} is -1 until the teacher picks the right answer. */
export interface EditorQuestion {
  type: "QUIZ" | "TRUE_FALSE";
  text: string;
  timeLimitSeconds: number;
  points: number;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
}

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
