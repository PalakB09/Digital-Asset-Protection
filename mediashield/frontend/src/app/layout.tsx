"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import "./globals.css";

// ─── Theme-aware PNG Icon ─────────────────────────────────────────────────────
function NavIcon({
  name,
  isActive,
  theme,
}: {
  name: string;
  isActive: boolean;
  theme: "dark" | "light";
}) {
  const suffix = isActive
    ? theme === "dark"
      ? "Blue"
      : "Black"
    : theme === "dark"
    ? "Grey1"
    : "Grey2";

  const src = `/${name}${suffix}.png`;

  return (
    <img
      src={src}
      alt={name}
      width={18}
      height={18}
      style={{
        width: 18,
        height: 18,
        objectFit: "contain",
        flexShrink: 0,
        transition: "opacity 0.15s ease",
      }}
    />
  );
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

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("mediashield-theme") : null;
    setTheme(stored === "light" ? "light" : "dark");

    // Watch for theme changes
    const observer = new MutationObserver(() => {
      const current = document.documentElement.getAttribute("data-theme");
      setTheme(current === "light" ? "light" : "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return (
    <aside
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: 224,
        display: "flex",
        flexDirection: "column",
        zIndex: 40,
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border-subtle)",
        fontFamily: "'IBM Plex Mono', sans-serif",
      }}
    >
      {/* ── Logo ── */}
      <div
        style={{
          height: 60,
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          gap: 12,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-border)",
            flexShrink: 0,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8ec5ff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: 15.5,
            fontWeight: 700,
            color: "var(--text-primary)",
            letterSpacing: "0.02em",
            lineHeight: 1.25,
            fontFamily: "''IBM Plex Serif', monospace",
            margin: 0,
          }}>
            MediaShield
          </p>
          <p style={{
            fontSize: 10.5,
            color: "var(--text-muted)",
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: "0.06em",
            lineHeight: 1.3,
            margin: 0,
            marginTop: 1,
          }}>
            ASSET PROTECTION
          </p>
        </div>
      </div>

      {/* ── Nav ── */}
      <div
        style={{
          flex: 1,
          padding: "14px 10px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <p style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          padding: "0 10px",
          marginBottom: 8,
          marginTop: 2,
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          Navigation
        </p>

        <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            const activeColor = isActive
                ? theme === "dark" ? "#8ec5ff" : "#111111"
                : undefined;
            const activeBg = isActive
                ? theme === "dark" ? "rgba(142, 197, 255, 0.10)" : "rgba(0, 0, 0, 0.07)"
                : "transparent";
            const activeBorder = isActive
                ? theme === "dark" ? "2px solid #8ec5ff" : "2px solid #111111"
                : "2px solid transparent";

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  height: 38,
                  padding: "0 10px 0 12px",
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: isActive ? 600 : 450,
                  letterSpacing: "0.01em",
                  fontFamily: "'IBM Plex Sans', monospace",
                  color: isActive ? activeColor : "var(--text-muted)",
                  background: activeBg,
                  borderLeft: activeBorder,
                  textDecoration: "none",
                  transition: "all 0.13s ease",
                  cursor: "pointer",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.background = "var(--surface-hover)";
                    el.style.color = "var(--text-secondary)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    const el = e.currentTarget as HTMLAnchorElement;
                    el.style.background = "transparent";
                    el.style.color = "var(--text-muted)";
                  }
                }}
              >
                <NavIcon name={item.icon} isActive={isActive} theme={theme} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          padding: "12px 10px",
          borderTop: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            borderRadius: 9,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--border-subtle)",
            cursor: "pointer",
            transition: "background 0.13s ease",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.055)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(142, 197, 255, 0.12)",
              flexShrink: 0,
            }}
          >
            <span style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: "#8ec5ff",
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: "0.04em",
            }}>
              MS
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFamily: "'IBM Plex Mono', monospace",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              MediaShield
            </p>
            <p style={{
              fontSize: 9.5,
              color: "var(--text-muted)",
              fontFamily: "'IBM Plex Sans'",
              letterSpacing: "0.04em",
              margin: 0,
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              v1.0 · Active
            </p>
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
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full antialiased">
        {isLandingPage ? (
          <div className="min-h-screen relative">{children}</div>
        ) : (
          <>
            <Sidebar />
            <div
              style={{
                marginLeft: 224,
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                background: "var(--bg-primary)",
              }}
            >
              {children}
            </div>
          </>
        )}
      </body>
    </html>
  );
}