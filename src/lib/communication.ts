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
  createdAt: string;
  sentAt: string | null;
  read: boolean;
  schoolName: string | null;
  attachments: EmailFile[];
}

/** A file sent with an email. */
export interface EmailFile {
  id: string;
  name: string;
  type: string;
  size: number;
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
  /** Its first recipient; {@code recipients} is how many it has. */
  to: string;
  recipients: number;
  subject: string;
  kind: string;
  schoolName: string | null;
  status: EmailStatus;
  error: string | null;
  sentAt: string | null;
  mailOn: boolean;
  /** The SMTP service it was sent with; null before this was recorded, or while it is pending. */
  provider: string | null;
  attachments: number;
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
  /** The SMTP service in use now. */
  provider: string;
  /** Every provider found in stored emails, for the filter. */
  providers: string[];
}

/** The provider filter's value for emails that don't record one. */
export const PROVIDER_NOT_RECORDED = "NONE";

/** One email as the console opens it: everything it was sent with. */
export interface ConsoleDetail {
  body: string;
  smtpHost: string | null;
  from: string | null;
  replyTo: string | null;
  recipients: { role: "TO" | "CC" | "BCC"; address: string; readAt: string | null }[];
  attachments: (EmailFile & { sha256: string })[];
}

/** "240 KB", "3.1 MB". */
export function fileSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return new Intl.NumberFormat(undefined, { style: "unit", unit: "megabyte", maximumFractionDigits: 1 }).format(mb);
  return new Intl.NumberFormat(undefined, { style: "unit", unit: "kilobyte", maximumFractionDigits: 0 })
    .format(Math.max(1, Math.round(bytes / 1024)));
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
  EMAIL_CHANGED_OLD: "Sign-in email changed (old address)",
  EMAIL_CHANGED_NEW: "Sign-in email changed (new address)",
  STUDENT_INVITE: "Student invite link",
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
