"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./globals.css";

// ─── Nav icon set — outline stroke, 18px, 1.5px weight ─────────────
function Icon({ name, className = "" }: { name: string; className?: string }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
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
          <path d="M14.5 3.5 c0 0 2.5 2.5 2.5 5s-2.5 5-2.5 5" stroke="currentColor" />
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
  { href: "/",           label: "Dashboard",   icon: "dashboard"   },
  { href: "/scan",       label: "Scan",        icon: "scan"        },
  { href: "/assets",     label: "Assets",      icon: "assets"      },
  { href: "/monitoring", label: "Monitoring",  icon: "monitoring"  },
  { href: "/violations", label: "Violations",  icon: "violations"  },
  { href: "/graph",      label: "Propagation", icon: "propagation" },
  { href: "/actions",    label: "Actions",     icon: "actions"     },
  { href: "/insights",   label: "Insights",    icon: "insights"    },
];

// ─── Sidebar — Neumorphic Extruded ────────────────────────────────────────────
// Width: 240px, softly shadow-raised over content
function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-[240px] flex flex-col z-40 py-4"
      style={{
        background: "var(--neu-surface)",
        boxShadow: "6px 0 12px var(--neu-surface-dk), -6px 0 12px var(--neu-surface-lt)",
      }}
    >
      {/* Logo area */}
      <div className="h-[56px] flex items-center px-6 mb-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 neu-raised" style={{ color: "var(--neu-primary)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-bold text-[var(--neu-text)] leading-tight tracking-wider uppercase">MediaShield</p>
            <p className="text-[11px] font-mono text-[var(--neu-text-muted)] leading-tight uppercase">Asset Protection</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 neu-divider mb-4" />

      {/* Navigation */}
      <div className="px-3 mb-1 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--neu-text-faint)] px-3 mb-3">
          Navigation
        </p>
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  relative flex items-center gap-3 h-10 px-3 mx-2 rounded-[10px] text-[13px] font-bold tracking-wide uppercase
                  transition-all duration-200 select-none
                  ${isActive
                    ? "neu-inset text-[var(--neu-primary)]"
                    : "text-[var(--neu-text-muted)] hover:text-[var(--neu-text)] hover:shadow-[var(--neu-shadow-xs)]"
                  }
                `}
              >
                {/* Active indicator dot (instead of left border in neumo) */}
                {isActive && (
                  <span
                    className="absolute left-[6px] w-[6px] h-[6px] rounded-full"
                    style={{ background: "var(--neu-primary)", boxShadow: "0 0 4px var(--neu-primary-lt)" }}
                  />
                )}
                <div className={isActive ? "ml-2" : "ml-0"}>
                  <Icon
                    name={item.icon}
                    className={isActive ? "text-[var(--neu-primary)]" : "text-[var(--neu-text-faint)]"}
                  />
                </div>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom divider */}
      <div className="mx-5 neu-divider mt-4 mb-4" />

      {/* User section — bottom pinned */}
      <div className="px-5 pb-2">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl neu-raised transition-all duration-200 group cursor-pointer hover:shadow-[var(--neu-inset-xs)]">
          <div className="w-8 h-8 rounded-full neu-inset flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-[var(--neu-primary)]">MS</span>
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[var(--neu-text)] truncate uppercase tracking-wide">MediaShield</p>
            <p className="text-[10px] font-mono text-[var(--neu-text-muted)] truncate">Admin Account</p>
          </div>
        </div>

        {/* Version card */}
        <div className="mt-4 px-3 py-2 neu-inset-sm rounded-lg text-center">
          <p className="text-[10px] font-mono font-bold text-[var(--neu-text-faint)]">v1.0 · Active</p>
        </div>
      </div>
    </aside>
  );
}

// ─── Root Layout ──────────────────────────────────────────────────────────────
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <head>
        <title>MediaShield — Neumorphism System</title>
        <meta name="description" content="Detect, track, and enforce ownership of your media assets across the web." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Fonts are loaded in globals.css per Neumorphism config */}
      </head>
      <body className="h-full antialiased">
        <Sidebar />
        {/* Main content area — offset by sidebar width, scrolls independently */}
        <div className="ml-[240px] min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
