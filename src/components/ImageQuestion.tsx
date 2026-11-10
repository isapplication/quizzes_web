"use client";

import { type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { PICTURE_REMOVED } from "@/lib/media";
import { insideArea, LIMITS, type PinArea, type QuestionImage, revealStep } from "@/lib/questionTypes";

/**
 * Wave 2h image questions (wave2-contract.md): the question's image (with image reveal, W30), placing a pin (pin answer
 * and drop pin), the results drawn over the image, and the editor's circles. Coordinates are shares of the image's
 * width and height (0 to 1), so they mean the same on every screen size. The image is the stand-in reference until part
 * 2f's uploads: an address and alt text (W21), with the picture's size for its proportions.
 */

type Variant = "game" | "stage";
const submitClass = (v: Variant) => (v === "game" ? "gl-btn gl-btn-big" : "btn btn-primary activity-check");
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const aspectOf = (img: QuestionImage) => (img.width && img.height ? img.width / img.height : 1);
const pct = (v: number) => Math.round(v * 100);

/** The image box keeps the picture's proportions, so a share of its width and height is a place on the picture. */
function ImageBox({ image, children }: { image: QuestionImage; children?: ReactNode }) {
  const ratio = image.width && image.height ? `${image.width} / ${image.height}` : undefined;
  return (
    <div className="qimg" style={ratio ? { aspectRatio: ratio } : undefined}>
      {image.url ? (
        // eslint-disable-next-line @next/next/no-img-element -- the question's own picture, a signed same-origin link (2f)
        <img src={image.url} alt={image.alt} draggable={false} />
      ) : (
        // Removed by its teacher (decision O3): the place stays, with its words.
        <span className="picture-removed"><span className="picture-removed-label">{PICTURE_REMOVED}</span>
          <span className="picture-removed-alt">{image.alt}</span></span>
      )}
      {children}
    </div>
  );
}

/** Where each of the five reveal tiles uncovers, in order: the outer strips first, so the answer isn't given at once. */
const REVEAL_ORDER = [0, 4, 2, 1, 3];

/**
 * A question's image above it. With {@code reveal}, five tiles uncover in order over the time limit, timed from when the
 * server opened the question ({@code openedAt} to {@code closesAt}), so every screen shows the same step. Reduced motion
 * turns the fade into plain steps (CSS).
 */
export function QuestionImageView({ image, reveal = false, openedAt = 0, closesAt = 0, serverNow, closed = false }: {
  image: QuestionImage;
  reveal?: boolean;
  openedAt?: number;
  closesAt?: number;
  serverNow?: () => number;
  closed?: boolean;
}) {
  const live = reveal && !closed && !!serverNow;
  const [step, setStep] = useState(() => (live && serverNow ? revealStep(openedAt, closesAt, serverNow()) : 5));
  useEffect(() => {
    if (!live || !serverNow) {
      setStep(5);
      return;
    }
    const tick = () => setStep(revealStep(openedAt, closesAt, serverNow()));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [live, openedAt, closesAt, serverNow]);
  return (
    <figure className="qimg-figure">
      <ImageBox image={image}>
        {live && step < 5 && (
          <div className="qimg-cover" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={REVEAL_ORDER.indexOf(i) < step ? "open" : ""} style={{ "--i": i } as CSSProperties} />
            ))}
          </div>
        )}
      </ImageBox>
      {live && step < 5 && <figcaption className="qimg-note">The picture uncovers bit by bit: {step} of 5 parts shown.</figcaption>}
    </figure>
  );
}

/**
 * Pin answer and drop pin: tap the image to place a pin, drag the pin to move it, or move it with the arrow keys (Shift
 * for big steps), then Submit. The pin is a button, so it is reachable from the keyboard and named for screen readers.
 */
export function PinForm({ image, onSubmit, busy = false, variant, submitLabel = "Submit my pin" }: {
  image: QuestionImage;
  onSubmit: (point: { x: number; y: number }) => void;
  busy?: boolean;
  variant: Variant;
  submitLabel?: string;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement | null>(null);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function at(e: { clientX: number; clientY: number }) {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width === 0 || r.height === 0) return null;
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  }
  function onPinDown(e: PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0 || busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPinMove(e: PointerEvent<HTMLButtonElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setDragging(true);
    const p = at(e);
    if (p) setPin(p);
  }
  function onPinKey(e: KeyboardEvent<HTMLButtonElement>) {
    const step = e.shiftKey ? 0.1 : 0.02;
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const d = move[e.key];
    if (!d || !pin) return;
    e.preventDefault();
    setPin({ x: clamp01(pin.x + d[0]), y: clamp01(pin.y + d[1]) });
  }

  return (
    <form className={variant === "game" ? "gl-form gl-card gl-pin-form" : "activity-panel stack pin-form"}
          onSubmit={(e) => { e.preventDefault(); if (pin) onSubmit(pin); }}>
      <p id={id + "-how"} className="hint" style={{ margin: 0 }}>
        Tap the picture to place your pin. Drag it, or use the arrow keys, to move it.
      </p>
      <div ref={box} className="qimg-target" onClick={(e) => {
        if (busy || (e.target as HTMLElement).closest("button")) return;
        const p = at(e);
        if (p) setPin(p);
      }}>
        <ImageBox image={image}>
          {pin ? (
            <button type="button" className={"qimg-pin" + (dragging ? " dragging" : "")} style={{ left: pin.x * 100 + "%", top: pin.y * 100 + "%" }}
                    aria-label={`Your pin, ${pct(pin.x)}% across and ${pct(pin.y)}% down. Arrow keys move it.`}
                    aria-describedby={id + "-how"} onPointerDown={onPinDown} onPointerMove={onPinMove}
                    onLostPointerCapture={() => setDragging(false)} onKeyDown={onPinKey} disabled={busy} />
          ) : (
            <button type="button" className="qimg-place" onClick={() => setPin({ x: 0.5, y: 0.5 })}>
              Place a pin in the middle
            </button>
          )}
        </ImageBox>
      </div>
      <button type="submit" className={submitClass(variant)} disabled={busy || !pin}>
        {busy ? "Sending…" : pin ? submitLabel : "Place your pin first"}
      </button>
    </form>
  );
}

/**
 * After closing: a pin answer's right circles (and how many pinned inside), or a drop pin's dots (W29). The figures are
 * also in words under the picture, so nothing depends on seeing it.
 */
export function PinResults({ image, areas = [], points = [], answered, inside }: {
  image: QuestionImage;
  areas?: PinArea[];
  points?: number[][];
  answered: number;
  inside?: number;
}) {
  const aspect = aspectOf(image);
  return (
    <figure className="qimg-figure">
      <ImageBox image={image}>
        <svg className="qimg-overlay" viewBox={`0 0 100 ${100 / aspect}`} preserveAspectRatio="none" aria-hidden="true">
          {areas.map((a, i) => <ellipse key={i} className="qimg-area" cx={a.x * 100} cy={(a.y * 100) / aspect} rx={a.r * 100} ry={a.r * 100} />)}
          {points.map((p, i) => <circle key={i} className="qimg-dot" cx={p[0] * 100} cy={(p[1] * 100) / aspect} r={1.2} />)}
        </svg>
      </ImageBox>
      <figcaption className="qimg-note">
        {inside !== undefined
          ? `${inside} of ${answered} pinned inside the right ${areas.length === 1 ? "area" : "areas"}.`
          : `${answered} ${answered === 1 ? "pin" : "pins"} dropped.`}
      </figcaption>
    </figure>
  );
}

/**
 * The editor's right areas (W28): click the picture to add a circle (up to 3), drag its numbered handle to move it, and
 * set the centre and size in the number fields, which are also the keyboard way in. Each circle is judged in the
 * picture's proportions, as players' pins are.
 */
export function AreaEditor({ image, areas, onChange }: { image: QuestionImage; areas: PinArea[]; onChange: (areas: PinArea[]) => void }) {
  const box = useRef<HTMLDivElement | null>(null);
  const aspect = aspectOf(image);
  const [active, setActive] = useState<number | null>(null);

  function at(e: { clientX: number; clientY: number }) {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width === 0) return null;
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  }
  function set(i: number, patch: Partial<PinArea>) {
    onChange(areas.map((a, k) => (k === i ? { ...a, ...patch } : a)));
  }
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div ref={box} className="qimg-target" onClick={(e) => {
        if ((e.target as HTMLElement).closest("button") || areas.length >= LIMITS.maxAreas) return;
        const p = at(e);
        if (p) onChange([...areas, { x: p.x, y: p.y, r: 0.08 }]);
      }}>
        <ImageBox image={image}>
          <svg className="qimg-overlay" viewBox={`0 0 100 ${100 / aspect}`} preserveAspectRatio="none" aria-hidden="true">
            {areas.map((a, i) => <ellipse key={i} className="qimg-area" cx={a.x * 100} cy={(a.y * 100) / aspect} rx={a.r * 100} ry={a.r * 100} />)}
          </svg>
          {areas.map((a, i) => (
            <button key={i} type="button" className={"qimg-handle" + (active === i ? " dragging" : "")}
                    style={{ left: a.x * 100 + "%", top: a.y * 100 + "%" }}
                    aria-label={`Right area ${i + 1}: drag to move, or use its number fields`}
                    onPointerDown={(e) => { if (e.button === 0) { e.currentTarget.setPointerCapture(e.pointerId); setActive(i); } }}
                    onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) { const p = at(e); if (p) set(i, p); } }}
                    onLostPointerCapture={() => setActive(null)}>{i + 1}</button>
          ))}
        </ImageBox>
      </div>
      <p className="hint" style={{ margin: 0 }}>
        {areas.length < LIMITS.maxAreas ? "Click the picture to add a right area (up to 3)." : "Three areas: remove one to add another."}
        {" "}A pin inside any of them is right.
      </p>
      {areas.map((a, i) => (
        <fieldset key={i} className="area-fields">
          <legend>Right area {i + 1}</legend>
          <AreaNumber label="Across (%)" value={a.x} onChange={(v) => set(i, { x: v })} />
          <AreaNumber label="Down (%)" value={a.y} onChange={(v) => set(i, { y: v })} />
          <AreaNumber label="Size (% of width)" value={a.r} min={0.01} max={0.5} onChange={(v) => set(i, { r: v })} />
          <button type="button" className="btn btn-light" onClick={() => onChange(areas.filter((_, k) => k !== i))}>Remove</button>
        </fieldset>
      ))}
    </div>
  );
}

function AreaNumber({ label, value, onChange, min = 0, max = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  const id = useId();
  return (
    <span className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" min={min * 100} max={max * 100} step={1} value={Math.round(value * 100)}
             onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.max(min, Math.min(max, v / 100))); }} />
    </span>
  );
}

/** Would this pin be right? (The server decides; the editor's preview uses this.) */
export const wouldBeRight = (p: { x: number; y: number }, areas: PinArea[], image: QuestionImage) =>
  areas.some((a) => insideArea(p, a, aspectOf(image)));
