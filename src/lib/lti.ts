/**
 * LTI launches: the Quiz API sends the browser to /lti/opening#<code> (often inside the LMS's frame). The one-time
 * code lives only after "#", so it never reaches a server log or a Referer; the page that redeems it reads it here.
 */
export function codeFromHash(hash: string): string | null {
  const code = hash.startsWith("#") ? hash.slice(1) : hash;
  return /^[A-Za-z0-9_-]{16,200}$/.test(code) ? code : null;
}

/** Where the new tab signs in with the code. */
export function openPath(code: string): string {
  return "/lti/open#" + code;
}

/** Decision O4: a school's LMS registration waits for the Quizplayo platform team before it is used. */
export type RegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface StatusView {
  label: string;
  tone: "ok" | "warn" | "danger";
  /** For the school admin, in plain words. */
  message: string;
}

/** How the school admin's page shows the registration's review. */
export function registrationStatus(status: string | null | undefined, reviewNote?: string | null): StatusView {
  switch (status) {
    case "APPROVED":
      return {
        label: "Approved",
        tone: "ok",
        message: "The Quizplayo platform team approved this LMS. Renaming it, switching it on or off, or removing a "
          + "deployment ID keeps the approval; changing anything else sends it for approval again.",
      };
    case "REJECTED":
      return {
        label: "Rejected",
        tone: "danger",
        message: "The Quizplayo platform team didn't approve this LMS"
          + (reviewNote ? ": “" + reviewNote + "”" : ".")
          + " Correct the values below and save them to send it for approval again. If they are right, ask Quizplayo support.",
      };
    default:
      return {
        label: "Pending approval",
        tone: "warn",
        message: "The Quizplayo platform team checks every LMS before it is used, so no other school can use your LMS's "
          + "client ID. Until it's approved, opening Quizplayo from your LMS shows a message instead. There's nothing "
          + "more for you to do: its status shows here.",
      };
  }
}

/** What "Save" tells the school admin, from the review status the save came back with. */
export function savedNotice(before: string | null | undefined, after: string | null | undefined): string {
  if (after === "PENDING") {
    return before === "APPROVED"
      ? "Saved. Because the LMS's details changed, it waits for approval by the Quizplayo platform team again."
      : "Saved. It waits for approval by the Quizplayo platform team.";
  }
  if (after === "REJECTED") {
    return "Saved, but nothing the Quizplayo platform team checks has changed, so it is still rejected. Correct the "
      + "issuer, client ID, addresses or deployment IDs, or ask Quizplayo support.";
  }
  return "Saved.";
}

/** Another school's registration with the same issuer and client ID (the platform console flags it). */
export interface Clash {
  id: string;
  schoolId: string;
  school: string;
  status: RegistrationStatus;
}

/** The console's warning before approving, or null when no other school registered the same issuer and client ID. */
export function clashWarning(clashes: Clash[]): string | null {
  if (clashes.length === 0) return null;
  const word = (s: RegistrationStatus) => (s === "APPROVED" ? "approved" : s === "PENDING" ? "waiting" : "turned down");
  const names = clashes.map((c) => `${c.school} (${word(c.status)})`).join(", ");
  const held = clashes.some((c) => c.status === "APPROVED");
  return `Other schools registered this issuer and client ID: ${names}. `
    + (held
      ? "Only one school can be approved: turn the approved one down first if this school is the LMS's real owner."
      : "Approve only the school the LMS belongs to; check with the school if you are not sure.");
}
