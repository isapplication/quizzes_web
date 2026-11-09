/**
 * A small accuracy-over-time line for one student or class: each scored session's percent, oldest first (0 to 100,
 * fixed, so lines compare). One series, so no legend: the column or heading names it. Drawn from the theme's variables
 * (the line in the school's primary colour, a hairline at the needs-help line, a ring in the card colour round the end
 * dot so it reads over the line). The numbers are always in the table beside it; the dots carry them as tooltips.
 */
import { NEEDS_HELP_BELOW } from "@/lib/reports";

export function Trend({ values, label, width = 112, height = 32 }: { values: number[]; label: string; width?: number; height?: number }) {
  if (values.length === 0) return <span className="muted" aria-label={label + ": no sessions yet"}>–</span>;
  const pad = 6;
  const x = (i: number) => values.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1);
  const y = (v: number) => height - pad - (Math.max(0, Math.min(100, v)) / 100) * (height - 2 * pad);
  const points = values.map((v, i) => x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" ");
  const last = values.length - 1;
  const summary = label + ": " + values.map((v) => v + "%").join(", ") + " over the last " + values.length
    + (values.length === 1 ? " session" : " sessions") + ", oldest first";
  return (
    <svg className="trend" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={summary}
         focusable="false">
      <line className="trend-line-help" x1={pad} x2={width - pad} y1={y(NEEDS_HELP_BELOW)} y2={y(NEEDS_HELP_BELOW)} />
      {values.length > 1 && <polyline className="trend-line" points={points} />}
      {values.map((v, i) => (
        <g key={i}>
          {i === last && <circle className="trend-end" cx={x(i)} cy={y(v)} r={4} />}
          <circle className="trend-hit" cx={x(i)} cy={y(v)} r={8}><title>{"Session " + (i + 1) + ": " + v + "%"}</title></circle>
        </g>
      ))}
    </svg>
  );
}
