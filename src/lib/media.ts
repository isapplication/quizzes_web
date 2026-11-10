/**
 * Pictures and video on questions, answers and slides (wave2-plan.md parts 2f and 2g). A picture is uploaded once
 * ({@code POST /api/v1/media}) and then only its id and description are kept on a question; screens get a signed address
 * and the picture's size. A slide's video is a YouTube clip, shown through youtube-nocookie.com, and never plays by itself.
 */
import { api } from "./api";

/**
 * A picture as the Quiz API sends it: {@code url}, {@code width} and {@code height} are missing while it is only stored.
 * {@code removed} is true when its teacher or a school admin removed it (decision O3): no address, only its words.
 */
export interface MediaRef {
  mediaId: string;
  /** A description for screen readers and read-aloud (required, up to 120 characters). */
  alt: string;
  url?: string | null;
  width?: number | null;
  height?: number | null;
  removed?: boolean | null;
}

/**
 * What the game server and the assignment page send with a question: the address is there, unless the picture was
 * removed ({@code removed: true}, then {@code url} is empty and screens show "Picture removed" with the alt text).
 */
export interface ShownPicture {
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  removed?: boolean;
}

/** Shown in place of a picture that was removed. */
export const PICTURE_REMOVED = "Picture removed";

/** Whether this picture can't be drawn because it was removed (or arrived without an address). */
export function isRemoved(p: { url?: string | null; removed?: boolean | null } | null | undefined): boolean {
  return !!p && (p.removed === true || !p.url);
}

export const PICTURE = {
  types: ["image/jpeg", "image/png"],
  accept: "image/jpeg,image/png",
  maxBytes: 5 * 1024 * 1024,
  maxAlt: 120,
} as const;

/** A plain-words problem with a file chosen as a picture (before anything is uploaded); null when it can go up. */
export function pictureProblem(file: { type: string; size: number; name?: string }): string | null {
  if (!PICTURE.types.includes(file.type as (typeof PICTURE.types)[number])) {
    return "Choose a JPEG or PNG picture. GIF, SVG and other kinds can't be used.";
  }
  if (file.size > PICTURE.maxBytes) {
    return "That picture is " + (file.size / 1024 / 1024).toFixed(1) + " MB. Choose one up to 5 MB.";
  }
  if (file.size === 0) return "That file is empty. Choose another picture.";
  return null;
}

export interface Uploaded {
  mediaId: string;
  width: number;
  height: number;
  url: string;
}

/** Uploads a picture for the signed-in school; the API checks it again and writes it again (no location data stays). */
export function uploadPicture(file: File): Promise<Uploaded> {
  const body = new FormData();
  body.append("file", file);
  return api<Uploaded>("/api/v1/media", { method: "POST", body });
}

/** Only pictures that have an address can be shown; a removed one is shown as removed, with its words. */
export function shown(ref: MediaRef | ShownPicture | null | undefined): ShownPicture | null {
  if (ref && ref.removed) return { url: "", alt: ref.alt, width: ref.width, height: ref.height, removed: true };
  if (!ref || !ref.url) return null;
  return { url: ref.url, alt: ref.alt, width: ref.width, height: ref.height };
}

// ---- The "Pictures" page: a teacher's own pictures, and removing one (decision O3)

/** A picture on the "Pictures" page, as {@code GET /api/v1/media} lists it. */
export interface TeacherPicture {
  mediaId: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  /** Who added it (null when that person is no longer in the school). */
  addedBy: string | null;
  /** Added by the signed-in person. */
  mine: boolean;
  /** How many quizzes use it, and the first few of their titles. */
  quizzes: number;
  quizTitles: string[];
  url: string;
}

export type PictureScope = "mine" | "school";

/** The signed-in person's pictures, or a school admin's whole school ({@code "school"}). Newest first. */
export function listPictures(scope: PictureScope = "mine"): Promise<TeacherPicture[]> {
  return api<TeacherPicture[]>("/api/v1/media" + (scope === "school" ? "?scope=school" : ""));
}

/** Removes a picture for good: its own teacher, or a school admin. */
export function removePicture(mediaId: string): Promise<void> {
  return api<void>("/api/v1/media/" + encodeURIComponent(mediaId), { method: "DELETE" });
}

/** What removing a picture changes, in the words the confirm step shows. */
export function removalWarning(p: Pick<TeacherPicture, "quizzes" | "quizTitles">): string {
  const where = p.quizzes === 0
    ? "No quiz uses it now."
    : "Questions in " + quizList(p.quizzes, p.quizTitles) + " will show \u201c" + PICTURE_REMOVED + "\u201d and its description instead.";
  return where + " Phones and browsers that already opened it may still show it for up to 48 hours, until their"
    + " links expire. This can't be undone.";
}

function quizList(count: number, titles: string[]): string {
  const named = titles.slice(0, Math.min(titles.length, 3)).map((t) => "\u201c" + t + "\u201d");
  const rest = count - named.length;
  if (named.length === 0) return count === 1 ? "1 quiz" : count + " quizzes";
  if (rest > 0) return named.join(", ") + " and " + rest + (rest === 1 ? " other quiz" : " other quizzes");
  if (named.length === 1) return named[0];
  return named.slice(0, -1).join(", ") + " and " + named[named.length - 1];
}

/** "Used in 2 quizzes", or "Not used in a quiz". */
export function usedIn(quizzes: number): string {
  return quizzes === 0 ? "Not used in a quiz" : "Used in " + quizzes + (quizzes === 1 ? " quiz" : " quizzes");
}

/** A file size in plain words: "84 KB", "1.2 MB". */
export function fileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

/** An answer's visible label: its text, unless it is only the picture's description (the server fills that in for reports). */
export function visibleText(text: string, picture: ShownPicture | MediaRef | null | undefined): string {
  return picture && text === picture.alt ? "" : text;
}

// ---- A slide's video (part 2g)

/** The video as stored: only the YouTube id and two times. {@code url} is what a teacher pasted, until it is saved. */
export interface SlideVideo {
  id?: string;
  url?: string;
  start: number | null;
  end: number | null;
}

export const VIDEO = { maxSeconds: 10 * 60 } as const;

/** Where a slide's clip plays: youtube-nocookie.com, from the start time to the end time; never autoplay. */
export function embedUrl(video: { id: string; start?: number | null; end?: number | null }): string {
  const p = new URLSearchParams({ rel: "0", playsinline: "1", modestbranding: "1" });
  if (video.start && video.start > 0) p.set("start", String(Math.floor(video.start)));
  if (video.end && video.end > 0) p.set("end", String(Math.floor(video.end)));
  return "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(video.id) + "?" + p.toString();
}

/** "1:05" for 65 seconds. */
export function clock(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "";
  const s = Math.max(0, Math.round(seconds));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}

/** "1:05", "65" or "65s" as seconds; null when it is not a time. */
export function parseTime(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const colon = /^(\d{1,3}):([0-5]?\d)$/.exec(t);
  if (colon) return Number(colon[1]) * 60 + Number(colon[2]);
  const plain = /^(\d{1,5})s?$/.exec(t);
  return plain ? Number(plain[1]) : null;
}

/** What still stops a slide's video from being published, in plain words; null when it is fine or there is none. */
export function videoProblem(video: SlideVideo | null | undefined): string | null {
  if (!video || (!video.id && !video.url?.trim())) return null;
  if (video.start !== null && video.start < 0) return "Start the video at 0:00 or later.";
  if (video.end === null) return "Say where the video stops: give an end time.";
  const start = video.start ?? 0;
  if (video.end <= start) return "Make the video end after it starts.";
  if (video.end - start > VIDEO.maxSeconds) return "A video can play for up to 10 minutes. Shorten it.";
  return null;
}

// ---- Reactions on slides (part 2g)

/** The five fixed reactions: each an icon with a word, so no reaction depends on colour or a picture alone. */
export const REACTIONS: { icon: string; word: string }[] = [
  { icon: "👍", word: "Got it" },
  { icon: "❤️", word: "Love it" },
  { icon: "😄", word: "Funny" },
  { icon: "😕", word: "Confused" },
  { icon: "😮", word: "Wow" },
];

/** A reaction's counts and running taps, as the classroom screen gets them every 300 ms. */
export interface ReactionCounts {
  counts: number[];
  taps: number[];
  total: number;
}

export const NO_REACTIONS: ReactionCounts = { counts: [0, 0, 0, 0, 0], taps: [0, 0, 0, 0, 0], total: 0 };

/** Reads the host message; anything that is not five numbers reads as no reactions. */
export function reactionCounts(m: unknown): ReactionCounts {
  const r = (m ?? {}) as Partial<ReactionCounts>;
  const five = (v: unknown) => (Array.isArray(v) && v.length === 5 && v.every((n) => typeof n === "number") ? (v as number[]) : null);
  const counts = five(r.counts);
  const taps = five(r.taps);
  return counts && taps ? { counts, taps, total: typeof r.total === "number" ? r.total : counts.reduce((a, b) => a + b, 0) } : NO_REACTIONS;
}

/**
 * The reactions to float up the screen: one per new tap since the last update, per reaction, at most {@code cap} in all
 * so a burst never floods the classroom screen.
 */
export function newFloaters(previous: number[], next: number[], cap = 12): number[] {
  const out: number[] = [];
  for (let r = 0; r < 5; r++) {
    const fresh = Math.max(0, (next[r] ?? 0) - (previous[r] ?? 0));
    for (let i = 0; i < fresh && out.length < cap; i++) out.push(r);
  }
  return out;
}
