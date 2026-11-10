"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiError, downloadFile } from "@/lib/api";
import { countOf } from "@/lib/reports";
import { AiReteachButton } from "@/components/AiReteachButton";

/**
 * What a teacher takes from a game's report or an assignment's results (wave3-plan.md, 3a): the CSV and the Excel file,
 * "Make a re-teach quiz", which copies the questions under 35 % right into a new draft quiz and opens it, and (3g)
 * "Re-teach with AI", which has AI Studio draft new questions like them. The hint says how many questions are hard; both
 * re-teach buttons are off when there are none.
 */
export function ReportActions({ filePath, fileName, reteachPath, aiReteachPath, hard, onError }: {
  /** The report's address without {@code .csv} or {@code .xlsx}: the CSV and Excel are {@code filePath + ".csv"} etc. */
  filePath: { csv: string; xlsx: string };
  fileName: string;
  reteachPath: string;
  /** "Re-teach with AI" for the same game or assignment. */
  aiReteachPath: string;
  /** How many questions the re-teach quiz would hold. */
  hard: number;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const clean = fileName.replace(/[^\w -]+/g, "").trim() || "results";

  async function download(kind: "csv" | "xlsx") {
    setBusy(kind);
    try {
      await downloadFile(filePath[kind], clean + " results." + kind);
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Quizplayo could not prepare the file. Please try again.");
    }
    setBusy(null);
  }

  async function reteach() {
    setBusy("reteach");
    try {
      const made = await api<{ quizId: string }>(reteachPath, { method: "POST" });
      router.push("/teacher/quiz/" + made.quizId + "/edit");
    } catch (e) {
      onError(e instanceof ApiError ? e.message : "Quizplayo could not make the re-teach quiz. Please try again.");
      setBusy(null);
    }
  }

  return (
    <div className="row" style={{ gap: 8 }}>
      <button type="button" className="btn btn-light" onClick={() => download("csv")} disabled={busy !== null}>Download CSV</button>
      <button type="button" className="btn btn-light" onClick={() => download("xlsx")} disabled={busy !== null}>Download Excel</button>
      <button type="button" className="btn btn-primary" onClick={reteach} disabled={busy !== null || hard === 0}
              aria-describedby="reteach-hint">Make a re-teach quiz</button>
      <AiReteachButton path={aiReteachPath} hard={hard} onError={onError} />
      <span id="reteach-hint" className="muted">
        {hard === 0 ? "No question was under 35% right."
          : "Copies " + countOf(hard, "question") + " under 35% right into a new draft, or AI drafts new ones like them for you to review."}
      </span>
    </div>
  );
}
