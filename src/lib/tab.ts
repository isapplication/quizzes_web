/**
 * One person per browser tab. The tab keeps its own session key in sessionStorage (it lasts while the tab is
 * open, survives a refresh and is never shared with other tabs), and api() sends it as a Bearer header. A tab
 * with no key uses the normal session cookie, then claims that session's key so it stays this person even when
 * someone else signs in from another tab.
 */
const KEY = "quizplayo.tab";
const CHANNEL = "quizplayo-auth";

export function tabKey(): string | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setTabKey(key: string) {
  try {
    window.sessionStorage.setItem(KEY, key);
  } catch {
    // Storage blocked (private mode on some browsers): the tab keeps using the cookie.
  }
}

export function clearTabKey() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

/** Only paths on this site, like the Quiz API's safeNext. */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) {
    return "/home";
  }
  return next;
}

/** Starts sign-in as another person in a new tab at {@code signInPage}; this tab stays as it is. */
export function signInAsSomeoneElse(signInPage: string) {
  window.open(signInPage, "_blank", "noopener");
}

/** Tells the other tabs of this browser that everyone has been signed out. */
export function announceSignedOutEverywhere() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage({ type: "signed-out-everywhere" });
  channel.close();
}

/** Calls back when another tab signs everyone out; returns the function that stops listening. */
export function onSignedOutEverywhere(callback: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (e: MessageEvent) => {
    if ((e.data as { type?: string })?.type === "signed-out-everywhere") callback();
  };
  return () => channel.close();
}
