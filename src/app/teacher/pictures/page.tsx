"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AppFrame } from "@/components/AppFrame";
import { EmptyState, ErrorState, LoadingState, PageHeader } from "@/components/ui/States";
import { ApiError } from "@/lib/api";
import { isSchoolAdmin, useMe } from "@/lib/me";
import {
  fileSize, listPictures, type PictureScope, removalWarning, removePicture, type TeacherPicture, usedIn,
} from "@/lib/media";

export default function PicturesRoute() {
  return (
    <AppFrame>
      <Pictures />
    </AppFrame>
  );
}

/**
 * The pictures a teacher added to questions, answers and slides (decision O3): each with where it is used, and Remove,
 * which asks once on the card itself before it removes the picture for good. A school admin can also see and remove
 * every picture of the school. Removing stops every link to the picture and deletes the file; the questions keep its
 * place and show "Picture removed" with its description. Copies already opened can show for up to 48 hours.
 */
function Pictures() {
  const me = useMe();
  const admin = isSchoolAdmin(me);
  const [scope, setScope] = useState<PictureScope>("mine");
  const [pictures, setPictures] = useState<TeacherPicture[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);

  const load = useCallback((which: PictureScope) => {
    setPictures(null);
    setError(null);
    listPictures(which).then(setPictures).catch((e) =>
      setError(e instanceof ApiError ? e.message : "Quizplayo could not load your pictures. Please try again."));
  }, []);

  useEffect(() => load(scope), [load, scope]);

  function removed(p: TeacherPicture) {
    setPictures((all) => all?.filter((x) => x.mediaId !== p.mediaId) ?? null);
    setStatus("Picture removed. Questions that used it now show “Picture removed”.");
    // The card and its buttons are gone: put focus somewhere that still exists.
    heading.current?.focus();
  }

  return (
    <div className="page">
      <PageHeader title="Pictures"
                  description="The pictures you added to questions, answers and slides. Remove one you shouldn't have shared." />
      {admin && (
        <div className="segmented pictures-scope" role="group" aria-label="Whose pictures">
          <button type="button" className={scope === "mine" ? "on" : ""} aria-pressed={scope === "mine"}
                  onClick={() => setScope("mine")}>My pictures</button>
          <button type="button" className={scope === "school" ? "on" : ""} aria-pressed={scope === "school"}
                  onClick={() => setScope("school")}>Whole school</button>
        </div>
      )}
      <h2 ref={heading} tabIndex={-1} className="sr-only">
        {scope === "school" ? "Every picture of the school" : "Your pictures"}
      </h2>
      <p className="sr-only" role="status" aria-live="polite">{status}</p>
      {error ? (
        <ErrorState message={error} onRetry={() => load(scope)} />
      ) : pictures === null ? (
        <LoadingState label="Loading pictures…" />
      ) : pictures.length === 0 ? (
        <EmptyState title={scope === "school" ? "No pictures in the school yet" : "No pictures yet"}>
          Pictures you add to a question in the quiz editor show here.
        </EmptyState>
      ) : (
        <ul className="picture-grid" aria-label={pictures.length + (pictures.length === 1 ? " picture" : " pictures")}>
          {pictures.map((p) => (
            <li key={p.mediaId}>
              <PictureCard picture={p} showOwner={scope === "school"} onRemoved={() => removed(p)} />
            </li>
          ))}
        </ul>
      )}
      <p className="hint pictures-note">
        Removing a picture stops every link to it at once and deletes the file. Phones and browsers that already opened it
        may keep showing their copy for up to 48 hours, until its link expires.
      </p>
    </div>
  );
}

function PictureCard({ picture: p, showOwner, onRemoved }: {
  picture: TeacherPicture;
  showOwner: boolean;
  onRemoved: () => void;
}) {
  const id = useId();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const keep = useRef<HTMLButtonElement>(null);
  const remove = useRef<HTMLButtonElement>(null);
  const added = new Date(p.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const name = (p.quizTitles[0] ? "the picture in “" + p.quizTitles[0] + "”" : "the picture added " + added);

  // Keep focus with the person: on the safe choice when the question appears, back on Remove when they keep it.
  useEffect(() => {
    if (asking) keep.current?.focus();
  }, [asking]);

  async function confirmRemove() {
    setBusy(true);
    setProblem(null);
    try {
      await removePicture(p.mediaId);
      onRemoved();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : "Quizplayo could not remove the picture. Please try again.");
      setBusy(false);
    }
  }

  return (
    <article className="card picture-card" aria-labelledby={id + "-title"}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a signed same-origin link the API caches itself */}
      <img src={p.url} alt="" width={p.width} height={p.height} loading="lazy" decoding="async" />
      <h3 id={id + "-title"} className="picture-card-title">{usedIn(p.quizzes)}</h3>
      <div className="picture-card-facts">
        {p.quizTitles.length > 0 && (
          <p className="picture-card-quizzes">{p.quizTitles.join(", ")}{p.quizzes > p.quizTitles.length ? ", …" : ""}</p>
        )}
        <p className="hint">
          Added {added}{showOwner ? " by " + (p.mine ? "you" : p.addedBy ?? "a former teacher") : ""} · {p.width} × {p.height} ·{" "}
          {fileSize(p.bytes)}
        </p>
      </div>
      <footer>
        {asking ? (
          <div className="picture-confirm" role="group" aria-labelledby={id + "-ask"} aria-describedby={id + "-warn"}>
            <p id={id + "-ask"} className="picture-confirm-ask">Remove this picture for good?</p>
            <p id={id + "-warn"} className="hint">{removalWarning(p)}</p>
            <div className="row" style={{ gap: 6 }}>
              <button type="button" className="btn btn-danger" disabled={busy} onClick={confirmRemove}>
                {busy ? "Removing…" : "Remove picture"}
              </button>
              <button ref={keep} type="button" className="btn btn-light" disabled={busy}
                      onClick={() => { setAsking(false); setProblem(null); requestAnimationFrame(() => remove.current?.focus()); }}>
                Keep it
              </button>
            </div>
          </div>
        ) : (
          <button ref={remove} type="button" className="btn btn-light" onClick={() => setAsking(true)}>
            Remove<span className="sr-only"> {name}</span>
          </button>
        )}
        {problem && <p className="hint hint-danger" role="alert">{problem}</p>}
      </footer>
    </article>
  );
}
