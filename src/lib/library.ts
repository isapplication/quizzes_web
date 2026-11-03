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
  /** QUIZ: hosted live or assigned; ACTIVITY: done at each student's own pace, through an assignment only. */
  kind: "QUIZ" | "ACTIVITY";
  /** For an activity: MATCH (match the pairs), ORDER (put in order) or CARDS (flashcards); null for a quiz. */
  format: ActivityFormat | null;
}

export type ActivityFormat = "MATCH" | "ORDER" | "CARDS";

export const FORMAT_LABEL: Record<ActivityFormat, string> = {
  MATCH: "Match the pairs",
  ORDER: "Put in order",
  CARDS: "Flashcards",
};

/** "6 rounds" or "8 cards": what an activity is made of. */
export function partsLabel(card: Pick<LibraryCard, "format" | "questionCount">): string {
  const n = card.questionCount;
  if (card.format === "CARDS") return n + (n === 1 ? " card" : " cards");
  if (card.format) return n + (n === 1 ? " round" : " rounds");
  return n + (n === 1 ? " question" : " questions");
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
  type: "QUIZ" | "TRUE_FALSE" | "PUZZLE" | "MATCH" | "CARD";
  text: string;
  timeLimitSeconds: number;
  pointsMultiplier: number;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
  visual: string | null;
  benchmarkCode: string | null;
  /** An activity round's content: MATCH {pairs: [[left, right]]}, PUZZLE {order: [...]}, CARD {back}. */
  payload: { pairs?: [string, string][]; order?: string[]; back?: string } | null;
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
