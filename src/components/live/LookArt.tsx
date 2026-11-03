import type { CSSProperties, ReactNode } from "react";
import { lookCharacter, lookGrade, type Band } from "@/lib/gameLook";

/*
 * The art of the game looks, drawn in-house as SVG. It is decoration only (hidden from screen readers, never carries
 * meaning) and is coloured by the grade's accent tokens (--g1 to --g5) or the school's colours, never raw colours.
 */

const fill = (token: string): CSSProperties => ({ fill: `var(--${token})` });
const stroke = (token: string): CSSProperties => ({ stroke: `var(--${token})` });

function art(grade: number): ReactNode {
  switch (grade) {
    case 0:
      return (
        <>
          <g className="gl-float"><circle cx="150" cy="170" r="70" style={fill("g2")} /></g>
          <ellipse cx="1180" cy="190" rx="90" ry="34" className="gl-cloud" />
          <ellipse cx="1260" cy="175" rx="60" ry="30" className="gl-cloud" />
          <path d="M0 820 Q300 720 640 800 T1600 770 V900 H0Z" style={fill("g1")} />
          <path d="M0 860 Q400 800 800 850 T1600 830 V900 H0Z" style={fill("g1-deep")} />
          {Array.from({ length: 14 }, (_, i) => (
            <g key={i}>
              <circle cx={60 + i * 113} cy={840 + (i % 3) * 18} r="9" style={fill("g3")} />
              <circle cx={60 + i * 113} cy={840 + (i % 3) * 18} r="3.5" style={fill("g2")} />
            </g>
          ))}
        </>
      );
    case 1: {
      const tree = (x: number, s: number) => (
        <g key={x}>
          <path d={`M${x} ${900 - 260 * s} L${x - 70 * s} ${900 - 60 * s} H${x + 70 * s}Z M${x} ${900 - 330 * s} L${x - 55 * s} ${900 - 170 * s} H${x + 55 * s}Z`} style={fill("g2")} />
          <rect x={x - 10 * s} y={900 - 62 * s} width={20 * s} height={62 * s} style={fill("g6")} />
        </g>
      );
      return (
        <>
          <path d="M0 830 Q400 780 800 820 T1600 800 V900 H0Z" style={fill("g1")} />
          {[tree(60, 0.8), tree(150, 0.55), tree(1530, 0.85), tree(1440, 0.6)]}
          <path d="M300 880 Q320 840 340 880Z M1240 884 Q1262 846 1284 884Z" style={fill("g5")} />
        </>
      );
    }
    case 2:
      return (
        <>
          <g className="gl-float"><circle cx="150" cy="180" r="64" style={fill("g5")} /></g>
          <path d="M0 740 Q200 715 400 740 T800 740 T1200 740 T1600 740 V900 H0Z" style={fill("g1")} />
          <path d="M0 790 Q200 770 400 790 T800 790 T1200 790 T1600 790 V900 H0Z" style={fill("g1-light")} />
          <path d="M0 830 Q500 800 1000 840 T1600 820 V900 H0Z" style={fill("g2")} />
          <path d="M1460 830 Q1470 700 1430 600" strokeWidth="18" fill="none" strokeLinecap="round" style={stroke("g6")} />
          <path d="M1430 600 Q1360 560 1310 610 M1430 600 Q1500 560 1550 610 M1430 600 Q1400 530 1340 540 M1430 600 Q1470 530 1530 545"
                strokeWidth="16" fill="none" strokeLinecap="round" style={stroke("g4")} />
        </>
      );
    case 3:
      return (
        <>
          {Array.from({ length: 22 }, (_, i) => (
            <path key={i} transform={`translate(${(i * 271) % 1600} ${((i * 137) % 520) + 30}) scale(${0.6 + (i % 3) * 0.3})`}
                  d="M0 -12 L3 -3 L12 0 L3 3 L0 12 L-3 3 L-12 0 L-3 -3Z" style={fill("g2")} opacity=".8" />
          ))}
          <g className="gl-float">
            <circle cx="760" cy="95" r="52" style={fill("g4")} opacity=".85" />
            <ellipse cx="760" cy="95" rx="92" ry="18" fill="none" strokeWidth="8" style={stroke("g3")} />
          </g>
          <circle cx="180" cy="760" r="160" style={fill("g1")} />
          <circle cx="130" cy="720" r="26" style={fill("g1-deep")} />
          <circle cx="230" cy="800" r="18" style={fill("g1-deep")} />
        </>
      );
    case 4: {
      const fish = (x: number, y: number, s: number, flip: boolean) => (
        <g key={x} className="gl-float" transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
          <ellipse rx="40" ry="22" style={fill("g3")} />
          <path d="M36 0 L66 -20 V20Z" style={fill("g3")} />
          <circle cx="-20" cy="-5" r="5" style={fill("g6")} />
        </g>
      );
      return (
        <>
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={i} className="gl-bubble" style={{ animationDelay: `${-i * 0.7}s`, stroke: "var(--g5)" }}
                    cx={100 + i * 130} cy={880 - (i % 4) * 60} r={8 + (i % 3) * 6} fill="none" strokeWidth="3" opacity=".8" />
          ))}
          <path d="M0 780 Q200 750 400 780 T800 780 T1200 780 T1600 780 V900 H0Z" style={fill("g2")} opacity=".55" />
          <path d="M0 830 Q200 800 400 830 T800 830 T1200 830 T1600 830 V900 H0Z" style={fill("g2")} />
          {[fish(1420, 640, 1.1, false), fish(170, 560, 0.8, true)]}
          <path d="M120 900 Q100 820 140 760 Q170 820 150 900Z M1500 900 Q1480 800 1520 740 Q1550 820 1530 900Z" style={fill("g4")} />
        </>
      );
    }
    case 5: {
      const leaf = (x: number, y: number, r: number, s: number, c: string) => (
        <path key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} d="M0 0 Q60 -60 160 0 Q60 60 0 0Z M10 0 H150"
              strokeWidth="3" style={{ fill: `var(--${c})`, stroke: `var(--${c}-deep, var(--g2))` }} />
      );
      return (
        <>
          {[leaf(-20, 60, 20, 1.6, "g1"), leaf(-10, 180, -10, 1.2, "g2"), leaf(1620, 80, 160, 1.6, "g2"),
            leaf(1610, 220, 190, 1.2, "g1"), leaf(-30, 820, -20, 1.5, "g2"), leaf(1630, 800, 200, 1.5, "g1")]}
          <path d="M300 0 Q320 120 290 240 M1300 0 Q1280 90 1310 170" strokeWidth="8" fill="none" style={stroke("g2")} />
          <circle cx="290" cy="248" r="16" style={fill("g4")} />
          <circle cx="1310" cy="178" r="14" style={fill("g3")} />
        </>
      );
    }
    case 6:
      return (
        <>
          {Array.from({ length: 40 }, (_, i) => {
            const x = (i * 197) % 1600, y = (i * 113) % 900, s = 18 + (i % 3) * 10;
            return <rect key={i} x={x - (x % 20)} y={y - (y % 20)} width={s} height={s} style={fill(["g1", "g2", "g3", "g4"][i % 4])} opacity={0.2 + (i % 4) / 10} />;
          })}
          <path d="M40 760h40v40h-40z M80 720h40v80h-40z M120 760h40v40h-40z M1480 80h40v40h-40z M1520 40h40v40h-40z" style={fill("g1")} opacity=".6" />
        </>
      );
    case 7:
      return (
        <g fill="none" strokeWidth="4" className="gl-glow">
          <path d="M120 290 l90 -150 l90 150z" style={{ ...stroke("g1"), color: "var(--g1)" }} />
          <circle cx="1450" cy="180" r="80" style={{ ...stroke("g2"), color: "var(--g2)" }} />
          <rect x="1330" y="660" width="140" height="140" transform="rotate(20 1400 730)" style={{ ...stroke("g3"), color: "var(--g3)" }} />
          <path d="M120 760 h160 M150 800 h100" style={{ ...stroke("g4"), color: "var(--g4)" }} />
          <circle cx="300" cy="90" r="22" style={{ ...stroke("g3"), color: "var(--g3)" }} />
        </g>
      );
    case 8:
      return (
        <>
          <defs>
            <linearGradient id="gl-sun8" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--g2)" }} />
              <stop offset="1" style={{ stopColor: "var(--g1)" }} />
            </linearGradient>
          </defs>
          <circle cx="800" cy="560" r="230" fill="url(#gl-sun8)" opacity=".5" />
          {[0, 1, 2, 3, 4].map((i) => <rect key={i} x="560" y={600 + i * 34} width="480" height={6 + i * 3} style={fill("stage-solid")} />)}
        </>
      );
    case 9:
      return (
        <g fill="none" strokeWidth="2" style={stroke("g1")}>
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M${1100 - i * 40} 900 C ${1200 - i * 50} ${640 - i * 40}, ${1500 + i * 10} ${560 - i * 50}, 1660 ${520 - i * 60}`} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse key={i} cx="160" cy="140" rx={60 + i * 46} ry={40 + i * 30} transform="rotate(-12 160 140)" />
          ))}
        </g>
      );
    case 12:
      return (
        <g transform="translate(1470 110)">
          <path d="M0 -46 L11 -11 L46 0 L11 11 L0 46 L-11 11 L-46 0 L-11 -11Z" style={fill("g2")} />
          <circle r="70" fill="none" strokeWidth="1.5" style={stroke("g2")} />
          <circle r="84" fill="none" strokeWidth="1" opacity=".5" style={stroke("g2")} />
        </g>
      );
    default:
      // Grades 10 and 11 are CSS patterns (a blueprint grid and dots).
      return null;
  }
}

/**
 * The grade's scene behind the screen. A wide screen shows it whole; a tall phone would crop it to its middle, so it
 * shows the bottom-left and top-right corners of the scene instead.
 */
export function Scene({ grade, tall = false }: { grade: number; tall?: boolean }) {
  const g = lookGrade(grade);
  const content = art(g);
  if (!content) return <div className="gl-scene" aria-hidden="true" />;
  const bottomAnchored = g <= 5 || g === 8;
  return (
    <div className="gl-scene" aria-hidden="true">
      {tall ? (
        <>
          <svg viewBox="0 0 1600 900" preserveAspectRatio="xMinYMax slice" className="gl-scene-low">{content}</svg>
          <svg viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMin slice" className="gl-scene-high">{content}</svg>
        </>
      ) : (
        <svg viewBox="0 0 1600 900" preserveAspectRatio={bottomAnchored ? "xMidYMax slice" : "xMidYMid slice"}>{content}</svg>
      )}
    </div>
  );
}

export type Mood = "idle" | "happy" | "sad";

function Face({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <>
      <path className="gl-mouth-happy" d={`M${x - 8 * s} ${y} Q${x} ${y + 9 * s} ${x + 8 * s} ${y}`} strokeWidth={3 * s}
            fill="none" strokeLinecap="round" style={stroke("g-ink")} />
      <path className="gl-mouth-sad" d={`M${x - 7 * s} ${y + 6 * s} Q${x} ${y - 2 * s} ${x + 7 * s} ${y + 6 * s}`} strokeWidth={3 * s}
            fill="none" strokeLinecap="round" style={stroke("g-ink")} />
    </>
  );
}

const Eye = ({ x, y, r }: { x: number; y: number; r: number }) => (
  <>
    <circle cx={x} cy={y} r={r} style={fill("g-ink")} />
    <circle cx={x + r * 0.3} cy={y - r * 0.3} r={r * 0.32} style={fill("g-white")} />
  </>
);

/** The grade's character: a mascot for Kindergarten to Grade 2 that reacts to the answer, an emblem for 3 to 5. */
export function Buddy({ grade, mood = "idle", className = "" }: { grade: number | null | undefined; mood?: Mood; className?: string }) {
  const who = lookCharacter(grade);
  if (!who) return null;
  const tear = (cx: number, cy: number) => <circle className="gl-tear" cx={cx} cy={cy} r="3" style={fill("g-tear")} />;
  const body: Record<NonNullable<typeof who>, ReactNode> = {
    owl: (
      <>
        <path d="M30 34 L38 14 L50 30 Z M90 34 L82 14 L70 30 Z" style={fill("g4")} />
        <ellipse cx="60" cy="74" rx="40" ry="46" style={fill("g4")} />
        <ellipse cx="60" cy="88" rx="26" ry="28" style={fill("g5")} />
        <circle cx="44" cy="58" r="15" style={fill("g-white")} /><circle cx="76" cy="58" r="15" style={fill("g-white")} />
        <Eye x={46} y={60} r={7} /><Eye x={74} y={60} r={7} />
        <path d="M55 70 L65 70 L60 79 Z" style={fill("g2")} />
        <path d="M22 80 Q14 98 30 108 M98 80 Q106 98 90 108" strokeWidth="7" strokeLinecap="round" fill="none" style={stroke("g4")} />
        <Face x={60} y={90} s={0.8} />
        {tear(36, 76)}
      </>
    ),
    fox: (
      <>
        <path d="M28 18 L46 46 L22 52 Z M92 18 L74 46 L98 52 Z" style={fill("g3")} />
        <ellipse cx="60" cy="100" rx="30" ry="22" style={fill("g3")} />
        <path d="M20 50 Q60 20 100 50 Q100 80 60 96 Q20 80 20 50 Z" style={fill("g3")} />
        <path d="M30 62 Q46 64 60 92 Q74 64 90 62 Q84 86 60 98 Q36 86 30 62 Z" style={fill("g4")} />
        <Eye x={45} y={58} r={5.5} /><Eye x={75} y={58} r={5.5} />
        <ellipse cx="60" cy="76" rx="5" ry="4" style={fill("g-ink")} />
        <Face x={60} y={82} s={0.7} />
        {tear(40, 70)}
      </>
    ),
    turtle: (
      <>
        <ellipse cx="34" cy="104" rx="10" ry="7" style={fill("g3")} /><ellipse cx="80" cy="104" rx="10" ry="7" style={fill("g3")} />
        <path d="M14 96 Q14 46 60 44 Q104 46 104 96 Z" style={fill("g4")} />
        <path d="M44 56 L60 50 L76 56 L76 74 L60 80 L44 74 Z M24 76 L40 74 L44 92 M96 76 L80 74 L76 92 M60 80 L60 96"
              strokeOpacity=".35" strokeWidth="3" fill="none" style={stroke("g-white")} />
        <rect x="10" y="92" width="98" height="8" rx="4" style={fill("g3")} />
        <circle cx="104" cy="64" r="16" style={fill("g3")} />
        <Eye x={108} y={58} r={4.5} />
        <Face x={106} y={68} s={0.55} />
        {tear(100, 64)}
      </>
    ),
    rocket: (
      <g transform="rotate(30 60 60)">
        <path d="M60 8 Q84 34 84 78 H36 Q36 34 60 8Z" strokeWidth="3" style={{ ...fill("g-white"), ...stroke("g1") }} />
        <circle cx="60" cy="48" r="11" style={fill("g4")} />
        <path d="M36 62 L20 92 H38Z M84 62 L100 92 H82Z" style={fill("g3")} />
        <path d="M46 80 Q60 122 74 80Z" style={fill("g2")} />
      </g>
    ),
    whale: (
      <>
        <path d="M14 70 Q14 34 56 34 Q96 34 100 62 L116 46 L112 72 L118 92 L98 80 Q86 104 52 104 Q14 104 14 70Z" style={fill("g2")} />
        <path d="M22 80 Q40 100 76 96 Q50 92 30 74Z" opacity=".85" style={fill("g-white")} />
        <Eye x={38} y={60} r={5} />
        <path d="M52 32 Q48 14 40 10 M52 32 Q56 14 64 8 M52 32 V12" strokeWidth="5" strokeLinecap="round" fill="none" style={stroke("g1")} />
      </>
    ),
    toucan: (
      <>
        <path d="M50 30 Q86 26 90 70 Q90 104 56 108 Q30 108 30 74 Q30 40 50 30Z" style={fill("g-ink")} />
        <path d="M38 60 Q46 50 58 56 Q50 70 38 60Z M40 64 Q46 96 62 100 Q42 100 38 80Z" style={fill("g-white")} />
        <path d="M54 46 Q96 30 112 52 Q88 60 56 58Z" style={fill("g3")} />
        <path d="M98 44 Q108 46 112 52 Q104 54 96 54Z" style={fill("g4")} />
        <circle cx="50" cy="48" r="5" strokeWidth="2.5" style={{ ...fill("g-ink"), ...stroke("g-white") }} />
      </>
    ),
  };
  return (
    <svg className={"gl-buddy " + className} data-mood={mood} viewBox="0 0 120 128" aria-hidden="true">
      {body[who]}
    </svg>
  );
}

/** Confetti for the podium, in the family's shape; none in 9–12 or with reduced motion (see game-looks.css). */
export function Confetti({ band }: { band: Band }) {
  if (band === "h912") return null;
  const colours = ["var(--pc)", "var(--tc)", "var(--g1, var(--pc))", "var(--g2, var(--tc))", "var(--g3, var(--warning))"];
  return (
    <div className="gl-confetti" aria-hidden="true">
      {Array.from({ length: 36 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, "--c": colours[i % 5], "--t": `${2.6 + (i % 5) * 0.5}s`, "--d": `${-(i % 7) * 0.45}s` } as CSSProperties} />
      ))}
    </div>
  );
}
