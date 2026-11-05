"use client";

import { useId, useState } from "react";
import { AnswerShape, shapeName, shapeNumber } from "@/components/AnswerShape";
import { POINTS, TIMES } from "@/lib/content";
import {
  type EditorPayload, type EditorQuestion, LIMITS, QTYPES, QTYPE_HINT, QTYPE_LABEL, type QType, scored,
} from "@/lib/questionTypes";

/**
 * The question being edited in the quiz editor: its type, its text, and the fields its type needs (wave1b-contract.md):
 * answers with one or several marked right, accepted texts, the slider's scale, the puzzle's items in the right order,
 * or a slide's title and text. The checks that stop publishing are in lib/questionTypes.ts {@code missing}.
 */
export function QuestionForm({ index, q, total, problem, onChange, onType, onMove, onCopy, onRemove }: {
  index: number;
  q: EditorQuestion;
  total: number;
  problem: string | null;
  onChange: (patch: Partial<EditorQuestion>) => void;
  onType: (type: QType) => void;
  onMove: (by: number) => void;
  onCopy: () => void;
  onRemove: () => void;
}) {
  const id = useId();
  const slide = q.type === "SLIDE";
  const max = slide ? LIMITS.slideText : LIMITS.question;
  const setPayload = (patch: EditorPayload) => onChange({ payload: { ...q.payload, ...patch } });

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2 style={{ margin: 0 }}>{slide ? "Slide" : "Question"} {index + 1} · {QTYPE_LABEL[q.type]}</h2>
        <div className="row" style={{ gap: 6 }}>
          <button type="button" className="btn btn-light" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up">↑</button>
          <button type="button" className="btn btn-light" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move down">↓</button>
          <button type="button" className="btn btn-light" onClick={onCopy}>Duplicate</button>
          <button type="button" className="btn btn-light" onClick={onRemove}>Delete</button>
        </div>
      </div>
      {problem && <p className="hint hint-danger" style={{ margin: 0 }} id={id + "-problem"}>{problem}</p>}

      <div className="field">
        <label htmlFor={id + "-type"}>Question type</label>
        <select id={id + "-type"} value={q.type} aria-describedby={id + "-type-hint"} onChange={(e) => onType(e.target.value as QType)}>
          {QTYPES.map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}
        </select>
        <p className="hint" id={id + "-type-hint"}>{QTYPE_HINT[q.type]} Changing the type keeps the text{q.choices.length ? " and, between choice types, the answers" : ""}.</p>
      </div>

      {slide && (
        <div className="field">
          <label htmlFor={id + "-title"}>Slide title</label>
          <input id={id + "-title"} type="text" maxLength={LIMITS.slideTitle} value={q.payload.title ?? ""}
                 onChange={(e) => setPayload({ title: e.target.value })} placeholder="For example: How plants make food" />
          <p className="hint">{(q.payload.title ?? "").length} / {LIMITS.slideTitle}</p>
        </div>
      )}
      <div className="field">
        <label htmlFor={id + "-text"}>{slide ? "Text (optional)" : "Question"}</label>
        <textarea id={id + "-text"} rows={slide ? 4 : 2} maxLength={max} value={q.text} onChange={(e) => onChange({ text: e.target.value })}
                  placeholder={slide ? "What the class reads on the big screen" : "Type your question"} />
        <p className="hint">{q.text.length} / {max}</p>
      </div>

      {(q.type === "QUIZ" || q.type === "TRUE_FALSE" || q.type === "MULTI_SELECT" || q.type === "POLL") && (
        <ChoiceFields q={q} onChange={onChange} />
      )}
      {q.type === "TYPE_ANSWER" && <AcceptFields accept={q.payload.accept ?? [""]} onChange={(accept) => setPayload({ accept })} />}
      {q.type === "SLIDER" && <SliderFields payload={q.payload} onChange={setPayload} />}
      {q.type === "PUZZLE" && <PuzzleFields items={q.choices} onChange={(choices) => onChange({ choices })} />}
      {q.type === "CATEGORISE" && <CategoriseFields payload={q.payload} onChange={setPayload} />}

      {!slide && (
        <div className="form-grid">
          <div className="field">
            <label htmlFor={id + "-time"}>Time limit</label>
            <select id={id + "-time"} value={q.timeLimitSeconds} onChange={(e) => onChange({ timeLimitSeconds: Number(e.target.value) })}>
              {TIMES.map((t) => <option key={t} value={t}>{t} seconds</option>)}
            </select>
          </div>
          {scored(q.type) ? (
            <div className="field">
              <label htmlFor={id + "-points"}>Points</label>
              <select id={id + "-points"} value={q.points} onChange={(e) => onChange({ points: Number(e.target.value) })}>
                {POINTS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          ) : (
            <p className="hint" style={{ alignSelf: "end" }}>A poll gives no points and isn&apos;t counted as right or wrong.</p>
          )}
        </div>
      )}
      {slide && <p className="hint" style={{ margin: 0 }}>A slide has no timer and no points: in a live game you click Next when the class has read it.</p>}
      {!slide && (
        <div className="field">
          <label htmlFor={id + "-explain"}>Explanation (optional)</label>
          <textarea id={id + "-explain"} rows={2} maxLength={LIMITS.explanation} value={q.explanation ?? ""}
                    onChange={(e) => onChange({ explanation: e.target.value || null })}
                    placeholder={q.type === "POLL" ? "Shown after the vote" : "Shown after the question: why the answer is right"} />
        </div>
      )}
    </>
  );
}

/** Answers for quiz, true/false, multi-select and poll: 2 to 6, each with its shape; radios, checkboxes or no mark. */
function ChoiceFields({ q, onChange }: { q: EditorQuestion; onChange: (patch: Partial<EditorQuestion>) => void }) {
  const id = useId();
  const one = q.type === "QUIZ" || q.type === "TRUE_FALSE";
  const many = q.type === "MULTI_SELECT";
  const editable = q.type !== "TRUE_FALSE";
  const legend = one ? "Answers: mark the correct one" : many ? "Answers: tick every correct one (not all of them)" : "Answers: a poll has no correct answer";

  function setChoice(i: number, text: string) {
    onChange({ choices: q.choices.map((c, k) => (k === i ? text : c)) });
  }

  function removeChoice(i: number) {
    onChange({
      choices: q.choices.filter((_, k) => k !== i),
      correctIndexes: q.correctIndexes.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)),
    });
  }

  function mark(i: number, on: boolean) {
    if (one) onChange({ correctIndexes: [i] });
    else onChange({ correctIndexes: on ? [...q.correctIndexes, i].sort((a, b) => a - b) : q.correctIndexes.filter((c) => c !== i) });
  }

  return (
    <fieldset className="answer-edits">
      <legend>{legend}</legend>
      {q.choices.map((c, i) => {
        const n = shapeNumber(i);
        const right = q.correctIndexes.includes(i);
        const name = "Answer " + (i + 1) + " (" + shapeName(i) + ")";
        return (
          <div key={i} className={"answer-edit" + (right ? " correct" : "")} style={{ background: `var(--a${n})`, color: `var(--a${n}-text)` }}>
            <AnswerShape index={i} size={22} color="currentColor" />
            {editable ? (
              <input type="text" aria-label={name} maxLength={LIMITS.answer} value={c} onChange={(e) => setChoice(i, e.target.value)}
                     placeholder={"Answer " + (i + 1) + (i >= 2 ? " (optional)" : "")} />
            ) : (
              <span className="answer-edit-fixed">{c}</span>
            )}
            {(one || many) && (
              <label className="answer-edit-correct">
                <input type={one ? "radio" : "checkbox"} name={one ? id + "-correct" : undefined} checked={right}
                       onChange={(e) => mark(i, e.target.checked)} aria-label={(one ? "Correct answer: " : "Correct: ") + (c.trim() || name)} />
                <span aria-hidden="true">Correct</span>
              </label>
            )}
            {editable && q.choices.length > LIMITS.minChoices && (
              <button type="button" className="answer-edit-remove" aria-label={"Remove answer " + (i + 1)} onClick={() => removeChoice(i)}>×</button>
            )}
          </div>
        );
      })}
      {editable && q.choices.length < LIMITS.maxChoices && (
        <button type="button" className="btn btn-light" onClick={() => onChange({ choices: [...q.choices, ""] })}>
          + Add an answer <span className="muted">({q.choices.length} of {LIMITS.maxChoices})</span>
        </button>
      )}
    </fieldset>
  );
}

/** Type answer: 1 to 10 accepted texts, each up to 20 characters. */
function AcceptFields({ accept, onChange }: { accept: string[]; onChange: (accept: string[]) => void }) {
  const id = useId();
  return (
    <fieldset className="type-edits" aria-describedby={id + "-hint"}>
      <legend>Accepted answers</legend>
      <p className="hint" id={id + "-hint"} style={{ marginTop: 0 }}>
        Up to {LIMITS.maxAccept}, each up to {LIMITS.accept} characters. Capital letters, extra spaces and end punctuation don&apos;t matter.
      </p>
      <ul className="edit-rows">
        {accept.map((a, i) => (
          <li key={i}>
            <input type="text" maxLength={LIMITS.accept} value={a} aria-label={"Accepted answer " + (i + 1)}
                   placeholder={i === 0 ? "The answer" : "Another way to write it"} onChange={(e) => onChange(accept.map((x, k) => (k === i ? e.target.value : x)))} />
            <span className="hint edit-count" aria-hidden="true">{a.length}/{LIMITS.accept}</span>
            {accept.length > 1 && (
              <button type="button" className="btn btn-light edit-icon" aria-label={"Remove accepted answer " + (i + 1)}
                      onClick={() => onChange(accept.filter((_, k) => k !== i))}>×</button>
            )}
          </li>
        ))}
      </ul>
      {accept.length < LIMITS.maxAccept && (
        <button type="button" className="btn btn-light" onClick={() => onChange([...accept, ""])}>+ Add another accepted answer</button>
      )}
    </fieldset>
  );
}

/** A number box that lets a teacher type "-" or "0." on the way to a number; it reports null until it is one. */
function NumberField({ label, value, onChange, hint }: { label: string; value: number | null | undefined; onChange: (v: number | null) => void; hint?: string }) {
  const id = useId();
  const [text, setText] = useState(value === null || value === undefined ? "" : String(value));
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="text" inputMode="decimal" value={text} aria-describedby={hint ? id + "-hint" : undefined}
             onChange={(e) => {
               const t = e.target.value.replace(",", ".");
               setText(t);
               const n = t.trim() === "" ? NaN : Number(t);
               onChange(Number.isFinite(n) ? n : null);
             }} />
      {hint && <p className="hint" id={id + "-hint"}>{hint}</p>}
    </div>
  );
}

/** Slider: the scale (lowest, highest, step), the right answer with its tolerance, and an optional unit. */
function SliderFields({ payload, onChange }: { payload: EditorPayload; onChange: (patch: EditorPayload) => void }) {
  const id = useId();
  const { min, max, step, unit = "" } = payload;
  const ready = min != null && max != null && step != null && step > 0 && max > min;
  return (
    <fieldset className="type-edits">
      <legend>Slider</legend>
      <div className="form-grid slider-grid">
        <NumberField label="Lowest value" value={payload.min} onChange={(v) => onChange({ min: v })} />
        <NumberField label="Highest value" value={payload.max} onChange={(v) => onChange({ max: v })} />
        <NumberField label="Step" value={payload.step} onChange={(v) => onChange({ step: v })} hint="At most 1,000 steps." />
        <NumberField label="Right answer" value={payload.answer} onChange={(v) => onChange({ answer: v })} hint="On a step." />
        <NumberField label="Tolerance (±)" value={payload.tol} onChange={(v) => onChange({ tol: v })}
                     hint="Full points this close. 0 means exact." />
        <div className="field">
          <label htmlFor={id + "-unit"}>Unit (optional)</label>
          <input id={id + "-unit"} type="text" maxLength={LIMITS.unit} value={unit} placeholder="e.g. cm, °C, years"
                 onChange={(e) => onChange({ unit: e.target.value })} />
        </div>
      </div>
      {ready && (
        <p className="hint" aria-live="polite">
          Players slide from {min} to {max}{unit ? " " + unit : ""} in steps of {step}. Answers further off earn fewer points,
          down to none at half the range away.
        </p>
      )}
    </fieldset>
  );
}

/** Puzzle: 3 to 6 items, written in the right order; each moves up or down. Players see them shuffled. */
function PuzzleFields({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const id = useId();
  const [said, setSaid] = useState("");
  function move(i: number, to: number) {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
    setSaid((items[i].trim() || "Item " + (i + 1)) + " moved to place " + (to + 1) + " of " + items.length + ".");
  }
  return (
    <fieldset className="type-edits" aria-describedby={id + "-hint"}>
      <legend>Items in the right order</legend>
      <p className="hint" id={id + "-hint"} style={{ marginTop: 0 }}>
        {LIMITS.minItems} to {LIMITS.maxItems} items, each up to {LIMITS.item} characters. Players see them shuffled.
      </p>
      <ol className="edit-rows numbered">
        {items.map((it, i) => (
          <li key={i}>
            <span className="edit-place" aria-hidden="true">{i + 1}</span>
            <input type="text" maxLength={LIMITS.item} value={it} aria-label={"Item " + (i + 1)}
                   placeholder={i === 0 ? "First" : i === items.length - 1 ? "Last" : "Next"}
                   onChange={(e) => onChange(items.map((x, k) => (k === i ? e.target.value : x)))} />
            <button type="button" className="btn btn-light edit-icon" disabled={i === 0} onClick={() => move(i, i - 1)}>
              <span aria-hidden="true">↑</span><span className="sr-only">Move item {i + 1} up</span>
            </button>
            <button type="button" className="btn btn-light edit-icon" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
              <span aria-hidden="true">↓</span><span className="sr-only">Move item {i + 1} down</span>
            </button>
            {items.length > LIMITS.minItems && (
              <button type="button" className="btn btn-light edit-icon" aria-label={"Remove item " + (i + 1)}
                      onClick={() => onChange(items.filter((_, k) => k !== i))}>×</button>
            )}
          </li>
        ))}
      </ol>
      <p className="sr-only" aria-live="polite">{said}</p>
      {items.length < LIMITS.maxItems && (
        <button type="button" className="btn btn-light" onClick={() => onChange([...items, ""])}>+ Add an item</button>
      )}
    </fieldset>
  );
}

/** Categorise: 2 to 8 category labels and 2 to 16 items, each assigned to a category. */
function CategoriseFields({ payload, onChange }: { payload: EditorPayload; onChange: (patch: EditorPayload) => void }) {
  const id = useId();
  const categories = payload.categories ?? ["", ""];
  const catItems = payload.catItems ?? [{ text: "", category: 0 }, { text: "", category: 0 }];

  function setCat(i: number, text: string) {
    onChange({ categories: categories.map((c, k) => (k === i ? text : c)) });
  }
  function removeCat(i: number) {
    const next = categories.filter((_, k) => k !== i);
    onChange({
      categories: next,
      catItems: catItems.map((it) => ({ ...it, category: it.category === i ? 0 : it.category > i ? it.category - 1 : it.category })),
    });
  }
  function setItem(i: number, text: string) {
    onChange({ catItems: catItems.map((it, k) => (k === i ? { ...it, text } : it)) });
  }
  function setItemCat(i: number, cat: number) {
    onChange({ catItems: catItems.map((it, k) => (k === i ? { ...it, category: cat } : it)) });
  }
  function removeItem(i: number) {
    onChange({ catItems: catItems.filter((_, k) => k !== i) });
  }

  return (
    <>
      <fieldset className="type-edits" aria-describedby={id + "-cat-hint"}>
        <legend>Categories</legend>
        <p className="hint" id={id + "-cat-hint"} style={{ marginTop: 0 }}>
          {LIMITS.minCategories} to {LIMITS.maxCategories} categories, each up to {LIMITS.categoryLabel} characters.
        </p>
        <ul className="edit-rows">
          {categories.map((c, i) => (
            <li key={i}>
              <input type="text" maxLength={LIMITS.categoryLabel} value={c} aria-label={"Category " + (i + 1)}
                     placeholder={"Category " + (i + 1)} onChange={(e) => setCat(i, e.target.value)} />
              {categories.length > LIMITS.minCategories && (
                <button type="button" className="btn btn-light edit-icon" aria-label={"Remove category " + (i + 1)}
                        onClick={() => removeCat(i)}>×</button>
              )}
            </li>
          ))}
        </ul>
        {categories.length < LIMITS.maxCategories && (
          <button type="button" className="btn btn-light" onClick={() => onChange({ categories: [...categories, ""] })}>
            + Add a category
          </button>
        )}
      </fieldset>
      <fieldset className="type-edits" aria-describedby={id + "-item-hint"}>
        <legend>Items to sort</legend>
        <p className="hint" id={id + "-item-hint"} style={{ marginTop: 0 }}>
          {LIMITS.minCatItems} to {LIMITS.maxCatItems} items, each up to {LIMITS.catItem} characters. Assign each item to its correct category.
        </p>
        <ul className="edit-rows">
          {catItems.map((it, i) => (
            <li key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="text" maxLength={LIMITS.catItem} value={it.text} aria-label={"Item " + (i + 1)}
                     placeholder={"Item " + (i + 1)} style={{ flex: 1 }} onChange={(e) => setItem(i, e.target.value)} />
              <select value={it.category} aria-label={"Category for item " + (i + 1)}
                      onChange={(e) => setItemCat(i, Number(e.target.value))}>
                {categories.map((c, ci) => (
                  <option key={ci} value={ci}>{c.trim() || "Category " + (ci + 1)}</option>
                ))}
              </select>
              {catItems.length > LIMITS.minCatItems && (
                <button type="button" className="btn btn-light edit-icon" aria-label={"Remove item " + (i + 1)}
                        onClick={() => removeItem(i)}>×</button>
              )}
            </li>
          ))}
        </ul>
        {catItems.length < LIMITS.maxCatItems && (
          <button type="button" className="btn btn-light"
                  onClick={() => onChange({ catItems: [...catItems, { text: "", category: 0 }] })}>
            + Add an item
          </button>
        )}
      </fieldset>
    </>
  );
}
