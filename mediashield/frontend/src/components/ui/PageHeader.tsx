import { type ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({ title, subtitle, action, backHref, backLabel }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-30 bg-[var(--neu-surface)] px-6 py-6 pb-5 shadow-sm border-b border-[var(--neu-surface-lt)]">
      <div className="max-w-[1200px] mx-auto">
        {backHref && (
          <a
            href={backHref}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--neu-primary)] hover:text-[var(--neu-primary-lt)] mb-3 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            {backLabel ?? "Back"}
          </a>
        )}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-[var(--neu-text)] leading-none tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[14px] font-sans text-[var(--neu-text-muted)] mt-2 font-medium">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0 flex items-center gap-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}
