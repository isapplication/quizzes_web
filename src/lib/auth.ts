import { clearTabKey, safeNext, setTabKey } from "./tab";

/** What every Quizplayo sign-in and sign-up answers: this tab's new session key and where to go. */
export interface Started {
  key: string;
  next: string;
  mustChangePassword: boolean;
}

/** This tab becomes the person who just signed in (see lib/tab.ts), then opens their next page. */
export function startTab(r: Started) {
  clearTabKey();
  setTabKey(r.key);
  window.location.replace(r.next);
}

/** The ?next= of this page, only when it is a path on this site. */
export function nextFromUrl(): string {
  return typeof window === "undefined" ? "/home" : safeNext(new URLSearchParams(window.location.search).get("next"));
}
