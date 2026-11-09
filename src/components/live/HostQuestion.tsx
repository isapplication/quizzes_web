"use client";

import type { CSSProperties } from "react";
import { GameTile } from "@/components/Stage";
import { type AnswerKey, formatNumber, keyText, normaliseTyped, percent, type PinArea, type Pick, pickOf, position,
  type QuestionImage } from "@/lib/questionTypes";
import { PinResults, QuestionImageView } from "@/components/ImageQuestion";

/**
 * The classroom screen's view of one question, per type (Wave 1b): what players are answering while it is open, the
 * results once it closes (bars, top typed answers, the slider spread, the puzzle's share fully right), and a slide.
 */
export interface HostQuestion {
  index: number;
  text: string;
  choices: string[];
  qtype?: string;
  pick?: Pick;
  slider?: { min: number; max: number; step: number; unit?: string };
  categorise?: { categories: string[]; items: string[] };
  title?: string;
  /** SCALE (Wave 2e). */
  scale?: { min: number; max: number; lowLabel?: string; highLabel?: string };
  maxLength?: number;
  /** Wave 2h: the question's image and image reveal. */
  image?: QuestionImage;
  reveal?: boolean;
}

export interface HostStats {
  answered?: number;
  top?: { text: string; count: number }[];
  mean?: number;
  min?: number;
  max?: number;
  fullyRight?: number;
  exactlyRight?: number;
  /** SCALE: a count per point from min to max; nps on a 0–10 scale. */
  counts?: number[];
  nps?: number | null;
  /** WORD_CLOUD: words merged after normalising, most common first. */
  words?: { text: string; count: number }[];
  /** OPEN_ENDED: each shown answer with its id (for hiding). */
  texts?: { id: string; text: string }[];
  /** PIN_ANSWER: how many pinned inside; DROP_PIN: every pin. */
  inside?: number;
  points?: number[][];
}

export interface HostClosed {
  index: number;
  correctIndex: number;
  explanation: string | null;
  counts: number[];
  qtype?: string;
  correctIndexes?: number[];
  key?: AnswerKey;
  stats?: HostStats;
  /** Free text (W10): false until the teacher shows the answers on this screen. */
  shown?: boolean;
}

/** The teacher's moderation of free-text answers (W10). */
export interface Moderation {
  onHide: (id: string) => void;
  onShow: () => void;
}

const typeOf = (q: HostQuestion, c?: HostClosed) => c?.qtype ?? q.qtype ?? "QUIZ";

/** While the question is open: the answer tiles, or what players are doing for the other kinds. */
export function HostOpenAnswers({ question }: { question: HostQuestion }) {
  const pick = question.pick ?? pickOf(question.qtype);
  if (pick === "one" || pick === "many") {
    return (
      <>
        {pick === "many" && <p className="gl-host-note"><span className="gl-pill">Pick every right answer</span></p>}
        <div className="gl-tiles gl-in" data-count={question.choices.length}>
          {question.choices.map((c, i) => <GameTile key={i} index={i} text={c} />)}
        </div>
      </>
    );
  }
  if (pick === "text") {
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">Type your answer on your device</div>
        <div>Up to 20 characters. Capital letters don&apos;t matter.</div>
      </div>
    );
  }
  if (pick === "number" && question.slider) {
    const s = question.slider;
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">Slide to your answer</div>
        <div className="gl-scale" aria-hidden="true"><span /></div>
        <div className="gl-scale-ends">
          <span>{formatNumber(s.min, s.step, s.unit ?? "")}</span>
          <span>{formatNumber(s.max, s.step, s.unit ?? "")}</span>
        </div>
        <span className="sr-only">From {formatNumber(s.min, s.step, s.unit ?? "")} to {formatNumber(s.max, s.step, s.unit ?? "")}</span>
      </div>
    );
  }
  if (pick === "order") {
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">Put these in the right order</div>
        <ul className="gl-order-chips">
          {question.choices.map((c, i) => <li key={i} style={{ "--i": i } as CSSProperties}>{c}</li>)}
        </ul>
      </div>
    );
  }
  if (pick === "point" && question.image) {
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">{question.qtype === "DROP_PIN" ? "Drop your pin on the picture" : "Tap the right place on the picture"}</div>
        <QuestionImageView image={question.image} />
      </div>
    );
  }
  if (pick === "scale" && question.scale) {
    const sc = question.scale;
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">Pick a number from {sc.min} to {sc.max} on your device</div>
        <div className="gl-scale-ends"><span>{sc.min}: {sc.lowLabel}</span><span>{sc.max}: {sc.highLabel}</span></div>
      </div>
    );
  }
  if (pick === "word" || pick === "long") {
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">{pick === "word" ? "Send one word or short phrase" : "Write your answer"} on your device</div>
        <div>Up to {question.maxLength ?? (pick === "word" ? 20 : 250)} characters. Your teacher chooses what the class sees.</div>
      </div>
    );
  }
  if (pick === "categorise" && question.categorise) {
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">Sort items into the right categories</div>
        <div className="gl-cat-zones">
          {question.categorise.categories.map((cat, i) => (
            <div key={i} className="gl-cat-zone">
              <div className="gl-cat-zone-label">{cat}</div>
            </div>
          ))}
        </div>
        <ul className="gl-order-chips">
          {question.categorise.items.map((item, i) => <li key={i} style={{ "--i": i } as CSSProperties}>{item}</li>)}
        </ul>
      </div>
    );
  }
  return null;
}

/** After the question closes: the results for its type. */
export function HostResults({ question, closed, moderation }: { question: HostQuestion; closed: HostClosed; moderation?: Moderation }) {
  const qtype = typeOf(question, closed);
  const correct = closed.correctIndexes ?? (closed.correctIndex >= 0 ? [closed.correctIndex] : []);
  const stats = closed.stats ?? {};
  const pick = pickOf(qtype);

  if (pick === "one" || pick === "many") {
    const counts = closed.counts ?? [];
    const most = Math.max(1, ...counts);
    const answered = stats.answered ?? counts.reduce((a, b) => a + b, 0);
    return (
      <>
        {qtype === "POLL" && <p className="gl-host-note"><span className="gl-pill">Poll · no right answer · {answered} voted</span></p>}
        {qtype === "MULTI_SELECT" && stats.exactlyRight !== undefined && (
          <p className="gl-host-note">
            <span className="gl-pill">{stats.exactlyRight} of {answered} picked exactly the right answers ({percent(stats.exactlyRight, answered)}%)</span>
          </p>
        )}
        <div className="gl-tiles gl-in" data-count={question.choices.length}>
          {question.choices.map((c, i) => (
            <GameTile key={i} index={i} text={c} count={counts[i] ?? 0} share={percent(counts[i] ?? 0, most)}
                      state={qtype === "POLL" ? undefined : correct.includes(i) ? "correct" : "dim"} />
          ))}
        </div>
      </>
    );
  }

  if (qtype === "TYPE_ANSWER") {
    const accepted = new Set((closed.key?.accept ?? []).map(normaliseTyped));
    const top = stats.top ?? [];
    const most = Math.max(1, ...top.map((t) => t.count));
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">Accepted: {keyText(qtype, closed.key, [], []) ?? "—"}</div>
        <div>{stats.answered ?? 0} answered</div>
        {top.length > 0 ? (
          <ol className="gl-bars" aria-label="Most common answers">
            {top.map((t, i) => {
              const ok = accepted.has(normaliseTyped(t.text));
              return (
                <li key={i} className={ok ? "ok" : ""}>
                  <span className="gl-bars-text">{t.text}{ok && <span className="gl-bars-mark"> ✓<span className="sr-only"> accepted</span></span>}</span>
                  <span className="gl-bars-bar" aria-hidden="true"><span style={{ width: percent(t.count, most) + "%" }} /></span>
                  <span className="gl-bars-count">{t.count}</span>
                </li>
              );
            })}
          </ol>
        ) : <div>Nobody answered this one.</div>}
      </div>
    );
  }

  if (qtype === "SLIDER") {
    return <SliderSpread question={question} closed={closed} />;
  }

  if (qtype === "PUZZLE") {
    const answered = stats.answered ?? 0;
    const right = stats.fullyRight ?? 0;
    const share = percent(right, answered);
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">{right} of {answered} got the whole order right ({share}%)</div>
        <div className="gl-share" aria-hidden="true"><span style={{ width: share + "%" }} /></div>
        <ol className="gl-order-key">
          {(closed.key?.order ?? []).map((item, i) => <li key={i}>{item}</li>)}
        </ol>
      </div>
    );
  }

  if (qtype === "SCALE") {
    const counts = stats.counts ?? [];
    const min = question.scale?.min ?? 0;
    const most = Math.max(1, ...counts);
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">
          {stats.mean != null ? <>Average {stats.mean.toLocaleString(undefined, { maximumFractionDigits: 1 })}</> : "Nobody answered"}
          {stats.nps != null && <> · Net Promoter Score {stats.nps}</>}
        </div>
        <ol className="gl-bars" aria-label="Answers per point">
          {counts.map((c, i) => (
            <li key={i}>
              <span className="gl-bars-text">{min + i}</span>
              <span className="gl-bars-bar" aria-hidden="true"><span style={{ width: percent(c, most) + "%" }} /></span>
              <span className="gl-bars-count">{c}</span>
            </li>
          ))}
        </ol>
        {question.scale && <div className="gl-scale-ends"><span>{question.scale.min}: {question.scale.lowLabel}</span>
          <span>{question.scale.max}: {question.scale.highLabel}</span></div>}
      </div>
    );
  }

  if ((qtype === "PIN_ANSWER" || qtype === "DROP_PIN") && question.image) {
    return (
      <div className="gl-card gl-host-panel gl-in">
        <PinResults image={question.image} areas={(closed.key as { areas?: PinArea[] } | undefined)?.areas ?? []}
                    points={stats.points ?? []} answered={stats.answered ?? 0}
                    inside={qtype === "PIN_ANSWER" ? stats.inside ?? 0 : undefined} />
      </div>
    );
  }

  if (qtype === "WORD_CLOUD" || qtype === "OPEN_ENDED") {
    return <FreeTextResults qtype={qtype} closed={closed} moderation={moderation} />;
  }

  if (qtype === "CATEGORISE") {
    const answered = stats.answered ?? 0;
    const right = stats.fullyRight ?? 0;
    const share = percent(right, answered);
    const cats = closed.key?.categories ?? [];
    const items = closed.key?.catItems ?? [];
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">{right} of {answered} sorted everything right ({share}%)</div>
        <div className="gl-share" aria-hidden="true"><span style={{ width: share + "%" }} /></div>
        <div className="gl-cat-results">
          {cats.map((cat, ci) => {
            const here = items.filter((it) => it.category === ci);
            return (
              <div key={ci} className="gl-cat-result">
                <div className="gl-cat-zone-label">{cat}</div>
                {here.map((it, j) => <span key={j} className="gl-cat-item">{it.text}</span>)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

/**
 * Word cloud and open-ended results (W10): only the count until the teacher shows the answers; then the cloud (sized
 * by count, with a table for screen readers) or a wall of answers, each with Hide.
 */
function FreeTextResults({ qtype, closed, moderation }: { qtype: string; closed: HostClosed; moderation?: Moderation }) {
  const stats = closed.stats ?? {};
  const answered = stats.answered ?? 0;
  if (closed.shown === false) {
    return (
      <div className="gl-card gl-host-panel gl-in">
        <div className="gl-host-panel-big">{answered} {answered === 1 ? "answer" : "answers"} in</div>
        <p style={{ margin: 0 }}>The answers stay hidden until you show them. You can hide any answer afterwards.</p>
        {moderation && answered > 0 && <button type="button" className="gl-btn gl-btn-big" onClick={moderation.onShow}>Show answers</button>}
      </div>
    );
  }
  if (qtype === "WORD_CLOUD") {
    const words = stats.words ?? [];
    const most = Math.max(1, ...words.map((w) => w.count));
    return (
      <div className="gl-card gl-host-panel gl-in">
        <ul className="gl-cloud" aria-hidden="true">
          {words.map((w) => <li key={w.text} style={{ "--w": w.count / most } as CSSProperties}>{w.text}</li>)}
        </ul>
        <table className="gl-cloud-table">
          <caption className="sr-only">Every word and how many sent it</caption>
          <thead className="sr-only"><tr><th scope="col">Word</th><th scope="col">Count</th>{moderation && <th scope="col">Hide</th>}</tr></thead>
          <tbody>
            {words.map((w) => (
              <tr key={w.text}>
                <td className="sr-only">{w.text}</td>
                <td className="sr-only">{w.count}</td>
                {moderation && <td><button type="button" className="gl-quiet gl-hide" onClick={() => moderation.onHide(w.text)}>
                  Hide &ldquo;{w.text}&rdquo;</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
        {words.length === 0 && <div>No answers to show.</div>}
      </div>
    );
  }
  const texts = stats.texts ?? [];
  return (
    <div className="gl-in stack">
      <ul className="gl-wall">
        {texts.map((t) => (
          <li key={t.id}>
            <span>{t.text}</span>
            {moderation && <button type="button" className="gl-quiet gl-hide" aria-label={"Hide the answer: " + t.text}
                                   onClick={() => moderation.onHide(t.id)}>Hide</button>}
          </li>
        ))}
      </ul>
      {texts.length === 0 && <div className="gl-card gl-host-panel">No answers to show.</div>}
    </div>
  );
}

/** The slider's spread: the scale, the right band (answer ± tolerance), the players' lowest to highest, and the mean. */
function SliderSpread({ question, closed }: { question: HostQuestion; closed: HostClosed }) {
  const s = question.slider;
  const stats = closed.stats ?? {};
  const key = closed.key ?? {};
  const step = s?.step ?? 1;
  const unit = key.unit ?? s?.unit ?? "";
  const f = (v: number) => formatNumber(v, step, unit);
  const answered = stats.answered ?? 0;
  const has = answered > 0 && stats.mean !== undefined && stats.min !== undefined && stats.max !== undefined;
  return (
    <div className="gl-card gl-host-panel gl-in">
      <div className="gl-host-panel-big">The answer: {keyText("SLIDER", key, [], [], step) ?? "—"}</div>
      {s && key.answer !== undefined && (
        <div className="gl-spread" aria-hidden="true">
          <span className="band" style={{
            left: position(key.answer - (key.tol ?? 0), s.min, s.max) + "%",
            width: Math.max(0.8, position(key.answer + (key.tol ?? 0), s.min, s.max) - position(key.answer - (key.tol ?? 0), s.min, s.max)) + "%",
          }} />
          {has && (
            <>
              <span className="range" style={{ left: position(stats.min!, s.min, s.max) + "%",
                width: Math.max(0.8, position(stats.max!, s.min, s.max) - position(stats.min!, s.min, s.max)) + "%" }} />
              <span className="mean" style={{ left: position(stats.mean!, s.min, s.max) + "%" }}><b>Average</b></span>
            </>
          )}
          <span className="answer" style={{ left: position(key.answer, s.min, s.max) + "%" }}><b>Answer</b></span>
        </div>
      )}
      {s && <div className="gl-scale-ends"><span>{f(s.min)}</span><span>{f(s.max)}</span></div>}
      <div className="gl-spread-facts">
        <span>{answered} answered</span>
        {has && (
          <>
            <span>Average <b>{formatNumber(stats.mean!, step / 10, unit)}</b></span>
            <span>Lowest <b>{f(stats.min!)}</b></span>
            <span>Highest <b>{f(stats.max!)}</b></span>
          </>
        )}
      </div>
    </div>
  );
}

/** A content slide on the classroom screen: title and text large, no timer; Next moves on. */
export function HostSlide({ question, last, onNext }: { question: HostQuestion; last: boolean; onNext: () => void }) {
  return (
    <>
      <div className="gl-row">
        <span className="gl-pill">Slide</span>
        <span className="gl-spacer" />
        <button type="button" className="gl-btn gl-btn-big" onClick={onNext}>{last ? "Show podium" : "Next"}</button>
      </div>
      <article className="gl-card gl-slide gl-in">
        <h1 className="gl-slide-title">{question.title}</h1>
        {question.text && <p className="gl-slide-text">{question.text}</p>}
      </article>
    </>
  );
}
