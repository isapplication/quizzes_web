"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Read-aloud (wave2-plan.md, W25): the browser's own speech (speechSynthesis) on the device that asks. Nothing is sent to a
 * server, and there is no cost. A speaker button appears only where the browser has at least one voice.
 */

function synth(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
}

/** The language to read in: the page's, else the browser's, else English. */
export function pageLocale(preferred?: string | null): string {
  if (preferred) return preferred;
  if (typeof document !== "undefined" && document.documentElement.lang) return document.documentElement.lang;
  if (typeof navigator !== "undefined" && navigator.language) return navigator.language;
  return "en";
}

/** The best voice for a locale: an exact match ("en-IN"), else the same language ("en"), else none (the browser's default). */
export function pickVoice(voices: { lang: string }[], locale: string): { lang: string } | null {
  const want = locale.toLowerCase().replace("_", "-");
  const language = want.split("-")[0];
  return voices.find((v) => v.lang.toLowerCase().replace("_", "-") === want)
    ?? voices.find((v) => v.lang.toLowerCase().split(/[-_]/)[0] === language) ?? null;
}

/** What is said for a question: its text, then each answer by number (a picture answer by its description). */
export function questionSpeech(text: string, choices: string[], pictures?: ({ alt: string } | null | undefined)[] | null): string {
  const parts = [text.trim()];
  choices.forEach((c, i) => {
    const said = c.trim() || pictures?.[i]?.alt?.trim() || "";
    if (said) parts.push("Answer " + (i + 1) + ": " + said);
  });
  return parts.filter(Boolean).join(". ");
}

/** The speech of this device: whether it can speak, say something, and stop. */
export function useSpeech(locale?: string | null) {
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const current = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const s = synth();
    if (!s) return;
    const check = () => setReady(s.getVoices().length > 0);
    check();
    s.addEventListener?.("voiceschanged", check);
    return () => {
      s.removeEventListener?.("voiceschanged", check);
      s.cancel();
    };
  }, []);

  const stop = useCallback(() => {
    synth()?.cancel();
    current.current = null;
    setSpeaking(false);
  }, []);

  const say = useCallback((text: string) => {
    const s = synth();
    if (!s || !text.trim()) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const lang = pageLocale(locale);
    u.lang = lang;
    const voice = pickVoice(s.getVoices(), lang);
    if (voice) u.voice = voice as SpeechSynthesisVoice;
    u.rate = 0.95;
    u.onend = () => { if (current.current === u) { current.current = null; setSpeaking(false); } };
    u.onerror = u.onend;
    current.current = u;
    setSpeaking(true);
    s.speak(u);
  }, [locale]);

  return { ready, speaking, say, stop };
}

/**
 * A speaker button: reads {@code text} aloud, and stops when pressed again. Hidden when the browser has no voices. The
 * button names what it reads, for screen reader users too.
 */
export function ReadAloudButton({ text, what = "the question", locale, className = "" }: {
  text: string;
  what?: string;
  locale?: string | null;
  className?: string;
}) {
  const { ready, speaking, say, stop } = useSpeech(locale);
  // Another question arrived: stop reading the old one.
  useEffect(() => stop, [text, stop]);
  if (!ready) return null;
  return (
    <button type="button" className={"read-aloud " + className} aria-pressed={speaking}
            aria-label={(speaking ? "Stop reading " : "Read aloud: ") + what}
            onClick={() => (speaking ? stop() : say(text))}>
      {speaking ? (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path fill="currentColor" d="M3 9v6h4l5 4V5L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" />
        </svg>
      )}
    </button>
  );
}

/** Reads each new question aloud on the classroom screen when the host has switched that on (kept on this device). */
export function useAutoRead(on: boolean, text: string | null, locale?: string | null) {
  const { ready, say, stop } = useSpeech(locale);
  useEffect(() => {
    if (on && ready && text) say(text);
    return () => stop();
  }, [on, ready, text, say, stop]);
  return ready;
}

const KEY = "quizplayo.readAloud";

/** The host's "Read questions aloud" choice, kept on this device only; off until it is switched on. */
export function useReadAloudSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      setOn(window.localStorage.getItem(KEY) === "1");
    } catch {
      // Storage blocked: off, and it stays off for next time.
    }
  }, []);
  const set = (value: boolean) => {
    setOn(value);
    try {
      window.localStorage.setItem(KEY, value ? "1" : "0");
    } catch {
      // Storage blocked: the choice lasts until the page is closed.
    }
  };
  return [on, set];
}
