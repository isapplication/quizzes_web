/** Emails Quizplayo stored (quizplayo-docs/docs/communication-plan.md): a person's own, and the platform team's view. */

export type EmailStatus = "PENDING" | "SENT" | "FAILED";

export interface Message {
  id: string;
  kind: string;
  subject: string;
  /** As sent, with its link shown as "••••••". */
  body: string;
  /** That link, while it still works. */
  link: string | null;
  status: EmailStatus;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
  read: boolean;
  schoolName: string | null;
}

export interface Inbox {
  messages: Message[];
  more: boolean;
  unread: number;
  mailOn: boolean;
}

/** One row on the console's Emails tab. */
export interface ConsoleEmail {
  id: string;
  createdAt: string;
  to: string;
  subject: string;
  kind: string;
  schoolName: string | null;
  status: EmailStatus;
  error: string | null;
  sentAt: string | null;
  mailOn: boolean;
  /** A code or link that still works and was not delivered. */
  hasSecret: boolean;
  resentFrom: string | null;
  resentBy: string | null;
  sentAgainAt: string | null;
  sentAgainBy: string | null;
}

export interface ConsolePage {
  emails: ConsoleEmail[];
  more: boolean;
  today: Record<EmailStatus, number>;
  mailOn: boolean;
}

export const KIND_LABEL: Record<string, string> = {
  SIGN_IN_CODE: "Sign-in code",
  PLATFORM_CODE: "Console sign-in code",
  PROOF_CODE: "Account-linking code",
  WELCOME: "Welcome",
  VERIFY_EMAIL: "Confirm email",
  INVITATION: "Invitation",
  JOIN_REQUEST: "Asks to join",
  JOIN_APPROVED: "You're in",
};

/** What a status means, in words: never only a colour. */
export function statusText(status: EmailStatus, error?: string | null): string {
  if (status === "PENDING") return "Not emailed: mail is switched off";
  if (status === "FAILED") return "Couldn't be sent" + (error ? `: ${error}` : "");
  return "Emailed";
}

export function statusChip(status: EmailStatus): string {
  return status === "SENT" ? "chip chip-ok" : status === "FAILED" ? "chip chip-danger" : "chip chip-warn";
}

/** "3 Nov, 14:02" in the viewer's own time zone. */
export function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** A link the reader may open in this app: only this app's own pages. */
export function ownLink(link: string | null): string | null {
  if (!link) return null;
  try {
    const u = new URL(link, window.location.origin);
    return u.origin === window.location.origin ? u.pathname + u.search + u.hash : null;
  } catch {
    return null;
  }
}
