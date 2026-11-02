/** Words and lists shared by the school pages, the platform console and the "Get started" checklist. */

export const GRADES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Grade 0 is Kindergarten. */
export function gradeLabel(grade: number): string {
  return grade === 0 ? "K" : String(grade);
}

/** A list of grades in words, with runs joined: [0,1,2,5,7,8] → "K–2, 5, 7–8". */
export function gradesText(grades: number[]): string {
  const sorted = [...new Set(grades)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || sorted[i] !== sorted[i - 1] + 1) {
      const from = sorted[start];
      const to = sorted[i - 1];
      parts.push(from === to ? gradeLabel(from) : `${gradeLabel(from)}–${gradeLabel(to)}`);
      start = i;
    }
  }
  return parts.join(", ");
}

/** A country's English name from its two-letter code (no list needed). */
export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** A workspace's status as people read it, with the chip style that goes with it. */
export function schoolStatus(status: string): { label: string; tone: "ok" | "warn" | "danger" | "plain" } {
  switch (status) {
    case "ACTIVE":
      return { label: "Live", tone: "ok" };
    case "SUSPENDED":
      return { label: "Suspended", tone: "danger" };
    case "CLOSED":
      return { label: "Closed", tone: "plain" };
    default:
      return { label: status, tone: "plain" };
  }
}

/** The token from the link in the "confirm your email" email: /verify-email#token=… (never sent in a URL to a server). */
export function tokenFromHash(hash: string): string | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const token = params.get("token");
  return token && /^[A-Za-z0-9_-]{20,100}$/.test(token) ? token : null;
}
