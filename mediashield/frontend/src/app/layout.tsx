"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import "./globals.css";

// ─── Nav icon set ────────────────────────────────────────────────
function Icon({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const props = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    style,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" />
        </svg>
      );
    case "scan":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" stroke="currentColor" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" />
        </svg>
      );
    case "assets":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
          <path d="m21 15-5-5L5 21" stroke="currentColor" />
        </svg>
      );
    case "monitoring":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" />
          <circle cx="12" cy="12" r="4" stroke="currentColor" />
          <line x1="12" y1="3" x2="12" y2="8" stroke="currentColor" />
        </svg>
      );
    case "violations":
      return (
        <svg {...props}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" />
          <line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" />
          <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" />
        </svg>
      );
    case "propagation":
      return (
        <svg {...props}>
          <circle cx="5" cy="12" r="2" stroke="currentColor" />
          <circle cx="19" cy="5" r="2" stroke="currentColor" />
          <circle cx="19" cy="19" r="2" stroke="currentColor" />
          <line x1="7" y1="12" x2="17" y2="6" stroke="currentColor" />
          <line x1="7" y1="12" x2="17" y2="18" stroke="currentColor" />
        </svg>
      );
    case "actions":
      return (
        <svg {...props}>
          <path d="m9 9-6 6 3 3 6-6" stroke="currentColor" />
          <path d="m18 3 3 3-9 9-4-4" stroke="currentColor" />
        </svg>
      );
    case "insights":
      return (
        <svg {...props}>
          <line x1="18" y1="20" x2="18" y2="10" stroke="currentColor" />
          <line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" />
          <line x1="6" y1="20" x2="6" y2="14" stroke="currentColor" />
        </svg>
      );
    default:
      return <svg {...props}><circle cx="12" cy="12" r="9" stroke="currentColor" /></svg>;
  }
}

// ─── Nav items ────────────────────────────────────────────────────────────────
const navItems = [
  { href: "/dashboard",  label: "Dashboard",   icon: "dashboard"   },
  { href: "/scan",       label: "Scan",        icon: "scan"        },
  { href: "/assets",     label: "Assets",      icon: "assets"      },
  { href: "/monitoring", label: "Monitoring",  icon: "monitoring"  },
  { href: "/violations", label: "Violations",  icon: "violations"  },
  { href: "/graph",      label: "Propagation", icon: "propagation" },
  { href: "/actions",    label: "Actions",     icon: "actions"     },
  { href: "/insights",   label: "Insights",    icon: "insights"    },
];

// ─── Sidebar — Zed-inspired dark ──────────────────────────────────────────────
function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[220px] flex flex-col z-40"
      style={{
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      {/* Logo */}
      <div className="h-[56px] flex items-center px-5 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-border)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--text-primary)", letterSpacing: "0.01em" }}>MediaShield</p>
            <p className="text-[10px] leading-tight font-mono" style={{ color: "var(--text-muted)" }}>Asset Protection</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[10px] font-medium uppercase tracking-[0.12em] px-2 mb-3" style={{ color: "var(--text-muted)" }}>
          Navigation
        </p>
        <nav className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex items-center gap-2.5 h-9 px-3 rounded-[8px] text-[13px] font-medium transition-all select-none"
                style={{
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                  background: isActive ? "color-mix(in srgb, var(--accent-primary) 18%, transparent)" : "transparent",
                  borderLeft: isActive ? `2px solid var(--accent-primary)` : "2px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    const el = e.currentTarget;
                    el.style.background = "var(--surface-hover)";
                    el.style.color = "var(--text-secondary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    const el = e.currentTarget;
                    el.style.background = "transparent";
                    el.style.color = "var(--text-muted)";
                  }
                }}
              >
                <Icon
                  name={item.icon}
                  className={isActive ? "" : ""}
                  style={ {color: isActive ? "var(--accent-primary)" : "var(--text-muted)" } as React.CSSProperties}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="px-3 py-4 shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-subtle)" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--accent-soft)" }}
          >
            <span className="text-[10px] font-semibold" style={{ color: "var(--accent-primary)" }}>MS</span>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-medium truncate" style={{ color: "var(--text-primary)" }}>MediaShield</p>
            <p className="text-[10px] font-mono truncate" style={{ color: "var(--text-muted)" }}>v1.0 · Active</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("mediashield-theme") : null;
    const initial = stored === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  return (
    <html lang="en" className="h-full">
      <head>
        <title>MediaShield — Digital Asset Protection</title>
        <meta name="description" content="Detect, track, and enforce ownership of your media assets across the web." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="h-full antialiased">
        {isLandingPage ? (
          <div className="min-h-screen relative">{children}</div>
        ) : (
          <>
            <Sidebar />
            <div className="ml-[220px] min-h-screen flex flex-col" style={{ background: "var(--bg-primary)" }}>
              {children}
            </div>
          </>
        )}
      </body>
    </html>
  );
}
