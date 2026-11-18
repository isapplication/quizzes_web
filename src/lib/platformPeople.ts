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

/** What waits for an account: an open invitation to its email, or its pending join request. */
export interface PendingItem {
  kind: "INVITATION" | "JOIN_REQUEST";
  id: string;
  tenantId: string;
  userId: string | null;
  workspaceName: string;
  role: string | null;
  message: string | null;
  createdAt: string;
  expiresAt: string | null;
  expired: boolean | null;
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
  pending: PendingItem[];
  changes: PersonChange[];
}

export interface Done {
  message: string;
  person: Person;
}

/** Someone found inside one workspace (students only here); email only for staff. */
export interface FoundMember {
  userId: string;
  name: string;
  role: string;
  status: string;
  username: string | null;
  email: string | null;
  grade: number | null;
  hasAccount: boolean;
}

export interface MemberClass {
  id: string;
  code: string;
  name: string;
  synced: boolean;
}

export interface ClassOption extends MemberClass {
  grade: number | null;
}

export interface OpenInvitation {
  id: string;
  email: string;
  role: string;
  sentAt: string;
  expiresAt: string;
  expired: boolean;
}

/** One person in one workspace (PlatformMembers.Member). */
export interface Member {
  tenantId: string;
  userId: string;
  workspaceName: string;
  kind: "SCHOOL" | "INDEPENDENT";
  workspaceStatus: string;
  name: string;
  role: string;
  status: string;
  username: string | null;
  email: string | null;
  grade: number | null;
  accountId: string | null;
  linked: boolean;
  source: string;
  firstSeenAt: string;
  lastSignInAt: string | null;
  archivedAt: string | null;
  /** Why they can't stop being an active admin here: LAST_ADMIN or OWNER. */
  guard: "LAST_ADMIN" | "OWNER" | null;
  classes: MemberClass[];
  invitation: OpenInvitation | null;
  changes: PersonChange[];
}

export interface MemberDone {
  message: string;
  member: Member;
  /** Only right after an invitation was sent. */
  link: string | null;
}

export const STAFF_ROLES = ["TEACHER", "CONTENT_REVIEWER", "SCHOOL_ADMIN"] as const;

/** Why the platform team can't take this admin out of their workspace, in plain words. */
export function guardText(guard: Member["guard"]): string | null {
  if (guard === "LAST_ADMIN") return "The only active school admin here: they can't be switched off, archived, made a teacher or removed until someone else is a school admin.";
  if (guard === "OWNER") return "Their own workspace: they stay its admin. To stop them, switch off or archive their account.";
  return null;
}

/** What a username may be (PlatformMembers.username): the Quiz API checks the same. */
export function usernameProblem(raw: string): string | null {
  return /^[a-z0-9][a-z0-9._-]{2,39}$/.test(raw.trim().toLowerCase())
    ? null
    : "A username needs 3 to 40 lower-case letters, digits, dots, hyphens or underscores, starting with a letter or digit.";
}

export function gradeLabel(grade: number | null): string {
  return grade == null ? "—" : grade === 0 ? "Kindergarten" : "Grade " + grade;
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
  PERSON_MEMBER_CHANGED: "Changed in a workspace",
  PERSON_CLASSES_CHANGED: "Classes changed",
  PERSON_UNLINKED: "Removed from a workspace",
  INVITATION_SENT: "Invitation sent",
  INVITATION_EMAIL_CHANGED: "Invitation email corrected",
  INVITATION_WITHDRAWN: "Invitation withdrawn",
  JOIN_REQUEST_DECLINED: "Join request declined",
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
  role: "Role",
  username: "Username",
  grade: "Grade",
  classesAdded: "Classes added",
  classesRemoved: "Classes removed",
  linked: "Account in this workspace",
  invitation: "Invitation",
  joinRequest: "Join request",
};

function show(field: string, value: unknown): string {
  if (field === "status" && typeof value === "string") return accountStatus(value).label;
  if (field === "hasPassword") return value ? "Set" : "None";
  if (field === "role" && typeof value === "string") return roleLabel(value);
  if (field === "grade") return gradeLabel(typeof value === "number" ? value : null);
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value === null || value === undefined ? "—" : String(value);
}

/** "Name: Sam → Sam R." lines for one change, every field in before or after. */
export function changeLines(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  const fields = Array.from(new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]));
  return fields.flatMap((f) => {
    // Class changes are lists of what was added or removed, not a before and after.
    if (f === "classesAdded" || f === "classesRemoved") {
      const list = (after?.[f] ?? before?.[f]) as unknown;
      return Array.isArray(list) && list.length ? [`${FIELDS[f]}: ${list.join(", ")}`] : [];
    }
    return [`${FIELDS[f] ?? f}: ${show(f, before?.[f])} → ${show(f, after?.[f])}`];
  });
}

/** Where the People tab is: the search, one account, or one person in one workspace. */
export type PeoplePlace =
  | { kind: "search" }
  | { kind: "account"; accountId: string }
  | { kind: "member"; tenantId: string; userId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The page's own address, so a person's page can be bookmarked and shared inside the team: only ids, never a name or
 * an email (addresses end up in browser history and server logs).
 */
export function peopleSearch(place: PeoplePlace): string {
  if (place.kind === "account") return `?tab=people&account=${place.accountId}`;
  if (place.kind === "member") return `?tab=people&workspace=${place.tenantId}&person=${place.userId}`;
  return "?tab=people";
}

/** The place an address names; anything else, or an id that isn't one, is the search. */
export function peoplePlace(search: string): PeoplePlace {
  const q = new URLSearchParams(search);
  const account = q.get("account");
  const tenantId = q.get("workspace");
  const userId = q.get("person");
  if (account && UUID.test(account)) return { kind: "account", accountId: account };
  if (tenantId && userId && UUID.test(tenantId) && UUID.test(userId)) return { kind: "member", tenantId, userId };
  return { kind: "search" };
}
