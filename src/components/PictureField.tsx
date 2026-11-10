"use client";

import { type ClipboardEvent, type DragEvent, useId, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { type MediaRef, PICTURE, PICTURE_REMOVED, pictureProblem, uploadPicture } from "@/lib/media";

/**
 * Adds a picture to a question, an answer or a slide (wave2-plan.md part 2f): choose a file, drop one on the box, or paste
 * one while the box is focused. The file is checked here for the wrong kind or size (in plain words) and again by the
 * server, which writes it again without location data. A picture needs a short description (alt text) before the
 * question can be published; Remove takes it off the question (the file stays in the school's pictures, where its
 * teacher can remove it for good on the Pictures page). A picture removed there shows "Picture removed" here, to be
 * replaced or taken off.
 */
export function PictureField({ label, value, onChange, compact = false }: {
  /** What the picture is for, in words that finish "the picture of …": "the question", "answer 2". */
  label: string;
  value: MediaRef | null | undefined;
  onChange: (picture: MediaRef | null) => void;
  /** Small, for an answer. */
  compact?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function take(file: File | undefined | null) {
    if (!file) return;
    const bad = pictureProblem(file);
    if (bad) {
      setProblem(bad);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const up = await uploadPicture(file);
      onChange({ mediaId: up.mediaId, alt: value?.alt ?? "", url: up.url, width: up.width, height: up.height });
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Quizplayo could not add that picture. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function dropped(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    void take(e.dataTransfer.files?.[0]);
  }

  function pasted(e: ClipboardEvent) {
    const file = Array.from(e.clipboardData.files)[0];
    if (file) {
      e.preventDefault();
      void take(file);
    }
  }

  const missingAlt = !!value && !value.alt.trim();

  return (
    <div className={"picture-field" + (compact ? " compact" : "")}>
      <input ref={input} type="file" accept={PICTURE.accept} hidden
             onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; void take(f); }} />
      {value ? (
        <div className="picture-field-has">
          {value.removed ? (
            <span className="picture-field-preview picture-field-gone">{PICTURE_REMOVED}</span>
          ) : value.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="picture-field-preview" src={value.url} alt={value.alt} width={value.width ?? undefined} height={value.height ?? undefined} />
          ) : (
            <span className="picture-field-preview picture-field-gone">Picture saved</span>
          )}
          <div className="picture-field-text">
            <label htmlFor={id + "-alt"}>Describe {label}&apos;s picture</label>
            <input id={id + "-alt"} type="text" maxLength={PICTURE.maxAlt} value={value.alt} required
                   aria-invalid={missingAlt} aria-describedby={id + "-alt-hint"}
                   placeholder="For example: A brown dog running on a beach"
                   onChange={(e) => onChange({ ...value, alt: e.target.value })} />
            <p className="hint" id={id + "-alt-hint"}>
              Required. Read out by screen readers and read-aloud. {value.alt.length} / {PICTURE.maxAlt}
            </p>
            {value.removed && (
              <p className="hint">This picture was removed from your school&apos;s pictures. Replace it, or remove it from {label}.</p>
            )}
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn btn-light" disabled={busy} onClick={() => input.current?.click()}>
                {busy ? "Adding…" : "Replace"}
              </button>
              <button type="button" className="btn btn-light" disabled={busy} onClick={() => { setProblem(null); onChange(null); }}>
                Remove<span className="sr-only"> the picture of {label}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={"picture-drop" + (over ? " over" : "")} tabIndex={0} role="group"
             aria-label={"Add a picture to " + label + ": choose a file, or paste one here"}
             onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={dropped}
             onPaste={pasted}>
          <button type="button" className="btn btn-light" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? "Adding…" : compact ? "+ Picture" : "+ Add a picture"}
            <span className="sr-only"> to {label}</span>
          </button>
          {!compact && <span className="hint">or drop one here, or paste it. JPEG or PNG, up to 5 MB.</span>}
        </div>
      )}
      {problem && <p className="hint hint-danger" role="alert" style={{ margin: "4px 0 0" }}>{problem}</p>}
    </div>
  );
}
