import { Andika, Fredoka, Inter, Lexend, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { lookBand, lookGrade } from "@/lib/gameLook";
import { Scene } from "./LookArt";
import "@/theme/game-looks.css";

// Bundled with the app at build time, so no font loads from Google during a game. Not preloaded: a screen only
// downloads the family its look uses.
const andika = Andika({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-andika", display: "swap", preload: false });
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap", preload: false });
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend", display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap", preload: false });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap", preload: false });
const FONTS = [andika, fredoka, lexend, spaceGrotesk, inter].map((f) => f.variable).join(" ");

/**
 * A live game screen drawn in a grade's look: the family's fonts and shapes, the grade's scene and accents, over the
 * school's colours. {@code kind} "host" is the classroom screen (scales with its width up to a projector), "player"
 * a phone, "compact" the class simulator's small frames (no scene).
 */
export function GameLook({ grade, kind, className = "", children }: {
  grade: number | null | undefined;
  kind: "host" | "player" | "compact";
  className?: string;
  children: ReactNode;
}) {
  const g = lookGrade(grade);
  return (
    <div className={`gl gl-${kind} ${FONTS} ${className}`} data-band={lookBand(g)} data-grade={g}>
      {kind !== "compact" && <Scene grade={g} tall={kind === "player"} />}
      {children}
    </div>
  );
}
