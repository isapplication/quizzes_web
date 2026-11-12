"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Started, startTab } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { isConsoleSession, isIndependent, isSchoolAdmin, isStaff, Me, MeProvider, useMe } from "@/lib/me";
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
  PLATFORM: "Platform team",
};

/** Fired when Communication's unread count may have changed (a message was read). */
export const COMMUNICATION_CHANGED = "quizplayo:communication-changed";

function TopBar() {
  const me = useMe();
  return isConsoleSession(me) ? <ConsoleTopBar /> : <SchoolTopBar />;
}

/**
 * The top bar of a platform console session: no school, so only the console, help and signing out (the Quiz API
 * refuses everything else for this session).
 */
function ConsoleTopBar() {
  const me = useMe();
  const [userMenu, setUserMenu] = useState(false);
  return (
    <header className="topbar app-topbar">
      <Link href="/platform" className="brand"><span>{me.school.name}</span></Link>
      <nav aria-label="Main" className="app-nav">
        <Link href="/platform">Platform console</Link>
        <div className="user-menu">
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
                <span className="muted">{ROLE_WORDS.PLATFORM}</span>
              </div>
              <Link role="menuitem" href="/help" onClick={() => setUserMenu(false)}>Help</Link>
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

function SchoolTopBar() {
  const me = useMe();
  const staff = isStaff(me);
  const school = !isIndependent(me);
  const [menu, setMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  const [folded, setFolded] = useState(false);

  // The menu folds into the ☰ button whenever its links don't fit on one line beside the school's name, at any width:
  // a school admin who also teaches has many links, so a fixed breakpoint left them on two lines at medium widths.
  // Measured unfolded; while folded, measured again only when the bar gets wider, so it doesn't flicker on shrink.
  useEffect(() => {
    const el = bar.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let lastWidth = 0;
    let isFolded = false;
    const measure = () => {
      const width = el.clientWidth;
      const grew = width > lastWidth;
      lastWidth = width;
      if (isFolded && !grew) return;
      el.classList.remove("nav-folded");
      const nav = el.querySelector<HTMLElement>(".app-nav");
      const brand = el.querySelector<HTMLElement>(".brand");
      // Hidden by the narrow-screen rule (display: none): that layout already folds it.
      const fits = !nav || !brand || nav.offsetWidth === 0
        || (nav.offsetTop <= brand.offsetTop + 4 && nav.scrollWidth <= nav.clientWidth + 1);
      isFolded = !fits;
      el.classList.toggle("nav-folded", isFolded);
      setFolded(isFolded);
    };
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  // Communication's unread count: on load, when the menu opens, and when the Communication page reads one.
  useEffect(() => {
    const load = () => api<{ unread: number }>("/api/v1/communication/unread").then((r) => setUnread(r.unread)).catch(() => undefined);
    load();
    window.addEventListener(COMMUNICATION_CHANGED, load);
    return () => window.removeEventListener(COMMUNICATION_CHANGED, load);
  }, []);
  useEffect(() => {
    if (userMenu) window.dispatchEvent(new Event(COMMUNICATION_CHANGED));
  }, [userMenu]);

  useEffect(() => {
    if (!userMenu) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setUserMenu(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setUserMenu(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc); };
  }, [userMenu]);

  return (
    <header ref={bar} className={"topbar app-topbar" + (folded ? " nav-folded" : "")}>
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
            <Link href="/library">Library</Link>
            <Link href="/teacher/studio">AI Studio</Link>
            <Link href="/teacher/reports">Reports</Link>
            <Link href="/teacher/pictures">Pictures</Link>
          </>
        ) : (
          !me.platformTeam && <Link href="/play">Join a game</Link>
        )}
        {isSchoolAdmin(me) && school && <Link href="/admin/setup">Get started</Link>}
        {isSchoolAdmin(me) && school && <Link href="/admin/people">People</Link>}
        {isSchoolAdmin(me) && <Link href="/admin/reports">School reports</Link>}
        {isSchoolAdmin(me) && <Link href="/admin/ai-use">AI use</Link>}
        {isSchoolAdmin(me) && <Link href="/admin/ai">AI settings</Link>}
        {isSchoolAdmin(me) && <Link href="/admin/brand">Brand settings</Link>}
        {me.platformTeam && <Link href="/platform">Platform console</Link>}
        <div className="user-menu" ref={box}>
          <button type="button" className="user-menu-button" aria-haspopup="menu" aria-expanded={userMenu}
                  onClick={() => setUserMenu((u) => !u)}>
            <span className="user-avatar" aria-hidden="true">{initials(me.name)}</span>
            <span className="user-name">{me.name}</span>
            {unread > 0 && <span className="unread-dot"><span className="sr-only">, {unread} unread in Communication</span></span>}
            <span aria-hidden="true">▾</span>
          </button>
          {userMenu && (
            <div className="user-menu-panel" role="menu">
              <div className="user-menu-who">
                <strong>{me.name}</strong>
                <span className="muted">{ROLE_WORDS[me.role] ?? me.role} · {me.school.name}</span>
              </div>
              {me.account && <Workspaces onDone={() => setUserMenu(false)} />}
              <Link role="menuitem" href="/home" onClick={() => setUserMenu(false)}>Home</Link>
              <Link role="menuitem" href="/communication" onClick={() => setUserMenu(false)} className="menu-with-count">
                <span>Communication</span>
                {unread > 0 && <span className="count-badge">{unread}<span className="sr-only"> unread</span></span>}
              </Link>
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

/**
 * The account's workspaces: choosing one switches this tab to it (other tabs stay where they are). Below them, the
 * way to join or create a school.
 */
function Workspaces({ onDone }: { onDone: () => void }) {
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
            {w.kind === "INDEPENDENT" ? "Your own" : ROLE_WORDS[w.role] ?? w.role}{w.status === "ACTIVE" ? "" : w.status === "DISABLED" ? " · switched off" : " · paused"}
          </span>
        </button>
      ))}
      {error && <span className="user-menu-hint" role="alert">{error}</span>}
      <Link role="menuitem" href="/workspaces" onClick={onDone}>Join or create a school</Link>
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
      <span>{sent ?? (me.mailOn
        ? <>Please confirm your email: we sent a link to <strong>{me.account.email}</strong>.</>
        : <>Please confirm your email. Emails are switched off on this server, so your link is in <Link href="/communication">Communication</Link>.</>)}</span>
      {!sent && me.mailOn && <button type="button" className="btn btn-light" disabled={busy} onClick={resend}>Send the email again</button>}
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
