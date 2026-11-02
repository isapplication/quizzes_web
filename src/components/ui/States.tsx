import Link from "next/link";

type Tone = "success" | "waiting" | "problem" | "info";

const ICONS: Record<Tone, string> = { success: "✓", waiting: "…", problem: "!", info: "i" };

/** A focused page's card: status icon, title, message, next-step buttons, optional steps. */
export function StatusCard({ tone, title, children, actions, steps }: {
  tone: Tone;
  title: string;
  children?: React.ReactNode;
  actions?: { label: string; href: string; primary?: boolean }[];
  steps?: { label: string; done: boolean }[];
}) {
  return (
    <section className={"status-card status-" + tone} aria-live="polite">
      <div className="status-icon" aria-hidden="true">{ICONS[tone]}</div>
      <h1>{title}</h1>
      {children && <div className="status-body">{children}</div>}
      {actions && actions.length > 0 && (
        <div className="status-actions">
          {actions.map((a) => (
            <Link key={a.href + a.label} className={a.primary ? "btn btn-primary" : "btn btn-light"} href={a.href} prefetch={false}>
              {a.label}
            </Link>
          ))}
        </div>
      )}
      {steps && (
        <ol className="status-steps" aria-label="What happens next">
          {steps.map((s, i) => (
            <li key={s.label} className={s.done ? "done" : undefined}>
              <span>{s.done ? "✓" : i + 1}</span>{s.label}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** A signed-in page's heading row: title, short description, optional action on the right. */
export function PageHeader({ title, description, action }: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </div>
  );
}

/** Grey placeholder rows while data loads. */
export function LoadingState({ rows = 3, label = "Loading…" }: { rows?: number; label?: string }) {
  return (
    <div className="loading-state" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => <div key={i} className="skeleton" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-danger error-state" role="alert">
      <span>{message}</span>
      {onRetry && <button type="button" className="btn btn-light" onClick={onRetry}>Try again</button>}
    </div>
  );
}
