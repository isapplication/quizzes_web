import { EmailFile, fileSize } from "@/lib/communication";

/** An email's files, each a download button with its name and size. */
export function AttachmentList({ files, label, onDownload }: {
  files: EmailFile[];
  label: string;
  onDownload: (file: EmailFile) => void;
}) {
  return (
    <ul aria-label={label} className="row" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8, flexWrap: "wrap" }}>
      {files.map((f) => (
        <li key={f.id}>
          <button type="button" className="btn btn-light" onClick={() => onDownload(f)}>
            <span aria-hidden="true">📎 </span>Download {f.name} <span className="muted">({fileSize(f.size)})</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
