import { classroomShareUrl, teamsShareUrl } from "@/lib/share";

/** "Share to Google Classroom" and "Share to Teams" for an assignment's public link (only the link is sent). */
export function ShareLinks({ link }: { link: string }) {
  return (
    <p className="share-links">
      <span className="muted">Share:</span>
      <a className="btn btn-light" href={classroomShareUrl(link)} target="_blank" rel="noopener noreferrer">
        Share to Google Classroom<span className="sr-only"> (opens in a new tab)</span>
      </a>
      <a className="btn btn-light" href={teamsShareUrl(link)} target="_blank" rel="noopener noreferrer">
        Share to Teams<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  );
}
