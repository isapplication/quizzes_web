"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { AnswerShape, SHAPE_NAMES } from "@/components/AnswerShape";
import { api } from "@/lib/api";
import { formatPin } from "@/lib/pin";

/** A QR code that opens the join page with the PIN filled in, drawn in the browser. */
export function JoinQr({ url, pin, size = 160 }: { url: string; pin: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(url, { margin: 1, width: size * 2, errorCorrectionLevel: "M" })
      .then((d) => { if (live) setSrc(d); })
      .catch(() => setSrc(null));
    return () => { live = false; };
  }, [url, size]);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} className="gl-qr" alt={"QR code to join the game with PIN " + formatPin(pin)} />;
}

interface Pattern {
  shapes: number[];
  changesAt: string;
}

/** "Players must be in the room": the classroom screen shows the four shapes to tap, and fetches a new one when due. */
export function RoomPatternCard({ pin }: { pin: string }) {
  const [pattern, setPattern] = useState<Pattern | null>(null);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const p = await api<Pattern>(`/api/v1/live/games/${pin}/room`);
        if (!live) return;
        setPattern(p);
        const wait = Math.max(2000, new Date(p.changesAt).getTime() - Date.now() + 500);
        timer = setTimeout(load, Math.min(wait, 30000));
      } catch {
        if (live) timer = setTimeout(load, 10000);
      }
    }
    load();
    return () => { live = false; clearTimeout(timer); };
  }, [pin]);
  if (!pattern) return null;
  return (
    <div className="gl-card gl-room">
      <div className="lbl">Then tap these shapes, in this order</div>
      <div className="gl-room-shapes" role="img"
           aria-label={"Room pattern: " + pattern.shapes.map((s) => SHAPE_NAMES[s]).join(", ")}>
        {pattern.shapes.map((s, i) => <AnswerShape key={i} index={s} size={56} />)}
      </div>
    </div>
  );
}

/**
 * The pad a player taps the room pattern into: the four answer shapes, the shapes tapped so far, and Clear.
 * {@code onChange} gets an update function, so quick taps each count.
 */
export function PatternPad({ value, onChange }: { value: number[]; onChange: (update: (v: number[]) => number[]) => void }) {
  return (
    <div className="gl-field">
      <span id="pattern-label">Tap the four shapes on your teacher&apos;s screen, in order</span>
      <div className="gl-pattern-entered" aria-live="polite">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="gl-pattern-slot">{value[i] !== undefined && <AnswerShape index={value[i]} size={28} />}</span>
        ))}
        <span className="sr-only">{value.length} of 4 shapes tapped{value.length ? ": " + value.map((s) => SHAPE_NAMES[s]).join(", ") : ""}</span>
      </div>
      <div className="gl-pattern-pad" role="group" aria-labelledby="pattern-label">
        {[0, 1, 2, 3].map((s) => (
          <button key={s} type="button" className="gl-pattern-key" disabled={value.length >= 4}
                  aria-label={SHAPE_NAMES[s]} onClick={() => onChange((v) => (v.length < 4 ? [...v, s] : v))}>
            <AnswerShape index={s} size={36} />
          </button>
        ))}
      </div>
      {value.length > 0 && <button type="button" className="gl-quiet" onClick={() => onChange(() => [])}>Clear</button>}
    </div>
  );
}
