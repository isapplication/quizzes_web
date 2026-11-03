"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, ApiError } from "./api";
import { clearTabKey, onSignedOutEverywhere, setTabKey, tabKey } from "./tab";
import { ErrorState, LoadingState } from "@/components/ui/States";

/** A school's own branding (Brand settings): file addresses are null when the school has not uploaded one. */
export interface SchoolBrand {
  colors: { primary?: string; secondary?: string; accent?: string };
  logoUrl: string | null;
  iconUrl: string | null;
  termsUrl: string | null;
  termsName: string | null;
}

export type Role = "STUDENT" | "PARENT" | "CONTENT_REVIEWER" | "TEACHER" | "SCHOOL_ADMIN";

export interface Me {
  userId: string;
  name: string;
  role: Role;
  roles: Role[];
  grade: number | null;
  classes: string[];
  locale: string;
  school: {
    id: string;
    name: string;
    theme: Record<string, string>;
    status: string;
    code: string | null;
    /** SCHOOL, or INDEPENDENT: a teacher's personal workspace (no school page, no student accounts). */
    kind: "SCHOOL" | "INDEPENDENT";
    brand: SchoolBrand;
    /** How the school's people sign in: SCHOOL_PORTAL, EMAIL_CODE (staff), PASSWORD (students). */
    signInMethods: string[];
    /** The grades it teaches; empty for a personal workspace whose teacher hasn't picked them yet. */
    grades: number[];
  };
  /** For someone who came from their school's own system: where to go back to; otherwise null. */
  schoolSystemUrl: string | null;
  devTools: boolean;
  /** Signed in through the platform team's two-step sign-in, and on the console's allowlist. */
  platformTeam: boolean;
  /** How this person signed in this time: SSO, PASSWORD, EMAIL_CODE, SIGN_UP, PLATFORM or SWITCH. */
  signedInWith: string;
  /** Their Quizplayo account (teachers and admins); null for students and school-portal sign-ins. */
  account: { email: string; verified: boolean; workspaces: number } | null;
  /** The server sends emails. False: they are only stored (Communication), so screens never say "we emailed". */
  mailOn: boolean;
}

export function isIndependent(me: Me): boolean {
  return me.school.kind === "INDEPENDENT";
}

export function isSchoolAdmin(me: Me): boolean {
  return me.roles.includes("SCHOOL_ADMIN");
}

export function isStaff(me: Me): boolean {
  return me.roles.some((r) => r === "TEACHER" || r === "SCHOOL_ADMIN" || r === "CONTENT_REVIEWER");
}

const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside a signed-in page");
  return me;
}

/**
 * Whose look a screen shows (the Quiz API's ShownBrand): your own pages follow your school; a game follows the
 * school hosting it. "quizplayo" means Quizplayo's own look.
 */
export interface ShownBrand {
  owner: "school" | "quizplayo";
  name: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  theme: Record<string, string>;
}

const THEME_VARIABLES = /^--(pc|plc|pgc|sc|slc|tc|tlc|fc|flc|success|warning|danger)$/;

/** Your own school's look, for screens that follow you rather than what is on them. */
export function ownBrand(me: Me): ShownBrand {
  return {
    owner: "school",
    name: me.school.name,
    logoUrl: me.school.brand?.logoUrl ?? null,
    iconUrl: me.school.brand?.iconUrl ?? null,
    theme: me.school.theme ?? {},
  };
}

/** Back to Quizplayo's own colours (drops every school colour set by applyTheme). */
export function resetTheme() {
  const style = document.documentElement.style;
  for (const name of Array.from(style)) {
    if (THEME_VARIABLES.test(name)) style.removeProperty(name);
  }
}

/** Applies the school's School Setup colours over the Quizplayo defaults (only known theme variables). */
export function applyTheme(theme: Record<string, string>) {
  const allowed = THEME_VARIABLES;
  for (const [name, value] of Object.entries(theme)) {
    if (allowed.test(name) && /^[#(),.%\w\s-]+$/.test(value)) {
      document.documentElement.style.setProperty(name, value);
    }
  }
}

/** Uses the school's own browser icon, or Quizplayo's when it has none. */
export function applyIcon(iconUrl: string | null | undefined) {
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon'][data-school]");
  if (!iconUrl) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    link.dataset.school = "1";
    document.head.appendChild(link);
  }
  link.href = iconUrl;
}

/** Loads the signed-in person; sends anyone not signed in to the sign-in page, then back here. */
export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => onSignedOutEverywhere(() => {
    clearTabKey();
    window.location.href = "/";
  }), []);

  useEffect(() => {
    // A tab opened without a key (a new tab, a bookmark) takes the cookie's session as its own, so it stays this
    // person when someone else signs in from another tab.
    const claim = tabKey()
      ? Promise.resolve()
      : api<{ key: string }>("/api/v1/auth/tab", { method: "POST" }).then((r) => setTabKey(r.key)).catch(() => undefined);
    claim
      .then(() => api<Me>("/api/v1/me"))
      .then((m) => {
        applyTheme(m.school.theme ?? {});
        applyIcon(m.school.brand?.iconUrl);
        setMe(m);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 401) {
          const next = window.location.pathname + window.location.search;
          window.location.href = "/sign-in?next=" + encodeURIComponent(next);
          return;
        }
        setError(e instanceof Error ? e.message : "Quizplayo could not load your account.");
      });
  }, []);

  if (error) {
    return (
      <main className="page">
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      </main>
    );
  }
  if (!me) {
    return (
      <main className="page">
        <LoadingState rows={4} label="Loading your account" />
      </main>
    );
  }
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}
