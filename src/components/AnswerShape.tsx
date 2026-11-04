/**
 * The answer shapes (D5): drop, star, hexagon and wave for the first four answers, then triangle and square for the
 * fifth and sixth (Wave 1b). Each answer has its own shape and colour token (--a1 to --a6), so colour is never the
 * only cue. The room pattern pad (Wave 1a) uses only the first four.
 */
const PATHS = [
  "M12 2C12 2 4.5 10.2 4.5 14.6a7.5 7.5 0 0 0 15 0C19.5 10.2 12 2 12 2z",
  "M12 2.4L14.47 9.2L21.7 9.45L15.99 13.9L18 20.85L12 16.8L6 20.85L8.01 13.9L2.3 9.45L9.53 9.2z",
  "M12 2L20.66 7V17L12 22L3.34 17V7z",
  "M2 8.5C5 5 9 5 12 8.5S19 12 22 8.5V15.5C19 19 15 19 12 15.5S5 12 2 15.5Z",
  "M12 3L22 20.5H2z",
  "M4 4H20V20H4z",
];

export const SHAPE_COUNT = PATHS.length;

export const SHAPE_NAMES = ["drop", "star", "hexagon", "wave", "triangle", "square"];

/** 1 to 6: the answer's colour token number (--a1 … --a6) and data-n. */
export function shapeNumber(index: number): number {
  return (((index % SHAPE_COUNT) + SHAPE_COUNT) % SHAPE_COUNT) + 1;
}

export function shapeName(index: number): string {
  return SHAPE_NAMES[shapeNumber(index) - 1];
}

export function AnswerShape({ index, size = 24, color }: { index: number; size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ flexShrink: 0, color: color ?? `var(--a${shapeNumber(index)})` }}
    >
      <path d={PATHS[shapeNumber(index) - 1]} fill="currentColor" />
    </svg>
  );
}
