/**
 * The four answer shapes (D5): drop on IS blue, star on navy, hexagon on amber, wave on raspberry.
 * Each answer has its own shape, so colour is never the only cue.
 */
const PATHS = [
  "M12 2C12 2 4.5 10.2 4.5 14.6a7.5 7.5 0 0 0 15 0C19.5 10.2 12 2 12 2z",
  "M12 2.4L14.47 9.2L21.7 9.45L15.99 13.9L18 20.85L12 16.8L6 20.85L8.01 13.9L2.3 9.45L9.53 9.2z",
  "M12 2L20.66 7V17L12 22L3.34 17V7z",
  "M2 8.5C5 5 9 5 12 8.5S19 12 22 8.5V15.5C19 19 15 19 12 15.5S5 12 2 15.5Z",
];

export const SHAPE_NAMES = ["drop", "star", "hexagon", "wave"];

export function AnswerShape({ index, size = 24, color }: { index: number; size?: number; color?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ flexShrink: 0, color: color ?? `var(--a${(index % 4) + 1})` }}
    >
      <path d={PATHS[index % 4]} fill="currentColor" />
    </svg>
  );
}
