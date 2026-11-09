/**
 * The question types of Wave 1b (wave1b-contract.md): their limits, the editor's blank question and checks, and the
 * small pure helpers the player, host and assignment screens share (slider steps, how an answer key reads, typed-answer
 * normalising). The server decides every score; these helpers only shape what people see and send.
 */
import { type MediaRef, type SlideVideo, videoProblem } from "./media";

export type QType = "QUIZ" | "TRUE_FALSE" | "MULTI_SELECT" | "POLL" | "TYPE_ANSWER" | "SLIDER" | "PUZZLE" | "CATEGORISE" | "SLIDE"
  | "SCALE" | "WORD_CLOUD" | "OPEN_ENDED" | "PIN_ANSWER" | "DROP_PIN" | "BRAINSTORM";

/** How a player answers, as the game server says in a question's {@code pick}. */
export type Pick = "one" | "many" | "text" | "number" | "order" | "categorise" | "none" | "scale" | "word" | "long" | "point" | "ideas";

export const QTYPES: QType[] = ["QUIZ", "TRUE_FALSE", "MULTI_SELECT", "POLL", "TYPE_ANSWER", "SLIDER", "PUZZLE", "CATEGORISE",
  "SCALE", "WORD_CLOUD", "OPEN_ENDED", "PIN_ANSWER", "DROP_PIN", "BRAINSTORM", "SLIDE"];

/** Wave 2h: answered on an image, which they need. */
export const IMAGE_TYPES: QType[] = ["PIN_ANSWER", "DROP_PIN"];
/** Wave 2h (W30): may uncover their image in five steps over the time limit. */
export const REVEAL_TYPES: QType[] = ["QUIZ", "TYPE_ANSWER"];

/**
 * A question's image (Wave 2h). A stand-in until part 2f's uploads join it: an address (https, or a path on this
 * site) and alt text (W21), with the picture's size so pins and circles keep its proportions.
 */
export interface QuestionImage {
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
}

/** A pin-answer circle: the centre as a share of the image's width and height, the radius as a share of its width. */
export interface PinArea {
  x: number;
  y: number;
  r: number;
}

/** Wave 2e: the class's views, never scored (wave2-contract.md). */
export const OPINION_TYPES: QType[] = ["POLL", "SCALE", "WORD_CLOUD", "OPEN_ENDED", "BRAINSTORM"];
/** Free text that may reach the classroom screen: filtered, and shown only when the teacher says so (W10). */
export const FREE_TEXT_TYPES: QType[] = ["WORD_CLOUD", "OPEN_ENDED"];

export const QTYPE_LABEL: Record<QType, string> = {
  QUIZ: "Multiple choice",
  TRUE_FALSE: "True or false",
  MULTI_SELECT: "Multi-select",
  POLL: "Poll",
  TYPE_ANSWER: "Type answer",
  SLIDER: "Slider",
  PUZZLE: "Puzzle",
  CATEGORISE: "Categorise",
  SLIDE: "Slide",
  SCALE: "Scale",
  WORD_CLOUD: "Word cloud",
  OPEN_ENDED: "Open-ended",
  PIN_ANSWER: "Pin answer",
  DROP_PIN: "Drop pin",
  BRAINSTORM: "Brainstorm",
};

/** One line for the type picker. */
export const QTYPE_HINT: Record<QType, string> = {
  QUIZ: "One right answer out of 2 to 6.",
  TRUE_FALSE: "Is it true or false?",
  MULTI_SELECT: "Players pick every right answer. Partial points.",
  POLL: "Ask for opinions. No right answer, no points.",
  TYPE_ANSWER: "Players type a short answer.",
  SLIDER: "Players pick a number on a scale.",
  PUZZLE: "Players put 3 to 6 items in the right order.",
  CATEGORISE: "Players sort items into 2 to 8 categories. Partial points.",
  SLIDE: "A screen of information between questions. No answers.",
  SCALE: "Players rate from 0 or 1 up to 10. No points.",
  WORD_CLOUD: "Players send one word or short phrase. Shown as a cloud when you're ready. No points.",
  OPEN_ENDED: "Players write up to 250 characters. You choose what the class sees. No points.",
  PIN_ANSWER: "Players tap the right place on an image. Right inside any of up to 3 circles.",
  DROP_PIN: "Players drop a pin anywhere on an image; every pin shows afterwards. No points.",
  BRAINSTORM: "Players send up to 3 ideas, then vote for others' ideas. The top 3 show. No points.",
};

export const LIMITS = {
  question: 120,
  answer: 75,
  explanation: 160,
  minChoices: 2,
  maxChoices: 6,
  minAccept: 1,
  maxAccept: 10,
  accept: 20,
  minItems: 3,
  maxItems: 6,
  item: 30,
  slideTitle: 120,
  slideText: 300,
  unit: 10,
  maxSteps: 1000,
  typed: 20,
  minCategories: 2,
  maxCategories: 8,
  categoryLabel: 30,
  minCatItems: 2,
  maxCatItems: 16,
  /** A worked solution, step by step (Wave 3, W51). */
  solution: 1000,
  catItem: 40,
  scaleMax: 10,
  scaleLabel: 30,
  cloudWord: 20,
  openText: 250,
  alt: 120,
  imageUrl: 1000,
  maxAreas: 3,
  idea: 40,
  maxIdeas: 3,
  maxVotes: 3,
} as const;

/** The slider's settings in the editor; a field is null while it isn't a number yet. */
export interface SliderSettings {
  min: number | null;
  max: number | null;
  step: number | null;
  answer: number | null;
  tol: number | null;
  unit: string;
}

export interface EditorPayload {
  accept?: string[];
  min?: number | null;
  max?: number | null;
  step?: number | null;
  answer?: number | null;
  tol?: number | null;
  unit?: string;
  title?: string;
  /** CATEGORISE: the category labels. */
  categories?: string[];
  /** CATEGORISE: each item's text (items list) and its correct category index (assignments list). */
  catItems?: { text: string; category: number }[];
  /** SCALE: the label at each end (min and max are above). */
  lowLabel?: string;
  highLabel?: string;
  /** Wave 2h: the image (pin answer, drop pin; optional on quiz and type answer), circles, and reveal. */
  image?: QuestionImage | null;
  areas?: PinArea[];
  reveal?: boolean;
  /** Wave 2i: each brainstorm round's time in seconds. */
  ideaSeconds?: number | null;
  voteSeconds?: number | null;
  /** SLIDE: a YouTube clip (part 2g). */
  video?: SlideVideo | null;
}

/** One question in the editor. {@code correctIndexes} is empty until the teacher marks the right answer(s). */
export interface EditorQuestion {
  type: QType;
  text: string;
  timeLimitSeconds: number;
  points: number;
  choices: string[];
  correctIndexes: number[];
  payload: EditorPayload;
  explanation: string | null;
  /** The standard code the question covers (W63), in capitals; empty when none. */
  standard?: string | null;
  /** A worked solution, step by step, shown to players only after they answer (Math and Science); null for none. */
  solution?: string | null;
  /** Read only: what the server sent before 1b; never relied on after {@link fromServer}. */
  correctIndex?: number;
  /** The question's (or slide's) picture, with its description (part 2f). */
  image?: MediaRef | null;
  /** A picture per answer of a quiz, multi-select or poll question, in the answers' order (null where there is none). */
  choiceImages?: (MediaRef | null)[];
}

/** The subjects whose questions get a worked solution (W51). */
export const SOLUTION_SUBJECTS = ["Math", "Science"];

/** Whether the editor offers a worked solution: for scored questions of Math and Science, or one that already has one. */
export function offersSolution(q: { type: QType; solution?: string | null }, subject: string | undefined): boolean {
  return scored(q.type) && (SOLUTION_SUBJECTS.includes(subject ?? "") || !!q.solution);
}

export const CHOICE_TYPES: QType[] = ["QUIZ", "MULTI_SELECT", "POLL"];
export const isChoiceType = (t: QType) => CHOICE_TYPES.includes(t) || t === "TRUE_FALSE";

/** Points are never given for a slide or an opinion question. */
export const scored = (t: QType) => t !== "SLIDE" && t !== "DROP_PIN" && !OPINION_TYPES.includes(t);

export function pickOf(type: QType | string | undefined): Pick {
  switch (type) {
    case "MULTI_SELECT": return "many";
    case "TYPE_ANSWER": return "text";
    case "SLIDER": return "number";
    case "PUZZLE": return "order";
    case "CATEGORISE": return "categorise";
    case "SCALE": return "scale";
    case "WORD_CLOUD": return "word";
    case "OPEN_ENDED": return "long";
    case "PIN_ANSWER":
    case "DROP_PIN": return "point";
    case "BRAINSTORM": return "ideas";
    case "SLIDE": return "none";
    default: return "one";
  }
}

export function blank(type: QType): EditorQuestion {
  const base = { type, text: "", timeLimitSeconds: 20, points: 1, choices: [] as string[], correctIndexes: [] as number[],
    payload: {} as EditorPayload, explanation: null };
  switch (type) {
    case "QUIZ":
    case "MULTI_SELECT":
    case "POLL":
      return { ...base, choices: ["", "", "", ""] };
    case "TRUE_FALSE":
      return { ...base, timeLimitSeconds: 10, choices: ["True", "False"] };
    case "TYPE_ANSWER":
      return { ...base, timeLimitSeconds: 30, payload: { accept: [""] } };
    case "SLIDER":
      return { ...base, payload: { min: 0, max: 10, step: 1, answer: null, tol: 0, unit: "" } };
    case "PUZZLE":
      return { ...base, timeLimitSeconds: 30, choices: ["", "", ""] };
    case "CATEGORISE":
      return { ...base, timeLimitSeconds: 45, payload: { categories: ["", ""], catItems: [{ text: "", category: 0 }, { text: "", category: 0 }] } };
    case "SLIDE":
      return { ...base, payload: { title: "" } };
    case "SCALE":
      return { ...base, payload: { min: 1, max: 5, lowLabel: "", highLabel: "" } };
    case "WORD_CLOUD":
      return { ...base, timeLimitSeconds: 30 };
    case "OPEN_ENDED":
      return { ...base, timeLimitSeconds: 60 };
    case "PIN_ANSWER":
      return { ...base, timeLimitSeconds: 30, payload: { image: null, areas: [] } };
    case "DROP_PIN":
      return { ...base, timeLimitSeconds: 30, payload: { image: null } };
    case "BRAINSTORM":
      return { ...base, payload: { ideaSeconds: 120, voteSeconds: 30 } };
  }
}

function asType(t: unknown): QType {
  return QTYPES.includes(t as QType) ? (t as QType) : "QUIZ";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** A picture as the API sends it, or null when there is none. */
function mediaOf(v: unknown): MediaRef | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  if (typeof m.mediaId !== "string") return null;
  return { mediaId: m.mediaId, alt: typeof m.alt === "string" ? m.alt : "", url: typeof m.url === "string" ? m.url : null,
    width: num(m.width), height: num(m.height) };
}

/** The YouTube clip of a slide as the API stores it ({id, start, end}). */
function videoOf(v: unknown): SlideVideo | null {
  if (!v || typeof v !== "object") return null;
  const m = v as Record<string, unknown>;
  return typeof m.id === "string" ? { id: m.id, start: num(m.start) ?? 0, end: num(m.end) } : null;
}

/** A question as the editor API sends it, made whole: the old single {@code correctIndex} is read when the list is missing. */
export function fromServer(raw: Record<string, unknown>): EditorQuestion {
  const type = asType(raw.type);
  const choices = Array.isArray(raw.choices) ? (raw.choices as unknown[]).map(String) : [];
  const old = typeof raw.correctIndex === "number" ? raw.correctIndex : -1;
  const correctIndexes = Array.isArray(raw.correctIndexes)
    ? (raw.correctIndexes as unknown[]).filter((i): i is number => typeof i === "number")
    : old >= 0 ? [old] : [];
  const p = (raw.payload && typeof raw.payload === "object" ? raw.payload : {}) as Record<string, unknown>;
  const payload: EditorPayload = {};
  if (type === "TYPE_ANSWER") payload.accept = Array.isArray(p.accept) && p.accept.length ? (p.accept as unknown[]).map(String) : [""];
  if (type === "SLIDER") {
    Object.assign(payload, { min: num(p.min), max: num(p.max), step: num(p.step), answer: num(p.answer), tol: num(p.tol),
      unit: typeof p.unit === "string" ? p.unit : "" });
  }
  const img = p.image && typeof p.image === "object" ? p.image as Record<string, unknown> : null;
  if (IMAGE_TYPES.includes(type) || (REVEAL_TYPES.includes(type) && img)) {
    payload.image = img ? { url: String(img.url ?? ""), alt: String(img.alt ?? ""), width: num(img.width) ?? undefined,
      height: num(img.height) ?? undefined } : null;
    if (type === "PIN_ANSWER") {
      payload.areas = Array.isArray(p.areas) ? (p.areas as Record<string, unknown>[])
        .map((a) => ({ x: num(a.x) ?? 0.5, y: num(a.y) ?? 0.5, r: num(a.r) ?? 0.1 })) : [];
    }
    if (REVEAL_TYPES.includes(type)) payload.reveal = p.reveal === true;
  }
  if (type === "BRAINSTORM") Object.assign(payload, { ideaSeconds: num(p.ideaSeconds) ?? 120, voteSeconds: num(p.voteSeconds) ?? 30 });
  if (type === "SCALE") {
    Object.assign(payload, { min: num(p.min), max: num(p.max), lowLabel: typeof p.lowLabel === "string" ? p.lowLabel : "",
      highLabel: typeof p.highLabel === "string" ? p.highLabel : "" });
  }
  if (type === "CATEGORISE") {
    // The API's shape (wave1c-contract.md): categoryLabels, items, and correctCategory from item index to category.
    payload.categories = Array.isArray(p.categoryLabels) ? (p.categoryLabels as unknown[]).map(String) : ["", ""];
    const key = (p.correctCategory && typeof p.correctCategory === "object" ? p.correctCategory : {}) as Record<string, unknown>;
    payload.catItems = Array.isArray(p.items)
      ? (p.items as unknown[]).map((text, i) => ({
          text: String(text),
          category: typeof key[String(i)] === "number" ? (key[String(i)] as number) : 0,
        }))
      : [{ text: "", category: 0 }, { text: "", category: 0 }];
  }
  if (type === "SLIDE") {
    payload.title = typeof p.title === "string" ? p.title : "";
    payload.video = videoOf(p.video);
  }
  const image = mediaOf(raw.image);
  const pictures = Array.isArray(raw.choiceImages) ? (raw.choiceImages as unknown[]).map(mediaOf) : [];
  return {
    type,
    text: String(raw.text ?? ""),
    timeLimitSeconds: typeof raw.timeLimitSeconds === "number" ? raw.timeLimitSeconds : 20,
    points: typeof raw.points === "number" ? raw.points : 1,
    choices: type === "TRUE_FALSE" ? ["True", "False"] : choices,
    correctIndexes: type === "POLL" || type === "PUZZLE" || type === "CATEGORISE" ? [] : correctIndexes,
    payload,
    explanation: typeof raw.explanation === "string" ? raw.explanation : null,
    image,
    choiceImages: CHOICE_TYPES.includes(type) && pictures.some(Boolean)
      ? choices.map((_, i) => pictures[i] ?? null) : [],
    standard: typeof raw.standard === "string" && raw.standard ? raw.standard : null,
    solution: typeof raw.solution === "string" && raw.solution.trim() ? raw.solution : null,
  };
}

/**
 * Switches a question to another type, keeping what still fits: the text and explanation always, and the answers
 * between the choice types (a quiz keeps only its first right answer; a poll has none).
 */
export function changeType(q: EditorQuestion, type: QType): EditorQuestion {
  if (q.type === type) return q;
  const next: EditorQuestion = { ...blank(type), text: q.text, explanation: q.explanation, points: q.points, image: q.image ?? null,
    standard: q.standard ?? null, solution: scored(type) ? q.solution ?? null : null };
  if (CHOICE_TYPES.includes(q.type) && CHOICE_TYPES.includes(type)) {
    next.choices = [...q.choices];
    next.choiceImages = [...(q.choiceImages ?? [])];
    next.correctIndexes = type === "POLL" ? [] : type === "QUIZ" ? q.correctIndexes.slice(0, 1) : [...q.correctIndexes];
  }
  if (type === "SLIDE") next.text = q.text.slice(0, LIMITS.slideText);
  if (q.type === "SLIDE") next.text = q.text.slice(0, LIMITS.question);
  return next;
}

/** A picture with its description: only such a picture is sent (the API refuses one without). */
function described(m: MediaRef | null | undefined): m is MediaRef {
  return !!m && m.alt.trim() !== "";
}

/** What is sent to the editor API: empty optional answers and items dropped, the right answers re-numbered. */
export function toServer(q: EditorQuestion) {
  let choices = q.choices;
  let correctIndexes = [...q.correctIndexes].sort((a, b) => a - b);
  let choiceImages: ({ mediaId: string; alt: string } | null)[] = [];
  if (CHOICE_TYPES.includes(q.type) || q.type === "PUZZLE") {
    const min = q.type === "PUZZLE" ? LIMITS.minItems : LIMITS.minChoices;
    // A picture still waiting for its description stays in the editor and is not sent yet (a draft saves without it).
    const pictured = (i: number) => CHOICE_TYPES.includes(q.type) && described(q.choiceImages?.[i]);
    // An answer that is only a picture is kept even with no text.
    const keep = q.choices.map((c, i) => i < min || c.trim() !== "" || correctIndexes.includes(i) || pictured(i));
    choices = q.choices.filter((_, i) => keep[i]);
    correctIndexes = correctIndexes.filter((i) => keep[i]).map((i) => keep.slice(0, i).filter(Boolean).length);
    if (CHOICE_TYPES.includes(q.type)) {
      const kept = q.choices.map((_, i) => (described(q.choiceImages?.[i]) ? q.choiceImages![i] : null)).filter((_, i) => keep[i]);
      choiceImages = kept.some(Boolean) ? kept.map((m) => (m ? { mediaId: m.mediaId, alt: m.alt.trim() } : null)) : [];
    }
  }
  let payload: Record<string, unknown> = {};
  switch (q.type) {
    case "TYPE_ANSWER":
      choices = [];
      correctIndexes = [];
      payload = { accept: (q.payload.accept ?? []).map((a) => a.trim()).filter((a) => a !== "") };
      break;
    case "SLIDER": {
      const p = q.payload;
      choices = [];
      correctIndexes = [];
      payload = { min: p.min ?? null, max: p.max ?? null, step: p.step ?? null, answer: p.answer ?? null, tol: p.tol ?? 0,
        unit: (p.unit ?? "").trim() };
      break;
    }
    case "SLIDE":
      choices = [];
      correctIndexes = [];
      payload = { title: (q.payload.title ?? "").trim() };
      {
        // A pasted link goes up as it is: the server keeps only the YouTube id and the times.
        const v = q.payload.video;
        if (v && (v.url?.trim() || v.id)) payload.video = v.url?.trim() ? { url: v.url.trim(), start: v.start, end: v.end } : { id: v.id, start: v.start, end: v.end };
      }
      break;
    case "CATEGORISE": {
      const cp = q.payload;
      choices = [];
      correctIndexes = [];
      const labels = (cp.categories ?? []).map((c) => c.trim());
      const items = (cp.catItems ?? []).filter((it) => it.text.trim());
      const correctCategory: Record<string, number> = {};
      items.forEach((it, i) => {
        if (it.category >= 0 && it.category < labels.length) correctCategory[String(i)] = it.category;
      });
      payload = { categoryLabels: labels, items: items.map((it) => it.text.trim()), correctCategory };
      break;
    }
    case "SCALE":
      choices = [];
      correctIndexes = [];
      payload = { min: q.payload.min ?? null, max: q.payload.max ?? null, lowLabel: (q.payload.lowLabel ?? "").trim(),
        highLabel: (q.payload.highLabel ?? "").trim() };
      break;
    case "WORD_CLOUD":
    case "OPEN_ENDED":
      choices = [];
      correctIndexes = [];
      break;
    case "BRAINSTORM":
      choices = [];
      correctIndexes = [];
      payload = { ideaSeconds: q.payload.ideaSeconds ?? 120, voteSeconds: q.payload.voteSeconds ?? 30 };
      break;
    case "PIN_ANSWER":
    case "DROP_PIN":
      choices = [];
      correctIndexes = [];
      payload = { image: imageOut(q.payload.image) };
      if (q.type === "PIN_ANSWER") payload.areas = (q.payload.areas ?? []).map(roundArea);
      break;
    case "POLL":
    case "PUZZLE":
      correctIndexes = [];
      break;
    case "TRUE_FALSE":
      choices = ["True", "False"];
      break;
  }
  if (REVEAL_TYPES.includes(q.type) && q.payload.image && q.payload.image.url.trim()) {
    payload = { ...payload, image: imageOut(q.payload.image), reveal: q.payload.reveal === true };
  }
  return {
    type: q.type,
    text: q.text,
    timeLimitSeconds: q.timeLimitSeconds,
    points: q.points,
    choices,
    correctIndexes,
    // Kept for a server that still reads one right answer: the same as correctIndexes[0] for quiz and true/false.
    correctIndex: q.type === "QUIZ" || q.type === "TRUE_FALSE" ? correctIndexes[0] ?? -1 : -1,
    payload,
    explanation: q.explanation,
    image: described(q.image) ? { mediaId: q.image!.mediaId, alt: q.image!.alt.trim() } : null,
    choiceImages,
    standard: standardCode(q.standard),
    solution: scored(q.type) && q.solution && q.solution.trim() ? q.solution.trim() : null,
  };
}

/** Decimal places a step needs: 0.25 → 2, 5 → 0. */
export function decimalsOf(step: number): number {
  if (!Number.isFinite(step) || step >= 1 && Number.isInteger(step)) return 0;
  const s = String(step);
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  return (s.split(".")[1] ?? "").length;
}

const EPS = 1e-9;

/** How many steps the slider has from min to max, or null when it doesn't divide evenly. */
export function stepCount(min: number, max: number, step: number): number | null {
  const n = (max - min) / step;
  const r = Math.round(n);
  return Math.abs(n - r) < 1e-6 ? r : null;
}

export function onStep(value: number, min: number, step: number): boolean {
  const n = (value - min) / step;
  return Math.abs(n - Math.round(n)) < 1e-6;
}

/** The nearest value on a step within [min, max], rounded to the step's decimals so 0.1 + 0.2 stays 0.3. */
export function snap(value: number, s: { min: number; max: number; step: number }): number {
  const k = Math.round((value - s.min) / s.step);
  const v = Math.min(s.max, Math.max(s.min, s.min + k * s.step));
  return Number(v.toFixed(decimalsOf(s.step)));
}

/** Where a slider starts: the step nearest the middle. */
export function sliderStart(s: { min: number; max: number; step: number }): number {
  return snap((s.min + s.max) / 2, s);
}

/** A number in the slider's own precision, with the unit when there is one: "7.5 m". */
export function formatNumber(value: number, step: number, unit = ""): string {
  const d = decimalsOf(step);
  const text = value.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  return unit ? text + " " + unit : text;
}

/**
 * A typed answer as the server compares it: NFKC, lower case, trimmed, trailing . , ! ? ; : removed, and inner runs of
 * white space made one space.
 */
export function normaliseTyped(text: string): string {
  return text.normalize("NFKC").toLowerCase().trim().replace(/[.,!?;:]+$/u, "").trim().replace(/\s+/gu, " ");
}

function sameAfterTrim(list: string[], pictures: ({ mediaId: string } | null | undefined)[] = []): boolean {
  return new Set(list.map((c, i) => c.trim() + (pictures[i] ? "|" + pictures[i]!.mediaId : ""))).size !== list.length;
}

/** The picture's description is required (part 2f, W21): screen readers and read-aloud need it. */
function pictureProblem(image: MediaRef | null | undefined, name: string): string | null {
  if (image && !image.alt.trim()) return "Describe " + name + " in a few words, for people who can't see it.";
  return null;
}

/** What still stops a question from being published, in plain words; null when it is ready. Mirrors the server's rules. */
export function missing(raw: EditorQuestion): string | null {
  const wire = toServer(raw);
  const q = { ...raw, choices: wire.choices, correctIndexes: wire.correctIndexes };
  const pictures = wire.choiceImages;
  const pictureIssue = pictureProblem(raw.image, q.type === "SLIDE" ? "the slide's picture" : "the question's picture");
  if (q.type === "SLIDE") {
    const title = (raw.payload.title ?? "").trim();
    if (!title) return "Give the slide a title.";
    if (title.length > LIMITS.slideTitle) return `Shorten the title to ${LIMITS.slideTitle} characters or fewer.`;
    if (q.text.length > LIMITS.slideText) return `Shorten the slide's text to ${LIMITS.slideText} characters or fewer.`;
    return pictureIssue ?? videoProblem(raw.payload.video);
  }
  if (!q.text.trim()) return "Write the question.";
  if (pictureIssue) return pictureIssue;
  if (q.text.length > LIMITS.question) return `Shorten the question to ${LIMITS.question} characters or fewer.`;

  if (REVEAL_TYPES.includes(q.type) && (raw.payload.reveal || raw.payload.image?.url.trim())) {
    const problem = imageProblem(raw.payload.image);
    if (problem) return problem;
  }

  if (CHOICE_TYPES.includes(q.type)) {
    const undescribed = (raw.choiceImages ?? []).findIndex((m) => m && !m.alt.trim());
    if (undescribed >= 0) return "Describe answer " + (undescribed + 1) + "'s picture in a few words, for people who can't see it.";
    if (q.choices.filter((c, i) => c.trim() || pictures[i]).length < LIMITS.minChoices) return "Write at least two answers.";
    if (q.choices.length > LIMITS.maxChoices) return "A question can have at most six answers. Remove one.";
    if (q.choices.some((c, i) => !c.trim() && !pictures[i])) return "Fill in or remove the empty answer, or give it a picture.";
    if (q.choices.some((c) => c.length > LIMITS.answer)) return `Shorten each answer to ${LIMITS.answer} characters or fewer.`;
    if (sameAfterTrim(q.choices, pictures)) return "Make every answer different.";
    if (q.type === "QUIZ" && q.correctIndexes.length !== 1) return "Mark the correct answer.";
    if (q.type === "MULTI_SELECT") {
      if (q.correctIndexes.length < 1) return "Mark at least one correct answer.";
      if (q.correctIndexes.length >= q.choices.length) {
        return "Leave at least one answer unmarked: when every answer is correct, there is nothing to choose.";
      }
    }
    return null;
  }
  if (q.type === "TRUE_FALSE") return q.correctIndexes.length === 1 ? null : "Mark the correct answer.";

  if (q.type === "TYPE_ANSWER") {
    const all = (raw.payload.accept ?? []).map((a) => a.trim());
    const accept = all.filter((a) => a !== "");
    if (accept.length < LIMITS.minAccept) return "Add at least one accepted answer.";
    if (all.length > accept.length) return "Fill in or remove the empty accepted answer.";
    if (accept.length > LIMITS.maxAccept) return "A question can accept at most " + LIMITS.maxAccept + " answers. Remove one.";
    if (accept.some((a) => a.length > LIMITS.accept)) return `Shorten each accepted answer to ${LIMITS.accept} characters or fewer.`;
    if (new Set(accept.map(normaliseTyped)).size !== accept.length) {
      return "Two accepted answers are the same once capitals and end punctuation are ignored. Remove one.";
    }
    return null;
  }

  if (q.type === "SLIDER") {
    const { min, max, step, answer, tol, unit = "" } = raw.payload;
    if (min == null || max == null) return "Enter the slider's lowest and highest values.";
    if (step == null) return "Enter the slider's step.";
    if (answer == null) return "Enter the right answer.";
    if (tol == null) return "Enter the tolerance (0 for an exact answer).";
    if (!(min < max)) return "Make the highest value bigger than the lowest.";
    if (!(step > 0)) return "Make the step bigger than 0.";
    const steps = stepCount(min, max, step);
    if (steps === null) return "The step must divide the range evenly, from the lowest value to the highest.";
    if (steps > LIMITS.maxSteps) {
      return `That makes ${steps.toLocaleString()} steps; a slider allows at most 1,000. Use a bigger step or a smaller range.`;
    }
    if (answer < min - EPS || answer > max + EPS) return "Put the right answer between the lowest and highest values.";
    if (!onStep(answer, min, step)) return `Put the right answer on a step: from ${min}, in steps of ${step}.`;
    if (tol < 0 || tol > max - min + EPS) return `Make the tolerance between 0 and ${Number((max - min).toFixed(6))}.`;
    if (unit.trim().length > LIMITS.unit) return `Shorten the unit to ${LIMITS.unit} characters or fewer.`;
    return null;
  }

  if (q.type === "PUZZLE") {
    if (q.choices.filter((c) => c.trim()).length < LIMITS.minItems) return "Write at least three items to put in order.";
    if (q.choices.length > LIMITS.maxItems) return "A puzzle can have at most six items. Remove one.";
    if (q.choices.some((c) => !c.trim())) return "Fill in or remove the empty item.";
    if (q.choices.some((c) => c.trim().length > LIMITS.item)) return `Shorten each item to ${LIMITS.item} characters or fewer.`;
    if (sameAfterTrim(q.choices)) return "Make every item different.";
    return null;
  }

  if (q.type === "SCALE") {
    const { min, max, lowLabel = "", highLabel = "" } = raw.payload;
    if (min !== 0 && min !== 1) return "Start the scale at 0 or 1.";
    if (max == null || !Number.isInteger(max) || max <= min || max > LIMITS.scaleMax) return "End the scale at a whole number above its start, up to 10.";
    if (!lowLabel.trim() || !highLabel.trim()) return "Label both ends of the scale.";
    if (lowLabel.trim().length > LIMITS.scaleLabel || highLabel.trim().length > LIMITS.scaleLabel) {
      return `Shorten each end label to ${LIMITS.scaleLabel} characters or fewer.`;
    }
    return null;
  }
  if (q.type === "WORD_CLOUD" || q.type === "OPEN_ENDED") return null;
  if (q.type === "BRAINSTORM") {
    const { ideaSeconds, voteSeconds } = raw.payload;
    if (ideaSeconds == null || ideaSeconds < 30 || ideaSeconds > 240) return "The ideas round lasts 30 seconds to 4 minutes.";
    if (voteSeconds == null || voteSeconds < 15 || voteSeconds > 120) return "The votes round lasts 15 seconds to 2 minutes.";
    return null;
  }
  if (IMAGE_TYPES.includes(q.type)) {
    const problem = imageProblem(raw.payload.image);
    if (problem) return problem;
    if (q.type === "PIN_ANSWER") {
      const areas = raw.payload.areas ?? [];
      if (areas.length === 0) return "Mark the right area on the image.";
      if (areas.length > LIMITS.maxAreas) return "Mark up to 3 right areas.";
    }
    return null;
  }

  if (q.type === "CATEGORISE") {
    const cats = raw.payload.categories ?? [];
    const items = raw.payload.catItems ?? [];
    const filledCats = cats.filter((c) => c.trim());
    if (filledCats.length < LIMITS.minCategories) return "Add at least two categories.";
    if (cats.length > LIMITS.maxCategories) return `A question can have at most ${LIMITS.maxCategories} categories. Remove one.`;
    if (cats.some((c) => !c.trim())) return "Fill in or remove the empty category.";
    if (cats.some((c) => c.trim().length > LIMITS.categoryLabel)) return `Shorten each category to ${LIMITS.categoryLabel} characters or fewer.`;
    if (sameAfterTrim(cats)) return "Make every category different.";
    const filledItems = items.filter((it) => it.text.trim());
    if (filledItems.length < LIMITS.minCatItems) return "Add at least two items to sort.";
    if (items.length > LIMITS.maxCatItems) return `A question can have at most ${LIMITS.maxCatItems} items. Remove one.`;
    if (items.some((it) => !it.text.trim())) return "Fill in or remove the empty item.";
    if (items.some((it) => it.text.trim().length > LIMITS.catItem)) return `Shorten each item to ${LIMITS.catItem} characters or fewer.`;
    if (sameAfterTrim(items.map((it) => it.text))) return "Make every item different.";
    if (filledItems.some((it) => it.category < 0 || it.category >= cats.length)) return "Assign every item to a category.";
    return null;
  }
  return null;
}

/** The answer key of a closed question, as the server sends it in {@code key}. */
export interface AnswerKey {
  accept?: string[];
  answer?: number;
  tol?: number;
  unit?: string;
  order?: string[];
  categories?: string[];
  catItems?: { text: string; category: number }[];
}

/** The right answer in words, for the player's result and the host's results: "7.5 m (± 0.5)", "Seed → Sprout → Tree". */
export function keyText(qtype: QType | string, key: AnswerKey | null | undefined, choices: string[], correctIndexes: number[],
                        step = 1): string | null {
  switch (qtype) {
    case "POLL":
    case "SLIDE":
      return null;
    case "TYPE_ANSWER":
      return key?.accept?.length ? key.accept.join(" or ") : null;
    case "SLIDER": {
      if (key?.answer === undefined || key.answer === null) return null;
      const tol = key.tol ?? 0;
      const text = formatNumber(key.answer, step, key.unit ?? "");
      return tol > 0 ? `${text} (± ${formatNumber(tol, step)})` : text;
    }
    case "PUZZLE":
      return key?.order?.length ? key.order.join(" → ") : null;
    case "CATEGORISE":
      if (!key?.categories?.length || !key?.catItems?.length) return null;
      return key.categories.map((cat, ci) => {
        const items = key.catItems!.filter((it) => it.category === ci).map((it) => it.text);
        return cat + ": " + (items.length ? items.join(", ") : "—");
      }).join(" · ");
    default: {
      const picked = correctIndexes.filter((i) => i >= 0 && i < choices.length).map((i) => choices[i]);
      return picked.length ? picked.join(", ") : null;
    }
  }
}

/** A share in whole percent, 0 when there is nothing to share. */
export function percent(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

/** Where a value sits on a slider's scale, from 0 to 100, for drawing the spread. */
export function position(value: number, min: number, max: number): number {
  if (!(max > min)) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/** Adds or removes one choice in a multi-select answer, keeping the list in order. */
export function toggle(picked: number[], i: number): number[] {
  return picked.includes(i) ? picked.filter((p) => p !== i) : [...picked, i].sort((a, b) => a - b);
}

/** A player's own result, read for its kind: right, partly right (some points), wrong, no answer, or a poll vote. */
export type Outcome = "correct" | "partial" | "wrong" | "none" | "vote";

export function outcomeOf(r: { answered: boolean; correct: boolean; fraction?: number; counted?: boolean; points?: number }): Outcome {
  if (r.counted === false) return r.answered ? "vote" : "none";
  if (!r.answered) return "none";
  if (r.correct) return "correct";
  const fraction = r.fraction ?? 0;
  return fraction > 0 ? "partial" : "wrong";
}

/** A question's image as sent to the server: the address and alt text trimmed, the size kept when known. */
function imageOut(img: QuestionImage | null | undefined) {
  if (!img) return null;
  return { url: img.url.trim(), alt: img.alt.trim(), ...(img.width ? { width: img.width } : {}), ...(img.height ? { height: img.height } : {}) };
}

function roundArea(a: PinArea): PinArea {
  const r4 = (v: number) => Math.round(v * 10000) / 10000;
  return { x: r4(a.x), y: r4(a.y), r: r4(a.r) };
}

/** What is missing from a question's image (an address that is https or on this site, and alt text); null when fine. */
export function imageProblem(img: QuestionImage | null | undefined): string | null {
  if (!img || !img.url.trim()) return "Add an image.";
  const url = img.url.trim();
  if (!(url.startsWith("https://") || (url.startsWith("/") && !url.startsWith("//")))) {
    return "Use a secure image address (https) or one from this site.";
  }
  if (!img.alt.trim()) return "Describe the image for people who can't see it (alt text).";
  if (img.alt.trim().length > LIMITS.alt) return `Shorten the image description to ${LIMITS.alt} characters or fewer.`;
  return null;
}

/** Is the point inside the circle, judged in the image's proportions (as the server judges it, W28)? */
export function insideArea(p: { x: number; y: number }, a: PinArea, aspect: number): boolean {
  const dx = p.x - a.x;
  const dy = (p.y - a.y) / aspect;
  return dx * dx + dy * dy <= a.r * a.r + 1e-9;
}

/** Image reveal (W30): how many of the five tiles are uncovered at {@code now}, timed from when the question opened. */
export function revealStep(openedAt: number, closesAt: number, now: number): number {
  if (!(closesAt > openedAt)) return 5;
  const share = (now - openedAt) / (closesAt - openedAt);
  return Math.max(1, Math.min(5, Math.floor(share * 5) + 1));
}

/** The longest standard code the API takes (W63). */
export const STANDARD_MAX = 30;

/** A standard code as it is sent: trimmed, in capitals, null when empty. The API refuses anything but letters, digits, dots and dashes. */
export function standardCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return code === "" ? null : code;
}

/** True when a code is empty or 2 to 30 letters, digits, dots and dashes (what the API accepts). */
export function standardOk(raw: string | null | undefined): boolean {
  const code = standardCode(raw);
  return code === null || /^[A-Z0-9][A-Z0-9.-]{1,29}$/.test(code);
}
