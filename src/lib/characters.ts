/**
 * Player characters (wave2-plan.md, W35): a built-in set of 24 animals, numbered 0 to 23, that a player may pick on the
 * join page. They are shown in the lobby, on the leaderboard and on the podium. A character belongs to a player in one
 * game, never to a person: the game server keeps only its number, and nothing is uploaded. The number is checked on the
 * Quiz API and the game server against the same count (`PlayerCharacters.COUNT` = 24 in libs/scoring).
 *
 * Each animal is drawn here as plain data (a list of shapes) and rendered by `components/live/CharacterAvatar.tsx` as
 * inline SVG. Colours are only the school's theme variables, never raw colours, so a school's own colours apply:
 * `a1` to `a6` are the answer colours, `ink` is the outline and the pupils, `paper` is the light patches. Every animal has
 * its own name, which a screen reader hears in the picker; the shapes themselves are decoration.
 */
export type Slot = "a1" | "a2" | "a3" | "a4" | "a5" | "a6" | "ink" | "paper";

export interface Piece {
  tag: "circle" | "ellipse" | "path" | "rect";
  /** SVG attributes (numbers and path data), except fill and stroke. */
  attrs: Record<string, string | number>;
  fill?: Slot;
  stroke?: Slot;
  /** Stroke width; 2 when there is a stroke. */
  width?: number;
}

export interface CharacterArt {
  name: string;
  pieces: Piece[];
}

const c = (cx: number, cy: number, r: number, fill?: Slot, outline = true): Piece =>
  ({ tag: "circle", attrs: { cx, cy, r }, fill, stroke: outline ? "ink" : undefined });
const e = (cx: number, cy: number, rx: number, ry: number, fill?: Slot, outline = true): Piece =>
  ({ tag: "ellipse", attrs: { cx, cy, rx, ry }, fill, stroke: outline ? "ink" : undefined });
const p = (d: string, fill?: Slot, outline = true): Piece =>
  ({ tag: "path", attrs: { d }, fill, stroke: outline ? "ink" : undefined });
/** An open line in the outline colour (whiskers, mouths, stripes). */
const line = (d: string, width = 2): Piece => ({ tag: "path", attrs: { d, strokeLinecap: "round" }, stroke: "ink", width });

/** Two big friendly eyes: a light disc with a dark pupil, so they show on any face colour. */
const eyes = (y = 33, dx = 8.5, r = 4): Piece[] => [
  c(32 - dx, y, r, "paper", false), c(32 + dx, y, r, "paper", false),
  c(32 - dx, y, r * 0.55, "ink", false), c(32 + dx, y, r * 0.55, "ink", false),
];
const nose = (x = 32, y = 41, fill: Slot = "ink"): Piece => e(x, y, 3, 2.2, fill, false);
const smile = (y = 45): Piece => line(`M27 ${y} q5 4 10 0`);
const whiskers = (): Piece[] => [
  line("M10 40 L22 41", 1.6), line("M10 46 L22 44", 1.6), line("M54 40 L42 41", 1.6), line("M54 46 L42 44", 1.6),
];

export const CHARACTERS: CharacterArt[] = [
  {
    name: "Cat",
    pieces: [p("M12 28 L15 6 L29 19 Z", "a6"), p("M52 28 L49 6 L35 19 Z", "a6"), p("M17 22 L18 13 L24 19 Z", "a4", false),
      p("M47 22 L46 13 L40 19 Z", "a4", false), e(32, 37, 21, 18, "a6"), ...eyes(), nose(32, 41, "a4"), smile(), ...whiskers()],
  },
  {
    name: "Dog",
    pieces: [e(12, 34, 7, 14, "a2"), e(52, 34, 7, 14, "a2"), e(32, 35, 19, 19, "a3"), e(32, 43, 10, 8, "paper"),
      ...eyes(31), e(32, 39, 4, 3, "ink", false), line("M32 42 L32 46"), line("M26 47 q6 5 12 0"), e(32, 50, 3, 3.4, "a4", false)],
  },
  {
    name: "Fox",
    pieces: [p("M11 30 L14 5 L30 20 Z", "a6"), p("M53 30 L50 5 L34 20 Z", "a6"), p("M17 22 L18 12 L25 19 Z", "ink", false),
      p("M47 22 L46 12 L39 19 Z", "ink", false), e(32, 37, 21, 18, "a6"), p("M11 40 Q32 40 53 40 Q42 58 32 58 Q22 58 11 40 Z", "paper"),
      ...eyes(33), e(32, 47, 3, 2.4, "ink", false)],
  },
  {
    name: "Bear",
    pieces: [c(15, 17, 8, "a2"), c(49, 17, 8, "a2"), c(15, 17, 3.5, "a6", false), c(49, 17, 3.5, "a6", false), c(32, 36, 21, "a2"),
      e(32, 43, 10, 8, "paper"), ...eyes(31, 9), nose(32, 40), line("M32 42 L32 46"), line("M27 46 q5 4 10 0")],
  },
  {
    name: "Panda",
    pieces: [c(14, 16, 8, "ink"), c(50, 16, 8, "ink"), c(32, 36, 21, "paper"), e(22, 32, 6, 8, "ink", false), e(42, 32, 6, 8, "ink", false),
      c(22, 33, 2.6, "paper", false), c(42, 33, 2.6, "paper", false), c(22.5, 33.2, 1.2, "ink", false), c(41.5, 33.2, 1.2, "ink", false),
      e(32, 42, 4, 2.8, "ink", false), line("M32 44 L32 47"), line("M27 48 q5 4 10 0")],
  },
  {
    name: "Rabbit",
    pieces: [e(22, 14, 6, 15, "paper"), e(42, 14, 6, 15, "paper"), e(22, 15, 2.6, 10, "a4", false), e(42, 15, 2.6, 10, "a4", false),
      e(32, 40, 19, 17, "paper"), ...eyes(37), nose(32, 44, "a4"), line("M32 46 L32 49"), line("M27 50 q5 4 10 0"),
      line("M9 44 L21 45", 1.6), line("M55 44 L43 45", 1.6)],
  },
  {
    name: "Mouse",
    pieces: [c(13, 20, 10, "a1"), c(51, 20, 10, "a1"), c(13, 20, 5.5, "a4", false), c(51, 20, 5.5, "a4", false),
      e(32, 38, 19, 18, "a1"), ...eyes(34, 8, 3.6), e(32, 45, 3.2, 2.6, "a4", false), line("M28 49 q4 3 8 0"), ...whiskers()],
  },
  {
    name: "Owl",
    pieces: [p("M13 26 L11 8 L26 16 Z", "a2"), p("M51 26 L53 8 L38 16 Z", "a2"), e(32, 37, 22, 22, "a2"),
      e(32, 46, 12, 10, "paper", false), c(21, 31, 9, "paper"), c(43, 31, 9, "paper"), c(21, 31, 4, "ink", false), c(43, 31, 4, "ink", false),
      p("M28 38 L36 38 L32 46 Z", "a3")],
  },
  {
    name: "Penguin",
    pieces: [e(32, 36, 21, 24, "a2"), e(32, 42, 14, 17, "paper", false), ...eyes(27, 8, 3.6), p("M26 33 L38 33 L32 40 Z", "a6"),
      e(13, 42, 5, 11, "a2"), e(51, 42, 5, 11, "a2")],
  },
  {
    name: "Frog",
    pieces: [c(19, 20, 9, "a5"), c(45, 20, 9, "a5"), e(32, 40, 24, 17, "a5"), c(19, 20, 5, "paper", false), c(45, 20, 5, "paper", false),
      c(19, 20, 2.4, "ink", false), c(45, 20, 2.4, "ink", false), line("M14 42 q18 12 36 0"), c(26, 36, 1.4, "ink", false), c(38, 36, 1.4, "ink", false)],
  },
  {
    name: "Pig",
    pieces: [p("M13 24 L12 8 L28 16 Z", "a4"), p("M51 24 L52 8 L36 16 Z", "a4"), e(32, 36, 21, 19, "a4"), e(32, 42, 10, 7.5, "paper"),
      e(28.5, 42, 1.8, 2.6, "ink", false), e(35.5, 42, 1.8, 2.6, "ink", false), ...eyes(30, 9, 3.6)],
  },
  {
    name: "Lion",
    pieces: [c(32, 35, 28, "a6"), c(14, 17, 6, "a3"), c(50, 17, 6, "a3"), c(32, 36, 18, "a3"), e(32, 43, 9, 7, "paper"),
      ...eyes(32, 8, 3.6), p("M28 39 L36 39 L32 44 Z", "ink", false), line("M32 44 L32 47"), line("M27 48 q5 4 10 0")],
  },
  {
    name: "Tiger",
    pieces: [c(14, 17, 8, "a6"), c(50, 17, 8, "a6"), c(32, 36, 21, "a6"), line("M32 16 L32 24", 3), line("M24 18 L26 25", 3), line("M40 18 L38 25", 3),
      line("M11 34 L18 36", 3), line("M11 42 L18 41", 3), line("M53 34 L46 36", 3), line("M53 42 L46 41", 3),
      e(32, 44, 10, 7.5, "paper"), ...eyes(32, 8.5, 3.6), nose(32, 41, "a4"), line("M32 43 L32 46"), line("M28 47 q4 3 8 0")],
  },
  {
    name: "Monkey",
    pieces: [c(10, 32, 8, "a6"), c(54, 32, 8, "a6"), c(10, 32, 4, "paper", false), c(54, 32, 4, "paper", false), c(32, 33, 21, "a6"),
      p("M32 28 Q23 18 17 28 Q16 38 26 40 Q32 44 38 40 Q48 38 47 28 Q41 18 32 28 Z", "paper"), ...eyes(31, 7, 3.4),
      e(29.5, 39, 1.2, 1.6, "ink", false), e(34.5, 39, 1.2, 1.6, "ink", false), line("M26 45 q6 4 12 0")],
  },
  {
    name: "Koala",
    pieces: [c(11, 22, 11, "a1"), c(53, 22, 11, "a1"), c(11, 22, 6, "paper", false), c(53, 22, 6, "paper", false), e(32, 37, 20, 19, "a1"),
      ...eyes(33, 9, 3.4), e(32, 42, 6, 8, "ink", false), line("M26 51 q6 4 12 0")],
  },
  {
    name: "Elephant",
    pieces: [c(11, 30, 11, "a1"), c(53, 30, 11, "a1"), c(11, 30, 6, "a4", false), c(53, 30, 6, "a4", false), e(32, 32, 18, 18, "a1"),
      { tag: "rect", attrs: { x: 26, y: 38, width: 12, height: 22, rx: 6 }, fill: "a1", stroke: "ink" }, ...eyes(28, 8.5, 3.4),
      line("M27 50 L37 50", 1.6), line("M27 55 L37 55", 1.6)],
  },
  {
    name: "Whale",
    pieces: [p("M4 40 Q6 18 30 18 Q46 18 52 30 L61 22 Q63 31 58 36 Q63 41 62 48 L51 41 Q44 55 28 55 Q8 55 4 40 Z", "a1"),
      p("M8 44 Q28 56 48 46 Q38 52 22 52 Z", "paper", false), c(16, 33, 4, "paper", false), c(16.6, 33.2, 2, "ink", false),
      line("M7 42 q6 4 12 1"), line("M30 18 q-2 -6 -6 -8 M30 18 q2 -6 6 -8", 2)],
  },
  {
    name: "Turtle",
    pieces: [e(18, 52, 5, 6, "a3"), e(44, 54, 5, 5, "a3"), c(52, 36, 8, "a3"), c(54.5, 34, 2.4, "paper", false), c(55, 34, 1.1, "ink", false),
      p("M6 48 Q8 18 32 18 Q56 18 58 48 Z", "a5"), line("M32 18 L32 48", 1.6), line("M16 33 Q32 28 48 33", 1.6), line("M10 44 L54 44", 1.6)],
  },
  {
    name: "Octopus",
    pieces: [e(14, 50, 5, 10, "a4"), e(26, 54, 5, 9, "a4"), e(38, 54, 5, 9, "a4"), e(50, 50, 5, 10, "a4"), c(32, 28, 21, "a4"),
      ...eyes(30, 8.5, 4.4), line("M27 42 q5 4 10 0"), c(22, 16, 2, "paper", false), c(27, 12, 1.4, "paper", false)],
  },
  {
    name: "Chick",
    pieces: [line("M32 10 Q26 2 24 8 M32 10 Q34 0 40 4", 2.4), c(32, 37, 22, "a3"), e(12, 40, 5, 9, "a3"), e(52, 40, 5, 9, "a3"),
      ...eyes(32, 9, 3.2), p("M26 40 L38 40 L32 49 Z", "a6")],
  },
  {
    name: "Hedgehog",
    pieces: [p("M6 40 L10 22 L16 30 L20 14 L26 24 L32 10 L38 24 L44 14 L48 30 L54 22 L58 40 Q58 56 32 56 Q6 56 6 40 Z", "a2"),
      p("M14 42 Q22 28 38 30 Q52 32 54 44 Q50 54 32 54 Q18 54 14 42 Z", "paper"), c(39, 38, 3, "paper", false), c(39.4, 38.2, 1.5, "ink", false),
      e(50, 44, 3, 2.4, "ink", false), line("M40 47 q4 3 8 0")],
  },
  {
    name: "Sloth",
    pieces: [e(32, 36, 22, 19, "paper"), p("M12 32 Q14 24 24 30 Q24 40 14 42 Z", "a2"), p("M52 32 Q50 24 40 30 Q40 40 50 42 Z", "a2"),
      c(20, 34, 3.4, "paper", false), c(44, 34, 3.4, "paper", false), c(20.4, 34.4, 1.6, "ink", false), c(43.6, 34.4, 1.6, "ink", false),
      e(32, 41, 3.6, 2.6, "ink", false), line("M25 46 q7 6 14 0"), line("M8 14 Q16 22 22 16 M56 14 Q48 22 42 16", 2.4)],
  },
  {
    name: "Wolf",
    pieces: [p("M10 32 L13 4 L29 20 Z", "a2"), p("M54 32 L51 4 L35 20 Z", "a2"), p("M16 24 L17 12 L25 19 Z", "paper", false),
      p("M48 24 L47 12 L39 19 Z", "paper", false), e(32, 37, 21, 19, "a2"), p("M14 42 Q32 36 50 42 Q42 58 32 58 Q22 58 14 42 Z", "paper"),
      ...eyes(32, 8.5, 3.6), e(32, 46, 3.4, 2.6, "ink", false)],
  },
  {
    name: "Deer",
    pieces: [line("M20 18 L14 4 M17 11 L8 9 M44 18 L50 4 M47 11 L56 9", 3), e(11, 24, 8, 5, "a6"), e(53, 24, 8, 5, "a6"),
      e(32, 37, 18, 21, "a6"), e(32, 49, 9, 7, "paper"), ...eyes(32, 8, 3.4), e(32, 46, 3.4, 2.6, "a4", false), line("M28 52 q4 3 8 0")],
  },
];

/** How many characters there are: the same number as the Quiz API and the game server allow. */
export const CHARACTER_COUNT = 24;

/** Whether `n` is one of the characters (a whole number from 0 to 23). */
export function isCharacter(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n < CHARACTER_COUNT;
}

/** The character's name ("Fox"), or null for none or a number outside the set. */
export function characterName(n: unknown): string | null {
  return isCharacter(n) ? CHARACTERS[n].name : null;
}

/** The theme colour a drawing slot stands for: answer colours, a dark outline, and light patches. Never a raw colour. */
export function slotColor(slot: Slot): string {
  if (slot === "ink") return "var(--g-ink, var(--sc))";
  if (slot === "paper") return "var(--g-white, var(--card))";
  return `var(--${slot})`;
}

const STORED = "quizplayo.character";

/** The character this device picked last time (0 to 23), so a student need not pick again; null when none. */
export function readStoredCharacter(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return isCharacter(n) ? n : null;
}

export function loadCharacter(): number | null {
  try {
    return readStoredCharacter(window.localStorage.getItem(STORED));
  } catch {
    return null;
  }
}

export function storeCharacter(n: number | null) {
  try {
    if (n === null) window.localStorage.removeItem(STORED);
    else window.localStorage.setItem(STORED, String(n));
  } catch {
    // Storage blocked: the choice lasts until the page closes.
  }
}
