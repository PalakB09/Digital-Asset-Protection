"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./globals.css";

const navItems = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/scan", label: "Scan", icon: "🔍" },
  { href: "/assets", label: "Assets", icon: "🖼️" },
  { href: "/monitoring", label: "Monitoring", icon: "📡" },
  { href: "/violations", label: "Violations", icon: "⚠️" },
  { href: "/graph", label: "Propagation", icon: "🕸️" },
  { href: "/actions", label: "Actions", icon: "⚖️" },
  { href: "/insights", label: "Insights", icon: "📈" },
];

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
               style={{ background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))" }}>
            🛡️
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>MediaShield</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Asset Protection</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname === item.href ? "active" : ""}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="absolute bottom-6 left-6 right-6">
        <div className="card p-4" style={{ background: "rgba(108, 99, 255, 0.08)" }}>
          <p className="text-xs font-medium" style={{ color: "var(--accent-primary)" }}>MediaShield v1.0</p>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Digital Asset Protection</p>
        </div>
      </div>
    </aside>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>MediaShield — Digital Asset Protection</title>
        <meta name="description" content="Detect, track, and enforce ownership of media assets" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Sidebar />
        <main style={{ marginLeft: "260px", minHeight: "100vh", padding: "32px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
