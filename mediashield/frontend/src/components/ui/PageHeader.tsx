import { type ReactNode } from "react";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  backHref?: string;
  backLabel?: string;
}

export function PageHeader({ title, subtitle, action, backHref, backLabel }: PageHeaderProps) {
  return (
    <div
      className="sticky top-0 z-30 px-8 py-5"
      style={{
        background: "rgba(11,15,23,0.85)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div className="max-w-[1200px] mx-auto">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 mb-3 transition-colors text-[12px] font-medium"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            {backLabel ?? "Back"}
          </Link>
        )}
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1
              className="leading-none font-semibold"
              style={{ fontSize: 24, color: "var(--text-primary)", letterSpacing: "-0.01em" }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
        </div>
      </div>
    </div>
  );
}
