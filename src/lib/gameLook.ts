import { gradeLabel } from "./content";

/**
 * Game looks: a live game's host and player screens are drawn in the look of one grade, Kindergarten (0) to Grade 12.
 * Grades come in four families that share a font, layout and pace of motion; each grade then has its own scene,
 * character and accent colours. The school's Brand colours still drive buttons, answer tiles and the PIN.
 */
export type Band = "k2" | "e35" | "m68" | "h912";

/** A game hosted before game looks has none: it shows Grade 9's calm look. */
export const DEFAULT_LOOK = 9;

/** The grade a game is drawn in: its own when it has one in range, else the default. */
export function lookGrade(grade: number | null | undefined): number {
  return grade != null && Number.isInteger(grade) && grade >= 0 && grade <= 12 ? grade : DEFAULT_LOOK;
}

export function lookBand(grade: number | null | undefined): Band {
  const g = lookGrade(grade);
  return g <= 2 ? "k2" : g <= 5 ? "e35" : g <= 8 ? "m68" : "h912";
}

/** Kindergarten to Grade 2 have a mascot, 3 to 5 an explorer emblem; older grades have no character. */
export type Character = "owl" | "fox" | "turtle" | "rocket" | "whale" | "toucan";

export function lookCharacter(grade: number | null | undefined): Character | null {
  const characters: (Character | null)[] = ["owl", "fox", "turtle", "rocket", "whale", "toucan"];
  return characters[lookGrade(grade)] ?? null;
}

/** The choices of the host box's "Game look" list, the quiz's own grade first. */
export function lookChoices(quizGrade: number): { value: number; label: string }[] {
  const own = lookGrade(quizGrade);
  const rest = Array.from({ length: 13 }, (_, g) => g).filter((g) => g !== own);
  return [{ value: own, label: gradeLabel(own) + " (this quiz)" }, ...rest.map((g) => ({ value: g, label: gradeLabel(g) }))];
}

/** The words that change with the family; everything else reads the same in every look. */
export function lookWords(band: Band) {
  return {
    correct: band === "k2" ? "Yes! You got it!" : band === "m68" ? "CORRECT" : "Correct",
    wrong: band === "k2" ? "Good try!" : "Not quite",
    timeUp: band === "k2" ? "Time's up!" : "Time's up",
    leaderboard: band === "m68" ? "HIGH SCORES" : "Leaderboard",
    podium: band === "m68" ? "GAME OVER" : band === "h912" ? "Final results" : "Well played, everyone!",
  };
}
