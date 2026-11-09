import { AnswerShape } from "@/components/AnswerShape";
import { type AnswerKey, formatNumber, keyText, percent, QTYPE_LABEL, type QType } from "@/lib/questionTypes";

/**
 * One question's results, as a live game's report and an assignment's results both send them (API
 * {@code QuestionStats.Row}): every correct choice, whether it is scored (a poll isn't), its answer key and per-type
 * stats, and {@code questionId} (the question's own id).
 */
export interface ReportQuestion {
  number: number;
  questionId?: string | null;
  text: string;
  type: string | null;
  choices: string[];
  correctIndex: number;
  correctIndexes?: number[];
  counts: number[];
  answered: number;
  correct?: number;
  percentCorrect: number;
  counted?: boolean;
  key?: AnswerKey;
  stats?: { answered?: number; exactlyRight?: number; fullyRight?: number; mean?: number | null; min?: number | null;
    max?: number | null; top?: { text: string; count: number }[]; knew?: number; catItemCorrect?: number[] };
}

const CHOICE_REPORT_TYPES = ["QUIZ", "TRUE_FALSE", "MULTI_SELECT", "POLL"];
const num = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const withUnit = (n: number, unit?: string) => (unit ? num(n) + " " + unit : num(n));

/**
 * One question's results, by type: answer bars for choice questions (every right answer marked, none for a poll), the
 * most common texts for a typed answer, the spread for a slider and the share fully right for a puzzle.
 * {@code people}: how many could have answered, for "x of y answered"; {@code who}: what they are called there
 * ("players" in a live game, "students" in an assignment).
 */
export function QuestionResult({ q, people, who = "players" }: { q: ReportQuestion; people: number; who?: string }) {
  const type = (q.type ?? "QUIZ") as QType;
  const counted = q.counted !== false;
  const right = q.correctIndexes ?? (q.correctIndex >= 0 ? [q.correctIndex] : []);
  const stats = q.stats ?? {};
  const answered = stats.answered ?? q.answered;
  const answer = keyText(type, q.key, q.choices, right);
  const most = Math.max(1, ...q.counts);
  const label = QTYPE_LABEL[type] ?? ACTIVITY_LABEL[type as string] ?? type;
  return (
    <li className="card stack" style={{ gap: 8 }}>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <strong>{q.text}</strong>
        <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <span className="chip">{label}</span>
          {!counted ? (type as string) !== "CARD" && <span className="chip">No right answer</span> : answered > 0 && (
            <span className={"chip " + (q.percentCorrect >= 70 ? "chip-ok" : q.percentCorrect >= 40 ? "chip-warn" : "chip-danger")}>
              {q.percentCorrect}% correct
            </span>
          )}
        </span>
      </div>

      {CHOICE_REPORT_TYPES.includes(type) && (
        <ul className="report-answers">
          {q.choices.map((c, i) => {
            const isRight = counted && right.includes(i);
            return (
              <li key={i} className={isRight ? "correct" : ""}>
                <AnswerShape index={i} size={16} />
                <span className="report-answer-text">{c}{isRight && <strong> ✓<span className="sr-only"> right answer</span></strong>}</span>
                <span className="report-bar" aria-hidden="true">
                  <span style={{ width: (100 * (q.counts[i] ?? 0)) / most + "%", background: `var(--a${(i % 6) + 1})` }} />
                </span>
                <span className="report-count">{q.counts[i] ?? 0}</span>
              </li>
            );
          })}
        </ul>
      )}
      {type === "MULTI_SELECT" && stats.exactlyRight != null && (
        <div>{stats.exactlyRight} of {answered} picked exactly the right answers ({percent(stats.exactlyRight, answered)}%)</div>
      )}

      {type === "TYPE_ANSWER" && (
        <>
          {answer && <div>Accepted: <strong>{answer}</strong></div>}
          {stats.top && stats.top.length > 0 && (
            <ul className="report-answers" aria-label="Most common answers">
              {stats.top.map((t) => (
                <li key={t.text} className="report-typed">
                  <span className="report-answer-text">{t.text}</span>
                  <span className="report-bar" aria-hidden="true">
                    <span style={{ width: (100 * t.count) / Math.max(1, stats.top![0].count) + "%", background: "var(--a1)" }} />
                  </span>
                  <span className="report-count">{t.count}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {type === "SLIDER" && (
        <>
          {answer && <div>The answer: <strong>{answer}</strong></div>}
          {stats.mean != null && answered > 0 && (
            <div>Average {formatNumber(stats.mean, 0.1, q.key?.unit ?? "")} · lowest {withUnit(stats.min ?? 0, q.key?.unit)} · highest {withUnit(stats.max ?? 0, q.key?.unit)}</div>
          )}
        </>
      )}

      {type === "PUZZLE" && (
        <>
          {answer && <div>The right order: <strong>{answer}</strong></div>}
          {stats.fullyRight != null && (
            <div>{stats.fullyRight} of {answered} got the whole order right ({percent(stats.fullyRight, answered)}%)</div>
          )}
        </>
      )}

      {type === "CATEGORISE" && q.key?.categories && q.key?.catItems && (
        <>
          <div className="cat-result-grid">
            {q.key.categories.map((cat, ci) => {
              const here = q.key!.catItems!.filter((it) => it.category === ci);
              return (
                <div key={ci} className="cat-result-col">
                  <strong>{cat}</strong>
                  {here.map((it, j) => <span key={j} className="chip">{it.text}</span>)}
                </div>
              );
            })}
          </div>
          {stats.fullyRight != null && (
            <div>{stats.fullyRight} of {answered} sorted everything right ({percent(stats.fullyRight, answered)}%)</div>
          )}
        </>
      )}

      {(type as string) === "CARD" && stats.knew != null && (
        <div>{stats.knew} of {answered} knew this card ({percent(stats.knew, answered)}%)</div>
      )}

      <div className="muted">{q.answered} of {people} {who} answered</div>
    </li>
  );
}

/** Assignments may also hold activity rounds, which aren't question types. */
const ACTIVITY_LABEL: Record<string, string> = { MATCH: "Matching", CARD: "Flashcard" };
