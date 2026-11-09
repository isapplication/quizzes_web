/**
 * Pictures and video on questions, answers and slides (wave2-plan.md parts 2f and 2g). A picture is uploaded once
 * ({@code POST /api/v1/media}) and then only its id and description are kept on a question; screens get a signed address
 * and the picture's size. A slide's video is a YouTube clip, shown through youtube-nocookie.com, and never plays by itself.
 */
import { api } from "./api";

/** A picture as the Quiz API sends it: {@code url}, {@code width} and {@code height} are missing while it is only stored. */
export interface MediaRef {
  mediaId: string;
  /** A description for screen readers and read-aloud (required, up to 120 characters). */
  alt: string;
  url?: string | null;
  width?: number | null;
  height?: number | null;
}

/** What the game server and the assignment page send with a question: the address is always there. */
export interface ShownPicture {
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
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

/** Only pictures that have an address can be shown. */
export function shown(ref: MediaRef | ShownPicture | null | undefined): ShownPicture | null {
  if (!ref || !ref.url) return null;
  return { url: ref.url, alt: ref.alt, width: ref.width, height: ref.height };
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
