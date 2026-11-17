/**
 * The platform console's People (quizplayo-docs/docs/platform-people-plan.md, step 1): the shapes the Quiz API returns
 * (PlatformPeople records) and the plain-words rules the dialogs share. Pure, so it is unit-tested.
 */

export type AccountStatus = "ACTIVE" | "DISABLED" | "ARCHIVED";

export interface FoundPerson {
  accountId: string;
  email: string;
  name: string;
  status: AccountStatus;
  emailConfirmed: boolean;
  workspaces: number;
}

export interface PersonWorkspace {
  tenantId: string;
  userId: string;
  workspaceName: string;
  kind: "SCHOOL" | "INDEPENDENT";
  workspaceStatus: string;
  role: string;
  status: string;
  name: string;
  linked: boolean;
  lastSignInAt: string | null;
}

export interface PersonChange {
  at: string;
  action: string;
  by: string;
  reasonCategory: string | null;
  reason: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface Person {
  accountId: string;
  email: string;
  name: string;
  status: AccountStatus;
  emailConfirmed: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  onPlatformList: boolean;
  workspaces: PersonWorkspace[];
  changes: PersonChange[];
}

export interface Done {
  message: string;
  person: Person;
}

/** Why a change is made (PlatformPeople.REASON_CATEGORIES), in the order the dialog lists them. */
export const REASON_CATEGORIES: { value: string; label: string }[] = [
  { value: "PERSON_ASKED", label: "The person asked" },
  { value: "SCHOOL_ASKED", label: "Their school asked" },
  { value: "SECURITY", label: "Security" },
  { value: "DATA_FIX", label: "Fixing wrong data" },
];

export const REASON_MIN = 10;
export const REASON_MAX = 500;

/** What is wrong with the reason, or null when it can be sent (the Quiz API checks the same). */
export function reasonProblem(category: string, text: string): string | null {
  if (!REASON_CATEGORIES.some((c) => c.value === category)) return "Choose why you are making this change.";
  const t = text.trim();
  if (t.length < REASON_MIN) return `Write what happened in at least ${REASON_MIN} characters, for example who asked and the ticket.`;
  if (t.length > REASON_MAX) return `Keep it to ${REASON_MAX} characters.`;
  return null;
}

/** What is wrong with a new sign-in email typed twice, or null. */
export function newEmailProblem(current: string, email: string, confirm: string): string | null {
  const e = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || e.length > 254) return "Enter the new email address in full, like name@example.com.";
  if (e === current.trim().toLowerCase()) return "That is already this person's sign-in email.";
  if (e !== confirm.trim().toLowerCase()) return "The two addresses are different. Type the same address in both boxes.";
  return null;
}

export function accountStatus(status: string): { label: string; tone: "ok" | "warn" | "danger" | "plain" } {
  switch (status) {
    case "ACTIVE":
      return { label: "Active", tone: "ok" };
    case "DISABLED":
      return { label: "Switched off", tone: "danger" };
    case "ARCHIVED":
      return { label: "Archived", tone: "plain" };
    default:
      return { label: status, tone: "plain" };
  }
}

const ROLES: Record<string, string> = {
  SCHOOL_ADMIN: "School admin",
  TEACHER: "Teacher",
  CONTENT_REVIEWER: "Content reviewer",
  STUDENT: "Student",
  PARENT: "Parent",
};

export function roleLabel(role: string): string {
  return ROLES[role] ?? role;
}

const ACTIONS: Record<string, string> = {
  PERSON_EMAIL_CHANGED: "Sign-in email changed",
  PERSON_ACCOUNT_CHANGED: "Account changed",
  PERSON_ARCHIVED: "Archived",
  PERSON_RESTORED: "Restored",
  PERSON_SIGNED_OUT: "Signed out everywhere",
};

export function actionLabel(action: string): string {
  return ACTIONS[action] ?? action;
}

export function reasonCategoryLabel(category: string | null): string {
  return REASON_CATEGORIES.find((c) => c.value === category)?.label ?? "";
}

const FIELDS: Record<string, string> = {
  email: "Sign-in email",
  emailConfirmed: "Email confirmed",
  name: "Name",
  status: "Status",
  hasPassword: "Password",
};

function show(field: string, value: unknown): string {
  if (field === "status" && typeof value === "string") return accountStatus(value).label;
  if (field === "hasPassword") return value ? "Set" : "None";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value === null || value === undefined ? "—" : String(value);
}

/** "Name: Sam → Sam R." lines for one change, every field in before or after. */
export function changeLines(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  const fields = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  return fields.map((f) => `${FIELDS[f] ?? f}: ${show(f, before?.[f])} → ${show(f, after?.[f])}`);
}
