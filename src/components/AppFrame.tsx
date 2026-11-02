"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Started, startTab } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { isIndependent, isSchoolAdmin, isStaff, Me, MeProvider, useMe } from "@/lib/me";
import { announceSignedOutEverywhere, clearTabKey, signInAsSomeoneElse } from "@/lib/tab";

/** The frame of every signed-in page: the school's logo and name, the menu and sign-out; the school's terms below. */
export function AppFrame({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <MeProvider>
      <TopBar />
      <ConfirmEmailBanner />
      <main className="page" style={wide ? { maxWidth: 1400 } : undefined}>
        {children}
      </main>
      <Footer />
    </MeProvider>
  );
}

const ROLE_WORDS: Record<string, string> = {
  STUDENT: "Student", TEACHER: "Teacher", SCHOOL_ADMIN: "School admin", CONTENT_REVIEWER: "Content reviewer", PARENT: "Parent",
};

function TopBar() {
  const me = useMe();
  const staff = isStaff(me);
  const school = !isIndependent(me);
  const [menu, setMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userMenu) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setUserMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setUserMenu(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [userMenu]);

  return (
    <header className="topbar app-topbar">
      <Link href="/home" className="brand">
        {me.school.brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="school-logo" src={me.school.brand.logoUrl} alt="" />
        ) : null}
        <span>{me.school.name}</span>
      </Link>
      <button type="button" className="site-menu-button" aria-expanded={menu} aria-controls="app-nav" onClick={() => setMenu((m) => !m)}>
        <span aria-hidden="true">☰</span><span className="sr-only">Menu</span>
      </button>
      <nav id="app-nav" aria-label="Main" className={menu ? "app-nav open" : "app-nav"}>
        {staff ? (
          <>
            <Link className="btn btn-primary nav-create" href="/teacher/quiz/new">Create a quiz</Link>
            <Link href="/home">My quizzes</Link>
            <Link href="/teacher/bank">Question bank</Link>
            <Link href="/teacher/studio">AI Studio</Link>
          </>
        ) : (
          !me.platformTeam && <Link href="/play">Join a game</Link>
        )}
        {isSchoolAdmin(me) && school && <Link href="/admin/setup">Get started</Link>}
        {isSchoolAdmin(me) && school && <Link href="/admin/people">People</Link>}
        {isSchoolAdmin(me) && <Link href="/admin/brand">Brand settings</Link>}
        {me.platformTeam && <Link href="/platform">Platform console</Link>}
        <div className="user-menu" ref={box}>
          <button type="button" className="user-menu-button" aria-haspopup="menu" aria-expanded={userMenu}
                  onClick={() => setUserMenu((u) => !u)}>
            <span className="user-avatar" aria-hidden="true">{initials(me.name)}</span>
            <span className="user-name">{me.name}</span>
            <span aria-hidden="true">▾</span>
          </button>
          {userMenu && (
            <div className="user-menu-panel" role="menu">
              <div className="user-menu-who">
                <strong>{me.name}</strong>
                <span className="muted">{ROLE_WORDS[me.role] ?? me.role} · {me.school.name}</span>
              </div>
              {me.account && me.account.workspaces > 1 && <Workspaces />}
              <Link role="menuitem" href="/home" onClick={() => setUserMenu(false)}>Home</Link>
              {me.schoolSystemUrl && <a role="menuitem" href={me.schoolSystemUrl}>Back to your school&apos;s system</a>}
              {(me.account || me.signedInWith === "PASSWORD") && (
                <Link role="menuitem" href="/account/password" onClick={() => setUserMenu(false)}>Change password</Link>
              )}
              <Link role="menuitem" href="/help" onClick={() => setUserMenu(false)}>Help</Link>
              <hr className="user-menu-sep" />
              <button role="menuitem" type="button" onClick={() => { setUserMenu(false); signInAsSomeoneElse(someoneElsePage(me)); }}>
                Sign in as someone else
                <span className="user-menu-hint">Opens a new tab. This tab stays signed in as you.</span>
              </button>
              <hr className="user-menu-sep" />
              <button role="menuitem" type="button" onClick={() => signOut(false)}>Sign out</button>
              <button role="menuitem" type="button" onClick={() => signOut(true)}>
                Sign out everywhere
                <span className="user-menu-hint">Every person signed in on this browser.</span>
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
}

/** Where another person signs in: the account sign-in for staff, the school's page for its students. */
function someoneElsePage(me: Me): string {
  if (me.account) return "/sign-in";
  if (me.schoolSystemUrl) return me.schoolSystemUrl;
  return me.school.code ? "/s/" + me.school.code : "/sign-in";
}

interface Workspace {
  id: string;
  name: string;
  kind: "SCHOOL" | "INDEPENDENT";
  role: string;
  status: string;
  current: boolean;
}

/** The account's other workspaces: choosing one switches this tab to it (other tabs stay where they are). */
function Workspaces() {
  const [list, setList] = useState<Workspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Workspace[]>("/api/v1/workspaces").then(setList).catch((e: unknown) =>
      setError(e instanceof ApiError ? e.message : "Quizplayo could not load your workspaces."));
  }, []);

  async function open(w: Workspace) {
    setError(null);
    try {
      startTab(await api<Started>("/api/v1/workspaces/" + w.id + "/open", { method: "POST" }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Quizplayo could not open that workspace.");
    }
  }

  return (
    <div className="user-menu-workspaces" role="group" aria-label="Your workspaces">
      <span className="user-menu-label">Your workspaces</span>
      {!list && !error && <span className="muted user-menu-hint">Loading…</span>}
      {list?.map((w) => (
        <button key={w.id} role="menuitemradio" aria-checked={w.current} type="button" disabled={w.current || w.status !== "ACTIVE"}
                className={w.current ? "current" : ""} onClick={() => open(w)}>
          <span>{w.current ? "✓ " : ""}{w.kind === "INDEPENDENT" ? "Personal: " + w.name : w.name}</span>
          <span className="user-menu-hint">
            {ROLE_WORDS[w.role] ?? w.role}{w.status === "ACTIVE" ? "" : w.status === "DISABLED" ? " · switched off" : " · paused"}
          </span>
        </button>
      ))}
      {error && <span className="user-menu-hint" role="alert">{error}</span>}
      <hr className="user-menu-sep" />
    </div>
  );
}

/** Until a teacher or admin confirms their email, a quiet reminder with "Send the email again". */
function ConfirmEmailBanner() {
  const me = useMe();
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!me.account || me.account.verified) return null;

  async function resend() {
    setBusy(true);
    try {
      const r = await api<{ message: string }>("/api/v1/account/verify-email/resend", { method: "POST" });
      setSent(r.message);
    } catch (e) {
      setSent(e instanceof ApiError ? e.message : "Quizplayo could not send the email. Please try again later.");
    }
    setBusy(false);
  }

  return (
    <div className="confirm-banner" role="status">
      <span>{sent ?? <>Please confirm your email: we sent a link to <strong>{me.account.email}</strong>.</>}</span>
      {!sent && <button type="button" className="btn btn-light" disabled={busy} onClick={resend}>Send the email again</button>}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.replace(/^(Mr|Ms|Mrs|Dr)\.?\s+/i, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function Footer() {
  const me = useMe();
  const ownBrand = !!me.school.brand?.logoUrl;
  return (
    <footer className="app-footer">
      <nav aria-label="Footer" className="app-footer-links">
        <Link href="/help">Help</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        {me.school.brand?.termsUrl && (
          <a href={me.school.brand.termsUrl} target="_blank" rel="noopener">{me.school.name} terms</a>
        )}
      </nav>
      <span>© {BRAND.year} {BRAND.name}. All rights reserved.{ownBrand ? ` · Powered by ${BRAND.name}` : ""}</span>
    </footer>
  );
}

/**
 * Signs this tab's person out of Quizplayo (or, everywhere, every person signed in on this browser). Other tabs keep
 * their own people unless it is everywhere. A school's own system keeps its own sign-in.
 */
async function signOut(everywhere: boolean) {
  await api(everywhere ? "/api/v1/auth/logout?everywhere=true" : "/api/v1/auth/logout", { method: "POST" }).catch(() => null);
  clearTabKey();
  if (everywhere) announceSignedOutEverywhere();
  window.location.href = "/";
}
