/**
 * AI Studio (Wave 3: 3c every type, 3d sources and the monthly ceiling, 3f lessons and worked solutions): what a
 * teacher can draft from and its limits (the same as the API's, so the page can say so before sending), the request
 * the page sends, and the cost estimate in words.
 */
import { fromServer, type EditorQuestion, type QType, toServer } from "./questionTypes";

export type SourceKind = "TOPIC" | "TEXT" | "WIKIPEDIA" | "PDF" | "PHOTOS";
export type DraftKind = "QUIZ" | "LESSON";

/** The limits the API checks (AiSources): shown next to each source, and checked here first. */
export const SOURCE_LIMITS = {
  topic: 300,
  minText: 100,
  maxText: 20_000,
  pdfMb: 10,
  pdfPages: 20,
  photos: 5,
  photoMb: 10,
} as const;

export const SOURCES: { kind: SourceKind; label: string; hint: string }[] = [
  { kind: "TOPIC", label: "A topic", hint: "Describe it in 3 to 300 characters." },
  { kind: "TEXT", label: "Pasted text", hint: "100 to 20,000 characters, such as a reading passage or your notes." },
  { kind: "WIKIPEDIA", label: "A Wikipedia article", hint: "Its title or its wikipedia.org link. Other sites can't be used." },
  { kind: "PDF", label: "A PDF", hint: "Up to 20 pages and 10 MB, not password-protected. Save slides as a PDF first." },
  { kind: "PHOTOS", label: "Photos of notes", hint: "Up to 5 JPEG or PNG photos, 10 MB each. Only the picture is sent, never the camera's details." },
];

/** The types AI Studio writes in a quiz (W46): every type but slides, which only a lesson has. */
export const WRITABLE: QType[] = ["QUIZ", "TRUE_FALSE", "MULTI_SELECT", "TYPE_ANSWER", "SLIDER", "PUZZLE", "CATEGORISE", "POLL"];
export const DEFAULT_TYPES: QType[] = ["QUIZ", "TRUE_FALSE"];

/** What the teacher has filled in on the form. */
export interface SourceInput {
  topic: string;
  text: string;
  wikipedia: string;
  files: { name: string; size: number; type: string }[];
}

const MB = 1024 * 1024;

/** What is missing or too big for this source, in words; null when it can be sent. */
export function sourceProblem(kind: SourceKind, input: SourceInput): string | null {
  const topic = input.topic.trim();
  if (topic.length > SOURCE_LIMITS.topic) return "Keep the topic to 300 characters.";
  switch (kind) {
    case "TOPIC":
      return topic.length < 3 ? "Describe the topic in 3 to 300 characters." : null;
    case "TEXT": {
      const n = input.text.trim().length;
      if (n < SOURCE_LIMITS.minText) return "Paste at least 100 characters of text.";
      if (n > SOURCE_LIMITS.maxText) return `The text is ${n.toLocaleString("en")} characters; AI Studio reads up to 20,000. Paste a shorter part.`;
      return null;
    }
    case "WIKIPEDIA":
      return input.wikipedia.trim() ? null : "Type a Wikipedia article's title, or paste its link.";
    case "PDF": {
      if (input.files.length !== 1) return "Choose one PDF.";
      const f = input.files[0];
      if (f.type && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) return "That file isn't a PDF.";
      return f.size > SOURCE_LIMITS.pdfMb * MB ? "The PDF is larger than 10 MB. Choose a smaller one." : null;
    }
    case "PHOTOS": {
      if (input.files.length === 0) return "Choose 1 to 5 photos.";
      if (input.files.length > SOURCE_LIMITS.photos) return "Choose up to 5 photos at a time.";
      if (input.files.some((f) => f.size > SOURCE_LIMITS.photoMb * MB)) return "Each photo can be up to 10 MB.";
      if (input.files.some((f) => f.type && f.type !== "image/jpeg" && f.type !== "image/png")) {
        return "Photos must be JPEG or PNG images.";
      }
      return null;
    }
  }
}

/** The run's settings, as POST /api/v1/ai/drafts takes them. */
export interface StartSettings {
  kind: DraftKind;
  sourceKind: SourceKind;
  topic: string;
  text: string;
  wikipedia: string;
  grade: number;
  subject: string;
  count: number;
  classCode: string | null;
  types: QType[];
}

export function startJson(s: StartSettings) {
  return {
    topic: s.topic.trim(),
    grade: s.grade,
    subject: s.subject,
    count: s.count,
    classCode: s.classCode || null,
    types: s.types,
    kind: s.kind,
    sourceKind: s.sourceKind,
    text: s.sourceKind === "TEXT" ? s.text : null,
    wikipedia: s.sourceKind === "WIKIPEDIA" ? s.wikipedia.trim() : null,
  };
}

/**
 * The request body: JSON for a topic, text or Wikipedia; for a PDF or photos, a FormData upload with the settings as a
 * JSON part named "request" and each file as "files" (the API reads them in memory and keeps none, W48).
 */
export function startBody(s: StartSettings, files: File[]): unknown {
  if (s.sourceKind !== "PDF" && s.sourceKind !== "PHOTOS") return startJson(s);
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify(startJson(s))], { type: "application/json" }), "request.json");
  files.forEach((f) => form.append("files", f, f.name));
  return form;
}

/** The school's AI allowance this month, in US dollars (W53). */
export interface Allowance {
  ceiling: number;
  spent: number;
  reserved: number;
  remaining: number;
}

export interface Estimate {
  mode: "LIVE" | "SAMPLE";
  usd: number;
  withClaudeUsd: number;
  /** An upper bound: a PDF's pages or an article's length aren't known before it is read. */
  upTo: boolean;
  allowance: Allowance;
}

/** "$0.12"; "under $0.01" for a cost too small to show. */
export function money(usd: number): string {
  if (usd > 0 && usd < 0.005) return "under $0.01";
  return "$" + usd.toFixed(2);
}

/** The estimate before "Draft", in words. */
export function estimateText(e: Estimate): string {
  if (e.allowance.ceiling <= 0) return "AI drafting is switched off for your school. Ask Quizplayo support.";
  const left = "$" + e.allowance.remaining.toFixed(2) + " of your school's $" + e.allowance.ceiling.toFixed(2)
    + " AI allowance is left this month.";
  if (e.mode === "SAMPLE") {
    return "Sample mode: this draft costs nothing (with Claude it would be " + (e.upTo ? "up to " : "about ")
      + money(e.withClaudeUsd) + "). " + left;
  }
  return "This draft costs " + (e.upTo ? "up to " : "about ") + money(e.usd) + ". " + left;
}

/** True when the allowance can't take this draft: the page says so, and the API would refuse it. */
export function overAllowance(e: Estimate): boolean {
  return e.allowance.ceiling <= 0 || e.allowance.remaining <= 0 || e.usd > e.allowance.remaining;
}

/** A draft as the review edits it: the editor's own shape, with the draft's position to link it back (AI activity). */
export interface ReviewItem {
  position: number | null;
  q: EditorQuestion;
}

/** A draft from the API (AiStudioController.QuestionOut) in the editor's shape; AI drafts are standard points. */
export function draftToEditor(raw: Record<string, unknown>): EditorQuestion {
  return { ...fromServer(raw), points: 1 };
}

/** What publishing sends for one kept draft (AiStudioService.EditedQuestion). */
export function toPublish(item: ReviewItem) {
  return { ...toServer(item.q), position: item.position };
}
