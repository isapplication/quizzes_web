"use client";

import { useCallback, useId, useRef, useState } from "react";
import { AnswerShape, shapeName, shapeNumber } from "./AnswerShape";
import { GameCheckTile } from "./Stage";
import { formatNumber, LIMITS, sliderStart, snap, toggle } from "@/lib/questionTypes";

/**
 * The answer inputs of the Wave 1b question types, shared by the live player (variant "game", in the game look) and
 * the assignment page (variant "stage"): pick several, type an answer, and a number on a slider. Each is a real form
 * with a submit button, so Enter, a tap and a screen reader all work the same way.
 */
type Variant = "game" | "stage";

const submitClass = (v: Variant) => (v === "game" ? "gl-btn gl-btn-big" : "btn btn-primary activity-check");

/** Multi-select: a checkbox per answer, then Submit. At least one must be ticked. */
export function MultiSelectForm({ choices, onSubmit, busy = false, variant, compact = false }: {
  choices: string[];
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
            <GameCheckTile key={i} index={i} text={compact ? "" : c} checked={picked.includes(i)} disabled={busy} onChange={() => set(i)} />
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
                <span className="answer-text">{c}</span>
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
