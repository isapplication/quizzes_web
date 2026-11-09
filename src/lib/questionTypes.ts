/**
 * The question types of Wave 1b (wave1b-contract.md): their limits, the editor's blank question and checks, and the
 * small pure helpers the player, host and assignment screens share (slider steps, how an answer key reads, typed-answer
 * normalising). The server decides every score; these helpers only shape what people see and send.
 */

export type QType = "QUIZ" | "TRUE_FALSE" | "MULTI_SELECT" | "POLL" | "TYPE_ANSWER" | "SLIDER" | "PUZZLE" | "CATEGORISE" | "SLIDE";

/** How a player answers, as the game server says in a question's {@code pick}. */
export type Pick = "one" | "many" | "text" | "number" | "order" | "categorise" | "none";

export const QTYPES: QType[] = ["QUIZ", "TRUE_FALSE", "MULTI_SELECT", "POLL", "TYPE_ANSWER", "SLIDER", "PUZZLE", "CATEGORISE", "SLIDE"];

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
  /** A worked solution, step by step, shown to players only after they answer (Math and Science); null for none. */
  solution?: string | null;
  /** Read only: what the server sent before 1b; never relied on after {@link fromServer}. */
  correctIndex?: number;
}

/** The subjects whose questions get a worked solution (W51). */
export const SOLUTION_SUBJECTS = ["Math", "Science"];

/** Whether the editor offers a worked solution: for scored questions of Math and Science, or one that already has one. */
export function offersSolution(q: { type: QType; solution?: string | null }, subject: string | undefined): boolean {
  return scored(q.type) && (SOLUTION_SUBJECTS.includes(subject ?? "") || !!q.solution);
}

export const CHOICE_TYPES: QType[] = ["QUIZ", "MULTI_SELECT", "POLL"];
export const isChoiceType = (t: QType) => CHOICE_TYPES.includes(t) || t === "TRUE_FALSE";

/** Points are never given for a poll or a slide. */
export const scored = (t: QType) => t !== "POLL" && t !== "SLIDE";

export function pickOf(type: QType | string | undefined): Pick {
  switch (type) {
    case "MULTI_SELECT": return "many";
    case "TYPE_ANSWER": return "text";
    case "SLIDER": return "number";
    case "PUZZLE": return "order";
    case "CATEGORISE": return "categorise";
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
  }
}

function asType(t: unknown): QType {
  return QTYPES.includes(t as QType) ? (t as QType) : "QUIZ";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
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
  if (type === "SLIDE") payload.title = typeof p.title === "string" ? p.title : "";
  return {
    type,
    text: String(raw.text ?? ""),
    timeLimitSeconds: typeof raw.timeLimitSeconds === "number" ? raw.timeLimitSeconds : 20,
    points: typeof raw.points === "number" ? raw.points : 1,
    choices: type === "TRUE_FALSE" ? ["True", "False"] : choices,
    correctIndexes: type === "POLL" || type === "PUZZLE" || type === "CATEGORISE" ? [] : correctIndexes,
    payload,
    explanation: typeof raw.explanation === "string" ? raw.explanation : null,
    solution: typeof raw.solution === "string" && raw.solution.trim() ? raw.solution : null,
  };
}

/**
 * Switches a question to another type, keeping what still fits: the text and explanation always, and the answers
 * between the choice types (a quiz keeps only its first right answer; a poll has none).
 */
export function changeType(q: EditorQuestion, type: QType): EditorQuestion {
  if (q.type === type) return q;
  const next: EditorQuestion = { ...blank(type), text: q.text, explanation: q.explanation, points: q.points,
    solution: scored(type) ? q.solution ?? null : null };
  if (CHOICE_TYPES.includes(q.type) && CHOICE_TYPES.includes(type)) {
    next.choices = [...q.choices];
    next.correctIndexes = type === "POLL" ? [] : type === "QUIZ" ? q.correctIndexes.slice(0, 1) : [...q.correctIndexes];
  }
  if (type === "SLIDE") next.text = q.text.slice(0, LIMITS.slideText);
  if (q.type === "SLIDE") next.text = q.text.slice(0, LIMITS.question);
  return next;
}

/** What is sent to the editor API: empty optional answers and items dropped, the right answers re-numbered. */
export function toServer(q: EditorQuestion) {
  let choices = q.choices;
  let correctIndexes = [...q.correctIndexes].sort((a, b) => a - b);
  if (CHOICE_TYPES.includes(q.type) || q.type === "PUZZLE") {
    const min = q.type === "PUZZLE" ? LIMITS.minItems : LIMITS.minChoices;
    const keep = q.choices.map((c, i) => i < min || c.trim() !== "" || correctIndexes.includes(i));
    choices = q.choices.filter((_, i) => keep[i]);
    correctIndexes = correctIndexes.filter((i) => keep[i]).map((i) => keep.slice(0, i).filter(Boolean).length);
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
    case "POLL":
    case "PUZZLE":
      correctIndexes = [];
      break;
    case "TRUE_FALSE":
      choices = ["True", "False"];
      break;
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

function sameAfterTrim(list: string[]): boolean {
  return new Set(list.map((c) => c.trim())).size !== list.length;
}

/** What still stops a question from being published, in plain words; null when it is ready. Mirrors the server's rules. */
export function missing(raw: EditorQuestion): string | null {
  const wire = toServer(raw);
  const q = { ...raw, choices: wire.choices, correctIndexes: wire.correctIndexes };
  if (q.type === "SLIDE") {
    const title = (raw.payload.title ?? "").trim();
    if (!title) return "Give the slide a title.";
    if (title.length > LIMITS.slideTitle) return `Shorten the title to ${LIMITS.slideTitle} characters or fewer.`;
    if (q.text.length > LIMITS.slideText) return `Shorten the slide's text to ${LIMITS.slideText} characters or fewer.`;
    return null;
  }
  if (!q.text.trim()) return "Write the question.";
  if (q.text.length > LIMITS.question) return `Shorten the question to ${LIMITS.question} characters or fewer.`;

  if (CHOICE_TYPES.includes(q.type)) {
    if (q.choices.filter((c) => c.trim()).length < LIMITS.minChoices) return "Write at least two answers.";
    if (q.choices.length > LIMITS.maxChoices) return "A question can have at most six answers. Remove one.";
    if (q.choices.some((c) => !c.trim())) return "Fill in or remove the empty answer.";
    if (q.choices.some((c) => c.length > LIMITS.answer)) return `Shorten each answer to ${LIMITS.answer} characters or fewer.`;
    if (sameAfterTrim(q.choices)) return "Make every answer different.";
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
