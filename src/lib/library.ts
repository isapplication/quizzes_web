/** The shared Quizplayo library and a workspace's starter shelf (quizplayo-docs/docs/starter-library-plan.md). */

export interface LibraryCard {
  libraryQuizId: string;
  title: string;
  courseId: string;
  courseName: string;
  grade: number;
  subject: string;
  unit: string | null;
  /**
   * AI: written by the Quizplayo library generator; BANK: from the original question bank (not re-checked yet);
   * SAMPLE: written by the generator's stand-in, for testing only.
   */
  origin: "AI" | "BANK" | "SAMPLE";
  versionId: string;
  versionNo: number;
  /** Visible questions only: a question several teachers reported is hidden while it's fixed. */
  questionCount: number;
  visual: string | null;
  status: string;
}

export interface LibraryCourse {
  courseId: string;
  grade: number;
  subject: string;
  name: string;
  position: number;
  quizzes: number;
}

export interface LibraryQuestion {
  questionId: string;
  position: number;
  type: "QUIZ" | "TRUE_FALSE";
  text: string;
  timeLimitSeconds: number;
  pointsMultiplier: number;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
  visual: string | null;
  benchmarkCode: string | null;
}

export interface LibraryDetail {
  quiz: LibraryCard;
  questions: LibraryQuestion[];
}

export interface LibraryPage {
  quizzes: LibraryCard[];
  more: boolean;
}

export interface Shelf {
  enabled: boolean;
  grade: number;
  quizzes: LibraryCard[];
  canShuffle: boolean;
}

export const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "WRONG_ANSWER", label: "The marked answer is wrong" },
  { value: "UNCLEAR", label: "The question is unclear" },
  { value: "NOT_SUITABLE", label: "Not suitable for students" },
  { value: "OTHER", label: "Something else" },
];

/** What the card says about where a quiz came from. */
export function originLabel(origin: LibraryCard["origin"]): string {
  if (origin === "SAMPLE") return "Sample · test content";
  return origin === "AI" ? "AI-made" : "AI-made · not re-checked yet";
}
