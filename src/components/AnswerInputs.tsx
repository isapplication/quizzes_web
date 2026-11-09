"use client";

import { useCallback, useId, useRef, useState } from "react";
import { AnswerShape, shapeName, shapeNumber } from "./AnswerShape";
import { GameCheckTile } from "./Stage";
import { Picture } from "./Picture";
import { type ShownPicture, visibleText } from "@/lib/media";
import { formatNumber, LIMITS, sliderStart, snap, toggle } from "@/lib/questionTypes";

/**
 * The answer inputs of the Wave 1b question types, shared by the live player (variant "game", in the game look) and
 * the assignment page (variant "stage"): pick several, type an answer, and a number on a slider. Each is a real form
 * with a submit button, so Enter, a tap and a screen reader all work the same way.
 */
type Variant = "game" | "stage";

const submitClass = (v: Variant) => (v === "game" ? "gl-btn gl-btn-big" : "btn btn-primary activity-check");

/** Multi-select: a checkbox per answer, then Submit. At least one must be ticked. */
export function MultiSelectForm({ choices, onSubmit, busy = false, variant, compact = false, pictures }: {
  choices: string[];
  /** A picture per answer (wave2-plan.md part 2f), null where an answer has none. */
  pictures?: (ShownPicture | null)[];
  onSubmit: (choices: number[]) => void;
  busy?: boolean;
  variant: Variant;
  compact?: boolean;
}) {
  const id = useId();
  const [picked, setPicked] = useState<number[]>([]);
  const set = (i: number) => setPicked((p) => toggle(p, i));
  return (
    <form className={variant === "game" ? "gl-multi" : "activity-panel stack"} aria-describedby={id}
          onSubmit={(e) => { e.preventDefault(); if (picked.length) onSubmit(picked); }}>
      <p id={id} className={variant === "game" ? "gl-sub gl-hint" : "hint"} style={{ margin: 0 }}>
        Pick every right answer, then submit.
      </p>
      {variant === "game" ? (
        <div className="gl-tiles gl-in" data-count={choices.length}>
          {choices.map((c, i) => (
            <GameCheckTile key={i} index={i} text={compact ? "" : c} picture={pictures?.[i]} checked={picked.includes(i)} disabled={busy} onChange={() => set(i)} />
          ))}
        </div>
      ) : (
        <div className="answer-grid">
          {choices.map((c, i) => {
            const n = shapeNumber(i);
            return (
              <label key={i} className={"answer-tile answer-check" + (picked.includes(i) ? " chosen" : "")}
                     style={{ background: `var(--a${n})`, color: `var(--a${n}-text)` }}>
                <input type="checkbox" checked={picked.includes(i)} disabled={busy} onChange={() => set(i)}
                       aria-label={shapeName(i) + ": " + c} />
                <AnswerShape index={i} size={34} color="currentColor" />
                {pictures?.[i] && <Picture picture={pictures[i]} className="answer-picture" />}
                {(!pictures?.[i] || visibleText(c, pictures[i])) && <span className="answer-text">{c}</span>}
              </label>
            );
          })}
        </div>
      )}
      <button type="submit" className={submitClass(variant)} disabled={busy || picked.length === 0}>
        {busy ? "Sending…" : picked.length === 0 ? "Pick at least one" : `Submit ${picked.length} ${picked.length === 1 ? "answer" : "answers"}`}
      </button>
    </form>
  );
}

/** Type answer: up to 20 characters. The form submits on Enter natively, so an IME's confirming Enter doesn't send it. */
export function TypeAnswerForm({ onSubmit, busy = false, variant }: {
  onSubmit: (text: string) => void;
  busy?: boolean;
  variant: Variant;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const ready = text.trim().length > 0;
  return (
    <form className={variant === "game" ? "gl-form gl-card gl-answer-form" : "activity-panel stack"}
          onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(text.trim()); }}>
      <div className={variant === "game" ? "gl-field" : "field"}>
        <label htmlFor={id + "-in"}>Your answer</label>
        <input id={id + "-in"} type="text" value={text} maxLength={LIMITS.typed} autoComplete="off" autoCapitalize="off"
               spellCheck={false} enterKeyHint="send" disabled={busy} aria-describedby={id + "-hint"}
               onChange={(e) => setText(e.target.value)} placeholder="Type your answer" className="typed-answer" />
        <span id={id + "-hint"} className="hint">Up to {LIMITS.typed} characters ({text.length} used). Capital letters don&apos;t matter.</span>
      </div>
      <button type="submit" className={submitClass(variant)} disabled={busy || !ready}>{busy ? "Sending…" : "Submit"}</button>
    </form>
  );
}

export interface SliderShown {
  min: number;
  max: number;
  step: number;
  unit?: string;
}

/** Slider: a native range input with its value shown in words and numbers, the two ends labelled, then Submit. */
export function SliderForm({ slider, onSubmit, busy = false, variant }: {
  slider: SliderShown;
  onSubmit: (value: number) => void;
  busy?: boolean;
  variant: Variant;
}) {
  const id = useId();
  const [value, setValue] = useState(() => sliderStart(slider));
  const unit = slider.unit ?? "";
  const shown = formatNumber(value, slider.step, unit);
  return (
    <form className={variant === "game" ? "gl-form gl-card gl-slider" : "activity-panel stack answer-slider"}
          onSubmit={(e) => { e.preventDefault(); onSubmit(value); }}>
      <label htmlFor={id + "-range"} className="slider-label">Your answer</label>
      <output htmlFor={id + "-range"} className="slider-value" aria-live="off">{shown}</output>
      <input id={id + "-range"} type="range" className="slider-range" min={slider.min} max={slider.max} step={slider.step}
             value={value} disabled={busy} aria-valuetext={shown} aria-describedby={id + "-ends"}
             onChange={(e) => setValue(snap(Number(e.target.value), slider))} />
      <div id={id + "-ends"} className="slider-ends">
        <span><span className="sr-only">From </span>{formatNumber(slider.min, slider.step, unit)}</span>
        <span><span className="sr-only">to </span>{formatNumber(slider.max, slider.step, unit)}</span>
      </div>
      <button type="submit" className={submitClass(variant)} disabled={busy}>{busy ? "Sending…" : "Submit " + shown}</button>
    </form>
  );
}

export interface CategoriseShown {
  categories: string[];
  items: string[];
}

/** Categorise: tap an item, then tap a category to place it. Submit when all items are placed. */
export function CategoriseForm({ data, onSubmit, busy = false, variant }: {
  data: CategoriseShown;
  onSubmit: (categories: Record<number, number>) => void;
  busy?: boolean;
  variant: Variant;
}) {
  const id = useId();
  // placements[itemIndex] = categoryIndex, or -1 if unplaced
  const [placements, setPlacements] = useState<number[]>(() => data.items.map(() => -1));
  const [selected, setSelected] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const dragItem = useRef<number | null>(null);

  const allPlaced = placements.every((p) => p >= 0);

  function place(item: number, cat: number) {
    setPlacements((p) => p.map((v, i) => (i === item ? cat : v)));
    setSaid(data.items[item] + " placed in " + data.categories[cat] + ".");
    setSelected(null);
  }

  function unplace(item: number) {
    setPlacements((p) => p.map((v, i) => (i === item ? -1 : v)));
    setSaid(data.items[item] + " removed.");
  }

  function tapItem(item: number) {
    if (selected === item) { setSelected(null); return; }
    setSelected(item);
  }

  function tapCategory(cat: number) {
    if (selected !== null) { place(selected, cat); return; }
  }

  const onDragStart = useCallback((item: number) => { dragItem.current = item; }, []);
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
  const onDrop = useCallback((cat: number) => {
    if (dragItem.current !== null) { place(dragItem.current, cat); dragItem.current = null; }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    if (!allPlaced) return;
    const result: Record<number, number> = {};
    placements.forEach((cat, item) => { result[item] = cat; });
    onSubmit(result);
  }

  const unplaced = data.items.map((_, i) => i).filter((i) => placements[i] < 0);

  return (
    <form className={variant === "game" ? "gl-form gl-categorise" : "activity-panel stack"}
          onSubmit={(e) => { e.preventDefault(); submit(); }} aria-describedby={id}>
      <p id={id} className={variant === "game" ? "gl-sub gl-hint" : "hint"} style={{ margin: 0 }}>
        Sort each item into the right category, then submit.
      </p>
      <div className="cat-zones">
        {data.categories.map((cat, ci) => {
          const here = data.items.map((_, i) => i).filter((i) => placements[i] === ci);
          return (
            <div key={ci} className={"cat-zone" + (selected !== null ? " cat-zone-target" : "")}
                 role="group" aria-label={cat}
                 onClick={() => tapCategory(ci)}
                 onDragOver={onDragOver} onDrop={() => onDrop(ci)}>
              <div className="cat-zone-label">{cat}</div>
              <div className="cat-zone-items">
                {here.map((item) => (
                  <button key={item} type="button" className="cat-chip placed" onClick={(e) => { e.stopPropagation(); unplace(item); }}
                          aria-label={data.items[item] + " in " + cat + ", tap to remove"}>
                    {data.items[item]}
                  </button>
                ))}
                {here.length === 0 && <span className="cat-zone-empty">Drop items here</span>}
              </div>
            </div>
          );
        })}
      </div>
      {unplaced.length > 0 && (
        <div className="cat-items">
          {unplaced.map((item) => (
            <button key={item} type="button" draggable
                    className={"cat-chip" + (selected === item ? " cat-chip-selected" : "")}
                    onClick={() => tapItem(item)}
                    onDragStart={() => onDragStart(item)}
                    aria-label={data.items[item] + (selected === item ? " (selected, tap a category)" : "")}>
              {data.items[item]}
            </button>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">{said}</p>
      <button type="submit" className={submitClass(variant)} disabled={busy || !allPlaced}>
        {busy ? "Sending…" : allPlaced ? "Submit" : `Place ${unplaced.length} more`}
      </button>
    </form>
  );
}

/** Wave 2e: a scale's ends and labels, as the game server sends them in {@code scale}. */
export interface ScaleShown {
  min: number;
  max: number;
  lowLabel?: string;
  highLabel?: string;
}

/**
 * Scale (W14): a row of numbered buttons in a radio group (arrow keys move, Space picks), with the end labels, then
 * Submit. Radios rather than toggle buttons, so a screen reader says "3 of 5".
 */
export function ScaleForm({ scale, onSubmit, busy = false, variant }: {
  scale: ScaleShown;
  onSubmit: (value: number) => void;
  busy?: boolean;
  variant: Variant;
}) {
  const id = useId();
  const [value, setValue] = useState<number | null>(null);
  const points = Array.from({ length: scale.max - scale.min + 1 }, (_, i) => scale.min + i);
  return (
    <form className={variant === "game" ? "gl-form gl-card gl-scale-form" : "activity-panel stack scale-form"}
          onSubmit={(e) => { e.preventDefault(); if (value !== null) onSubmit(value); }}>
      <fieldset className="scale-points" aria-describedby={id + "-ends"}>
        <legend>Your rating</legend>
        <div className="scale-row">
          {points.map((n) => (
            <label key={n} className={"scale-point" + (value === n ? " is-chosen" : "")}>
              <input type="radio" name={id + "-scale"} value={n} checked={value === n} disabled={busy}
                     onChange={() => setValue(n)} />
              <span>{n}</span>
            </label>
          ))}
        </div>
        <div id={id + "-ends"} className="scale-ends">
          <span>{scale.min}: {scale.lowLabel}</span>
          <span>{scale.max}: {scale.highLabel}</span>
        </div>
      </fieldset>
      <button type="submit" className={submitClass(variant)} disabled={busy || value === null}>
        {busy ? "Sending…" : value === null ? "Pick a number" : "Submit " + value}
      </button>
    </form>
  );
}

/**
 * Word cloud (one line, up to 20 characters) or open-ended (a text area, up to 250): a live character count, then
 * Submit. {@code error}: the server's reason for refusing the last try ("That word isn't allowed. Try another."), shown
 * under the box and tied to it, so the player can change it and send again.
 */
export function FreeTextForm({ long, max, onSubmit, busy = false, variant, error = null, initial = "" }: {
  long: boolean;
  max: number;
  onSubmit: (text: string) => void;
  busy?: boolean;
  variant: Variant;
  error?: string | null;
  /** What the player sent last time, when it was refused, so they change it rather than type it again. */
  initial?: string;
}) {
  const id = useId();
  const [text, setText] = useState(initial);
  const used = [...text.trim()].length;
  const ready = used > 0 && used <= max;
  const describedBy = id + "-hint" + (error ? " " + id + "-error" : "");
  return (
    <form className={variant === "game" ? "gl-form gl-card gl-answer-form" : "activity-panel stack"}
          onSubmit={(e) => { e.preventDefault(); if (ready) onSubmit(text.trim()); }}>
      <div className={variant === "game" ? "gl-field" : "field"}>
        <label htmlFor={id + "-in"}>{long ? "Your answer" : "Your word"}</label>
        {long ? (
          <textarea id={id + "-in"} rows={4} value={text} maxLength={max} disabled={busy} aria-describedby={describedBy}
                    aria-invalid={error ? true : undefined} onChange={(e) => setText(e.target.value)} />
        ) : (
          <input id={id + "-in"} type="text" value={text} maxLength={max} autoComplete="off" enterKeyHint="send"
                 disabled={busy} aria-describedby={describedBy} aria-invalid={error ? true : undefined}
                 onChange={(e) => setText(e.target.value)} className="typed-answer" />
        )}
        <span id={id + "-hint"} className="hint">{used} of {max} characters. The teacher chooses what the class sees.</span>
        {error && <span id={id + "-error"} className="hint hint-danger" role="alert">{error}</span>}
      </div>
      <button type="submit" className={submitClass(variant)} disabled={busy || !ready}>{busy ? "Sending…" : "Send"}</button>
    </form>
  );
}

/**
 * Brainstorm ideas round (W31): up to three boxes of up to 40 characters each, sent together. {@code error}: the
 * server's reason for refusing the last try (a rude word, too long), tied to the boxes.
 */
export function IdeasForm({ onSubmit, busy = false, variant, error = null, initial = [], max = 3, maxLength = 40 }: {
  onSubmit: (ideas: string[]) => void;
  busy?: boolean;
  variant: Variant;
  error?: string | null;
  initial?: string[];
  max?: number;
  maxLength?: number;
}) {
  const id = useId();
  const [ideas, setIdeas] = useState<string[]>(() => Array.from({ length: max }, (_, i) => initial[i] ?? ""));
  const filled = ideas.map((t) => t.trim()).filter(Boolean);
  return (
    <form className={variant === "game" ? "gl-form gl-card gl-answer-form" : "activity-panel stack"}
          onSubmit={(e) => { e.preventDefault(); if (filled.length) onSubmit(filled); }}>
      <fieldset className={variant === "game" ? "gl-field" : "field"} style={{ border: 0, padding: 0, margin: 0 }}
                aria-describedby={id + "-hint" + (error ? " " + id + "-error" : "")}>
        <legend>Your ideas</legend>
        {ideas.map((t, i) => (
          <input key={i} type="text" value={t} maxLength={maxLength} autoComplete="off" disabled={busy}
                 aria-label={"Idea " + (i + 1) + (i === 0 ? "" : " (optional)")} aria-invalid={error ? true : undefined}
                 onChange={(e) => setIdeas(ideas.map((old, k) => (k === i ? e.target.value : old)))} />
        ))}
        <span id={id + "-hint"} className="hint">1 to {max} ideas, up to {maxLength} characters each. Your teacher chooses what shows.</span>
        {error && <span id={id + "-error"} className="hint hint-danger" role="alert">{error}</span>}
      </fieldset>
      <button type="submit" className={submitClass(variant)} disabled={busy || filled.length === 0}>
        {busy ? "Sending…" : filled.length > 1 ? `Send ${filled.length} ideas` : "Send my idea"}
      </button>
    </form>
  );
}

/** Brainstorm votes round: a checkbox per idea, up to three; your own ideas are marked and can't be picked. */
export function VotesForm({ ideas, max = 3, onSubmit, busy = false, variant }: {
  ideas: { id: string; text: string; mine?: boolean }[];
  max?: number;
  onSubmit: (ids: string[]) => void;
  busy?: boolean;
  variant: Variant;
}) {
  const id = useId();
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <form className={variant === "game" ? "gl-form gl-card gl-answer-form" : "activity-panel stack"}
          onSubmit={(e) => { e.preventDefault(); if (picked.length) onSubmit(picked); }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} aria-describedby={id + "-hint"}>
        <legend>Vote for the best ideas</legend>
        <span id={id + "-hint"} className="hint">Pick up to {max}. {picked.length} picked.</span>
        <ul className="vote-list">
          {ideas.map((idea) => (
            <li key={idea.id}>
              <label className="check">
                <input type="checkbox" checked={picked.includes(idea.id)} disabled={busy || idea.mine || (!picked.includes(idea.id) && picked.length >= max)}
                       onChange={(e) => setPicked(e.target.checked ? [...picked, idea.id] : picked.filter((p) => p !== idea.id))} />
                <span>{idea.text}{idea.mine && <span className="muted"> (your idea)</span>}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <button type="submit" className={submitClass(variant)} disabled={busy || picked.length === 0}>
        {busy ? "Sending…" : "Send my votes"}
      </button>
    </form>
  );
}
