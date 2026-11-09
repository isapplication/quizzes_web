"use client";

import { useState } from "react";
import { GameTile } from "@/components/Stage";
import { CategoriseForm, FreeTextForm, IdeasForm, MultiSelectForm, ScaleForm, SliderForm, TypeAnswerForm } from "@/components/AnswerInputs";
import { OrderList } from "@/components/ActivityRound";
import { PinForm } from "@/components/ImageQuestion";
import { type Pick, pickOf } from "@/lib/questionTypes";
import type { HostQuestion } from "./HostQuestion";

/**
 * Unplugged (wave2-contract.md): the classroom screen is the only device. The class talks it over, the teacher taps
 * the class's answer here, in the same forms a player's phone uses, and "Reveal" sends it as
 * {type: "classAnswer", index, answer}; the server closes the question at once.
 */
export function ClassAnswerPanel({ question, onAnswer }: {
  question: HostQuestion;
  onAnswer: (answer: Record<string, unknown>) => void;
}) {
  const pick: Pick = question.pick ?? pickOf(question.qtype);
  const [chosen, setChosen] = useState<number | null>(null);
  if (pick === "one") {
    return (
      <form className="stack" onSubmit={(e) => { e.preventDefault(); if (chosen !== null) onAnswer({ choice: chosen }); }}>
        <p className="gl-host-note"><span className="gl-pill">Tap the class&apos;s answer, then Reveal</span></p>
        <div className="gl-tiles gl-in" data-count={question.choices.length}>
          {question.choices.map((c, i) => (
            <GameTile key={i} index={i} text={c} state={chosen === i ? "chosen" : chosen !== null ? "dim" : undefined}
                      onClick={() => setChosen(i)} />
          ))}
        </div>
        <div className="gl-row center">
          <button type="submit" className="gl-btn gl-btn-big" disabled={chosen === null}>Reveal</button>
        </div>
      </form>
    );
  }
  return (
    <div className="stack">
      <p className="gl-host-note"><span className="gl-pill">Enter the class&apos;s answer, then Reveal</span></p>
      {pick === "many" && (
        <MultiSelectForm variant="game" choices={question.choices} onSubmit={(choices) => onAnswer({ choices })} />
      )}
      {pick === "text" && <TypeAnswerForm variant="game" onSubmit={(text) => onAnswer({ text })} />}
      {pick === "number" && question.slider && (
        <SliderForm variant="game" slider={question.slider} onSubmit={(value) => onAnswer({ value })} />
      )}
      {pick === "ideas" && <IdeasForm variant="game" onSubmit={(ideas) => onAnswer({ ideas })} />}
      {pick === "point" && question.image && (
        <PinForm variant="game" image={question.image} submitLabel="Reveal" onSubmit={(point) => onAnswer({ point })} />
      )}
      {pick === "scale" && question.scale && (
        <ScaleForm variant="game" scale={question.scale} onSubmit={(value) => onAnswer({ value })} />
      )}
      {(pick === "word" || pick === "long") && (
        <FreeTextForm variant="game" long={pick === "long"} max={question.maxLength ?? (pick === "long" ? 250 : 20)}
                      onSubmit={(text) => onAnswer({ text })} />
      )}
      {pick === "order" && (
        <OrderList key={question.index} items={question.choices} busy={false} className="gl-card gl-order stack"
                   submitLabel="Reveal" onSubmit={(order) => onAnswer({ order })} />
      )}
      {pick === "categorise" && question.categorise && (
        <CategoriseForm key={question.index} variant="game" data={question.categorise}
                        onSubmit={(categories) => onAnswer({ categories })} />
      )}
    </div>
  );
}

export interface SummaryRow {
  index: number;
  qtype: string;
  text: string;
  answered: number;
  correct: number;
  /** Null for a question that isn't scored (a poll, an opinion question). */
  percentCorrect: number | null;
}

/** The end of a Lecture (no podium): how the class did on each question, without names or points. */
export function LectureSummary({ rows }: { rows: SummaryRow[] }) {
  return (
    <div className="gl-card gl-host-panel gl-in">
      <div className="gl-host-panel-big">How the class did</div>
      <ol className="gl-bars" aria-label="Each question's share right">
        {rows.map((r) => (
          <li key={r.index}>
            <span className="gl-bars-text">{r.index + 1}. {r.text}</span>
            <span className="gl-bars-bar" aria-hidden="true"><span style={{ width: (r.percentCorrect ?? 0) + "%" }} /></span>
            <span className="gl-bars-count">
              {r.percentCorrect === null ? `${r.answered} answered` : `${r.percentCorrect}% right`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export interface WallIdea {
  id: string;
  text: string;
  hidden: boolean;
  mergedInto: string | null;
  votes: number;
}

export interface IdeasState {
  index: number;
  round: "IDEAS" | "VOTES";
  ideas: WallIdea[];
  total: number;
  voted: number;
  closesAt: number;
  shown: boolean;
}

/**
 * The host's brainstorm wall (W31): ideas as they arrive, hidden from the projected screen until the teacher shows them
 * (W10). Then each can be hidden, and two or more merged (the first ticked keeps its words; votes add together).
 * Next ends the ideas round (votes start) or the votes round (results).
 */
export function BrainstormWall({ state, onHide, onMerge, onShow, onNext }: {
  state: IdeasState;
  onHide: (id: string) => void;
  onMerge: (ids: string[]) => void;
  onShow: () => void;
  onNext: () => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const shown = state.ideas.filter((i) => !i.hidden && !i.mergedInto);
  return (
    <div className="stack gl-in">
      <div className="gl-row">
        <span className="gl-pill" role="status">
          {state.round === "IDEAS" ? `${state.total} ${state.total === 1 ? "idea" : "ideas"} in` : `${state.voted} voted`}
        </span>
        <span className="gl-spacer" />
        {!state.shown && state.total > 0 && <button type="button" className="gl-btn" onClick={onShow}>Show ideas</button>}
        {state.shown && picked.length >= 2 && (
          <button type="button" className="gl-btn" onClick={() => { onMerge(picked); setPicked([]); }}>Merge {picked.length} ideas</button>
        )}
        <button type="button" className="gl-btn gl-btn-big" onClick={onNext}>{state.round === "IDEAS" ? "Start voting" : "Show results"}</button>
      </div>
      {!state.shown ? (
        <div className="gl-card gl-host-panel">
          <div className="gl-host-panel-big">{state.round === "IDEAS" ? "Ideas are coming in" : "Players are voting"}</div>
          <p style={{ margin: 0 }}>The ideas stay hidden on this screen until you show them. Then you can hide or merge any.</p>
        </div>
      ) : (
        <ul className="gl-wall">
          {shown.map((i) => (
            <li key={i.id}>
              <label className="check">
                <input type="checkbox" checked={picked.includes(i.id)}
                       onChange={(e) => setPicked(e.target.checked ? [...picked, i.id] : picked.filter((p) => p !== i.id))}
                       aria-label={"Choose to merge: " + i.text} />
                <span>{i.text}</span>
              </label>
              <span className="gl-row" style={{ justifyContent: "space-between" }}>
                {state.round === "VOTES" ? <span>{i.votes} {i.votes === 1 ? "vote" : "votes"}</span> : <span />}
                <button type="button" className="gl-quiet gl-hide" aria-label={"Hide the idea: " + i.text} onClick={() => onHide(i.id)}>Hide</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** After the votes: the top 3 large, then every idea with its votes. */
export function BrainstormResults({ ideas }: { ideas: { id: string; text: string; votes: number }[] }) {
  const top = ideas.slice(0, 3);
  return (
    <div className="stack gl-in">
      <ol className="gl-board">
        {top.map((i, k) => (
          <li key={i.id}><span className="rk gl-on">{k + 1}</span><span className="nm">{i.text}</span>
            <span className="sc">{i.votes} {i.votes === 1 ? "vote" : "votes"}</span></li>
        ))}
      </ol>
      {ideas.length > 3 && (
        <ul className="gl-wall">
          {ideas.slice(3).map((i) => <li key={i.id}><span>{i.text}</span><span>{i.votes} {i.votes === 1 ? "vote" : "votes"}</span></li>)}
        </ul>
      )}
      {ideas.length === 0 && <div className="gl-card gl-host-panel">No ideas to show.</div>}
    </div>
  );
}
