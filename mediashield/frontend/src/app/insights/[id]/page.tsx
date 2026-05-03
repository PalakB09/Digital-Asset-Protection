"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { getAsset, getAssetInsights, type Asset, type InsightsData } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg: "#0D0F12",
  surface: "#13161B",
  surfaceSide: "#0F1115",
  border: "#1E2228",
  borderHover: "rgba(59,130,246,0.4)",
  muted: "#b0baceff",
  secondary: "#cdd3dcff",
  primary: "#F9FAFB",
  accent: "#3B82F6",
  danger: "#DC2626",
  dangerBg: "rgba(220,38,38,0.10)",
  warning: "#D97706",
  warningBg: "rgba(217,119,6,0.10)",
  success: "#16A34A",
  successBg: "rgba(22,163,74,0.10)",
} as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}
function riskColor(score: number) {
  if (score >= 7) return T.danger;
  if (score >= 4) return T.warning;
  return T.success;
}
function riskBg(score: number) {
  if (score >= 7) return T.dangerBg;
  if (score >= 4) return T.warningBg;
  return T.successBg;
}
function riskLabel(score: number) {
  if (score >= 7) return "Critical";
  if (score >= 4) return "High";
  return "Low";
}
const accelColor: Record<string, string> = {
  ACCELERATING: T.danger,
  STABLE: T.warning,
  DECLINING: T.success,
  UNKNOWN: T.muted,
};
const exposureColor: Record<string, string> = {
  VIRAL: T.danger,
  HIGH: T.warning,
  MODERATE: T.accent,
  LOW: T.success,
  UNKNOWN: T.muted,
};

// ─── Export logic ──────────────────────────────────────────────────────────────
function buildExportCSV(asset: Asset | null, insights: InsightsData): string {
  const rows: string[][] = [];
  const push = (label: string, value: string | number | null | undefined) =>
    rows.push([label, String(value ?? "—")]);

  rows.push(["MediaShield — Asset Insights Report"]);
  rows.push(["Generated", new Date().toLocaleString()]);
  rows.push([]);
  rows.push(["ASSET"]);
  push("Name", asset?.name);
  push("ID", asset?.id);
  push("Created", fmtDate(asset?.created_at));
  rows.push([]);
  rows.push(["THREAT SUMMARY"]);
  push("Composite Threat Score", insights.composite_threat_score);
  push("Risk Level", riskLabel(insights.composite_threat_score ?? 0));
  push("Total Violations", insights.total_violations);
  push("Highest Threat Platform", insights.highest_threat_platform);
  rows.push([]);
  rows.push(["VELOCITY"]);
  const vel = insights.velocity ?? {};
  push("Violations / Day", (vel.violations_per_day ?? 0).toFixed(1));
  push("Last 7 Days", vel.last_7d_count);
  push("Last 30 Days", vel.last_30d_count);
  push("Days Active", vel.days_active);
  push("Acceleration", vel.acceleration);
  push("First Seen", fmtDate(vel.first_seen));
  push("Last Seen", fmtDate(vel.last_seen));
  rows.push([]);
  rows.push(["ENGAGEMENT"]);
  const eng = insights.engagement_risk ?? {};
  push("Total Estimated Views", eng.total_estimated_views);
  push("Total Estimated Likes", eng.total_estimated_likes);
  push("Avg Views / Violation", eng.avg_views_per_violation);
  push("Peak Violation Views", eng.max_single_violation_views);
  push("Exposure Tier", eng.exposure_tier);
  rows.push([]);
  rows.push(["PLATFORM BREAKDOWN"]);
  rows.push(["Platform", "Violations", "Views", "Avg Confidence", "Match Type"]);
  (insights.platform_breakdown ?? []).forEach((p) =>
    rows.push([p.platform, String(p.violation_count), String(p.total_views), p.avg_confidence.toFixed(2), p.dominant_match_type])
  );
  rows.push([]);
  rows.push(["AI ANALYSIS"]);
  const ai = insights.ai_analysis ?? {};
  push("Primary Intent", (ai.primary_intent ?? "").replace(/_/g, " "));
  push("Risk Score", ai.risk_score);
  push("Summary", ai.ai_summary?.replace(/,/g, ";"));
  rows.push([]);
  rows.push(["WATERMARK FORENSICS"]);
  const wm = insights.watermark_forensics ?? {};
  push("Attributed Violations", wm.attributed_violation_count);
  push("Traced to Recipient", wm.traced_to_recipient_count);
  push("Attribution Rate", `${wm.attribution_rate_pct ?? 0}%`);

  return rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function triggerCSVDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Panel ─────────────────────────────────────────────────────────────────────
function Panel({
  children, style = {}, sidebar = false, accentTop,
}: { children: React.ReactNode; style?: React.CSSProperties; sidebar?: boolean; accentTop?: string }) {
  return (
    <div style={{
      background: sidebar ? T.surfaceSide : T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      position: "relative",
      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      ...style,
    }}>
      {accentTop && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accentTop, borderRadius: "12px 12px 0 0" }} />
      )}
      {children}
    </div>
  );
}

// ─── Section heading ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: "rgba(59,130,246,0.6)", flexShrink: 0 }} />
      <p style={{
      fontSize: 11,
      fontWeight: 700,
      fontFamily: "'IBM Plex Mono', monospace",
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "#7a8ba8",
      margin: 0,
    }}>
      {children}
    </p>
    </div>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accentLeft, badge }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accentLeft?: string;
  badge?: { text: string; color: string; bg: string };
}) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 10,
      borderLeft: accentLeft ? `3px solid ${accentLeft}` : undefined,
      padding: "20px 22px",
      display: "flex",
      flexDirection: "column",
      gap: 6,
    }}>
      <p style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: T.muted,
        margin: 0,
        fontFamily: "'IBM Plex Mono', monospace",
      }}>{label}</p>
      <p style={{
        fontSize: 38,
        fontWeight: 300,
        color: T.primary,
        lineHeight: 1,
        margin: 0,
        fontFamily: "var(--font-display)",
      }}>{value}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        {sub && <p style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted, margin: 0 }}>{sub}</p>}
        {badge && <Chip text={badge.text} color={badge.color} bg={badge.bg} />}
      </div>
    </div>
  );
}

// ─── Mini stat ─────────────────────────────────────────────────────────────────
function MiniStat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 72 }}>
      <p style={{ fontSize: 26, fontWeight: 300, color: color ?? T.primary, lineHeight: 1, fontFamily: "var(--font-display)", margin: 0 }}>{value}</p>
      <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: T.muted, marginTop: 6, margin: "6px 0 0", fontFamily: "'IBM Plex Mono', monospace" }}>{label}</p>
    </div>
  );
}

// ─── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ height: 3, borderRadius: 2, background: T.border, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 600ms ease" }} />
    </div>
  );
}

// ─── Chip ──────────────────────────────────────────────────────────────────────
function Chip({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 4,
      background: bg,
      color,
      letterSpacing: "0.06em",
      whiteSpace: "nowrap",
      fontFamily: "'IBM Plex Mono', monospace",
      textTransform: "uppercase",
    }}>
      {text}
    </span>
  );
}

// ─── Timeline ──────────────────────────────────────────────────────────────────
const severityDot: Record<"red" | "amber" | "blue" | "green", string> = {
  red: T.danger, amber: T.warning, blue: T.accent, green: T.success,
};

function TimelineEvent({ label, timestamp, severity, isLast }: {
  label: string; timestamp: string; severity: "red" | "amber" | "blue" | "green"; isLast: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: severityDot[severity], boxShadow: `0 0 6px ${severityDot[severity]}`, marginTop: 4, flexShrink: 0 }} />
        {!isLast && <div style={{ width: 1, flex: 1, background: `linear-gradient(to bottom, ${T.accent}60, ${T.border})`, marginTop: 4, marginBottom: 4 }} />}
      </div>
      <div style={{ paddingBottom: isLast ? 0 : 18 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: T.primary, lineHeight: 1.3, margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: T.muted, marginTop: 3 }}>{timestamp}</p>
      </div>
    </div>
  );
}

// ─── Platform row ──────────────────────────────────────────────────────────────
const platformColors: Record<string, { bg: string; text: string }> = {
  telegram: { bg: "rgba(91,85,218,0.15)", text: "#8B83F7" },
  twitter: { bg: "rgba(29,161,242,0.15)", text: "#38B2F4" },
  youtube: { bg: "rgba(255,0,0,0.12)", text: "#FF5F57" },
  reddit: { bg: "rgba(255,86,0,0.12)", text: "#FF6314" },
  facebook: { bg: "rgba(24,119,242,0.12)", text: "#1877F2" },
};
function getPlatformStyle(p: string) {
  return platformColors[p.toLowerCase()] ?? { bg: "rgba(255,255,255,0.06)", text: T.secondary };
}

function PlatformRow({ platform, count, views, confidence, matchType, isLast }: {
  platform: string; count: number; views: number; confidence: number; matchType: string; isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const ps = getPlatformStyle(platform);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: isLast ? "none" : `1px solid ${T.border}`, borderLeft: `2px solid ${hovered ? T.borderHover : "transparent"}`, transition: "border-color 150ms ease" }}
    >
      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 4, background: ps.bg, color: ps.text, minWidth: 72, textAlign: "center", flexShrink: 0, textTransform: "capitalize", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.04em" }}>
        {platform}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
          <p style={{ fontSize: 13, color: T.primary, margin: 0 }}>{count} violation{count !== 1 ? "s" : ""}</p>
          <p style={{ fontSize: 12, fontFamily: "'IBM Plex Mono', monospace", color: T.muted, margin: 0 }}>{fmtViews(views)} views</p>
        </div>
        <ProgressBar value={confidence} max={1} color={ps.text} />
      </div>
      <span style={{ fontSize: 11, color: T.muted, flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace" }}>
        {matchType}
      </span>
    </div>
  );
}

// ─── Leaker row ────────────────────────────────────────────────────────────────
function LeakerRow({ name, count, isRecipient, isLast }: {
  name: string; count: number; isRecipient: boolean; isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const initials = name.split(/[\s@._-]+/).map((w) => w[0]?.toUpperCase()).filter(Boolean).slice(0, 2).join("");
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: isLast ? "none" : `1px solid ${T.border}`, borderLeft: `2px solid ${hovered ? T.borderHover : "transparent"}`, transition: "border-color 150ms ease" }}
    >
      <div style={{ width: 34, height: 34, borderRadius: "50%", background: isRecipient ? T.dangerBg : "rgba(59,130,246,0.15)", border: `1px solid ${isRecipient ? T.danger : "rgba(59,130,246,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12, fontWeight: 600, color: isRecipient ? T.danger : T.accent, fontFamily: "'IBM Plex Mono', monospace" }}>
        {initials || "?"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 500, color: T.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{name}</p>
        <p style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: T.muted, marginTop: 2, margin: "2px 0 0" }}>{count} violation{count !== 1 ? "s" : ""} linked</p>
      </div>
      {isRecipient && <Chip text="Recipient" color={T.danger} bg={T.dangerBg} />}
      <p style={{ fontSize: 15, fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace", color: count >= 3 ? T.danger : count === 2 ? T.warning : T.muted, minWidth: 24, textAlign: "right", flexShrink: 0, margin: 0 }}>
        ×{count}
      </p>
    </div>
  );
}

// ─── Watermark row ─────────────────────────────────────────────────────────────
function WatermarkRow({ item, isLast }: {
  item: { violation_id: string; watermark_id: string; recipient_name: string; recipient_identifier: string | null; platform: string; source_url: string; detected_at: string | null };
  isLast: boolean;
}) {
  return (
    <div style={{ padding: "13px 20px", borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: T.primary, margin: 0 }}>{item.recipient_name}</p>
          {item.recipient_identifier && (
            <p style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: T.muted, marginTop: 2, margin: "2px 0 0" }}>{item.recipient_identifier}</p>
          )}
          <p style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "#5a6e8a", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: "4px 0 0" }}>
            wm: {item.watermark_id}
          </p>
        </div>
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <Chip text={item.platform} color={getPlatformStyle(item.platform).text} bg={getPlatformStyle(item.platform).bg} />
          <p style={{ fontSize: 10, color: T.muted, marginTop: 4, fontFamily: "'IBM Plex Mono', monospace", margin: "4px 0 0" }}>{fmtDateShort(item.detected_at)}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Action row ────────────────────────────────────────────────────────────────
function ActionRow({ n, label, desc, cta, href, isLast }: {
  n: string; label: string; desc: string; cta: string; href: string; isLast: boolean;
}) {
  return (
    <div style={{ padding: "16px 20px", borderBottom: isLast ? "none" : `1px solid ${T.border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.accent, fontFamily: "'IBM Plex Mono', monospace", lineHeight: "20px", flexShrink: 0, letterSpacing: "0.06em" }}>{n}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: T.primary, marginBottom: 4, margin: "0 0 4px" }}>{label}</p>
          <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 10, margin: "0 0 10px" }}>{desc}</p>
          <Link href={href}><ActionButton>{cta}</ActionButton></Link>
        </div>
      </div>
    </div>
  );
}

function ActionButton({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ height: 28, padding: "0 12px", fontSize: 11, fontWeight: 600, borderRadius: 5, border: `1px solid ${hovered ? T.accent : T.border}`, background: hovered ? "rgba(59,130,246,0.10)" : "transparent", color: hovered ? T.accent : T.secondary, cursor: "pointer", transition: "all 150ms ease", outline: "none", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.04em" }}>
      {children}
    </button>
  );
}

// ─── Export button ─────────────────────────────────────────────────────────────
function ExportBtn({ asset, insights }: { asset: Asset | null; insights: InsightsData | null }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [hovered, setHovered] = useState(false);

  function handleExport() {
    if (!insights) return;
    setState("loading");
    setTimeout(() => {
      const csv = buildExportCSV(asset, insights);
      const slug = (asset?.name ?? "asset").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
      const date = new Date().toISOString().slice(0, 10);
      triggerCSVDownload(csv, `mediashield_report_${slug}_${date}.csv`);
      setState("done");
      setTimeout(() => setState("idle"), 2200);
    }, 320);
  }

  const isIdle = state === "idle";
  const isDone = state === "done";
  const isLoading = state === "loading";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={handleExport}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={!isIdle || !insights}
        style={{
          width: "100%",
          height: 46,
          fontSize: 12,
          fontWeight: 700,
          borderRadius: 10,
          border: isDone
            ? `1px solid rgba(22,163,74,0.5)`
            : `1px solid ${hovered && isIdle ? "rgba(59,130,246,0.8)" : "rgba(59,130,246,0.35)"}`,
          background: isDone
            ? "rgba(22,163,74,0.10)"
            : isLoading
            ? "rgba(59,130,246,0.55)"
            : hovered
            ? "rgba(59,130,246,0.22)"
            : "rgba(59,130,246,0.12)",
          color: isDone ? T.success : isLoading ? "rgba(255,255,255,0.7)" : hovered ? "#fff" : "rgba(147,197,253,1)",
          cursor: isIdle ? "pointer" : "default",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "all 200ms ease",
          outline: "none",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: "'IBM Plex Mono', monospace",
          boxShadow: hovered && isIdle ? "0 0 20px rgba(59,130,246,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" : "inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        {isLoading ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 0.9s linear infinite" }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : isDone ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
        {isLoading ? "Preparing…" : isDone ? "Downloaded ✓" : "Export Full Report"}
      </button>
      <p style={{ fontSize: 10, color: "#5a6880", textAlign: "center", margin: "7px 0 0", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.04em" }}>
        CSV · includes all metrics &amp; AI analysis
      </p>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[0, 1, 2, 3].map(i => <Skeleton key={i} className="rounded" style={{ height: 120 }} />)}
          </div>
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className="rounded" style={{ height: 140 }} />)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton className="rounded" style={{ height: 260 }} />
          <Skeleton className="rounded" style={{ height: 320 }} />
          <Skeleton className="rounded" style={{ height: 44 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Page header ───────────────────────────────────────────────────────────────
function PageTop({ asset, insights }: { asset: Asset | null; insights: InsightsData | null }) {
  const ext = asset?.name?.split(".").pop()?.toUpperCase() ?? "ASSET";
  const generatedAt = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div style={{
      padding: "20px 40px",
      background: `linear-gradient(180deg, rgba(19,22,27,1) 0%, ${T.bg} 100%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      borderBottom: `1px solid ${T.border}`,
      position: "relative",
    }}>
      {/* subtle top accent line */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, rgba(59,130,246,0.4) 0%, transparent 60%)" }} />

      <div>
        <Link
          href="/insights"
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#5a6e8a", textDecoration: "none", marginBottom: 10, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.06em", transition: "color 150ms" }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
          Insights
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <h1 style={{
            fontSize: 30,
            fontWeight: 300,
            color: "oklch(0.809 0.105 251.813)",
            fontFamily: "var(--font-display)",
            lineHeight: 1.2,
            margin: 0,
            letterSpacing: "-0.02em",
          }}>
            {asset?.name ?? "Asset Insights"}
          </h1>
          {asset && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace",
              padding: "2px 8px",
              borderRadius: 4,
              background: "rgba(59,130,246,0.12)",
              border: "1px solid rgba(59,130,246,0.25)",
              color: "#3B82F6",
              letterSpacing: "0.1em",
            }}>
              .{ext}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <p style={{ fontSize: 12, color: "#6b7e9a", margin: 0, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.02em" }}>
            AI-powered threat analysis &amp; leaker profiling
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 20, background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.success, boxShadow: `0 0 5px ${T.success}` }} />
            <span style={{ fontSize: 10, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: "#4ade80", letterSpacing: "0.06em" }}>
              Report generated · {generatedAt}
            </span>
          </div>
        </div>
      </div>

      {/* Header-level export */}
      <div style={{ flexShrink: 0, minWidth: 200 }}>
        <ExportBtn asset={asset} insights={insights} />
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function AssetInsightDetailPage() {
  const params = useParams();
  const assetId = params.id as string;
  const [asset, setAsset] = useState<Asset | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;
    Promise.all([getAsset(assetId), getAssetInsights(assetId)])
      .then(([a, ins]) => { setAsset(a); setInsights(ins); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [assetId]);

  if (loading) return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <PageTop asset={null} insights={null} />
      <LoadingSkeleton />
    </div>
  );

  if (error || !insights || insights.total_violations === 0) {
    const msg = error ?? "No insights available yet.";
    const sub = error ? "Check that the backend is reachable." : "Run a scan to generate AI insights for this asset.";
    return (
      <div style={{ background: T.bg, minHeight: "100vh" }}>
        <PageTop asset={asset} insights={null} />
        <div style={{ padding: "48px 40px", maxWidth: 600, margin: "0 auto" }}>
          <Panel style={{ padding: 36, textAlign: "center" }}>
            <span style={{ fontSize: 22, display: "block", marginBottom: 14 }}>⚠</span>
            <p style={{ fontSize: 15, fontWeight: 500, color: T.primary, marginBottom: 8, margin: "0 0 8px" }}>{msg}</p>
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 24, lineHeight: 1.6, margin: "0 0 24px" }}>{sub}</p>
            <Link href="/scan">
              <button style={{ height: 38, padding: "0 22px", fontSize: 12, fontWeight: 600, borderRadius: 6, border: "none", background: T.accent, color: "#fff", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.04em" }}>
                Scan Now
              </button>
            </Link>
          </Panel>
        </div>
      </div>
    );
  }

  // ── Destructure ──────────────────────────────────────────────────────────────
  const score = insights.composite_threat_score ?? 0;
  const vel = insights.velocity ?? {};
  const engagement = insights.engagement_risk ?? {};
  const platforms = insights.platform_breakdown ?? [];
  const matchQ = insights.match_quality ?? {};
  const leakerProfile = insights.leaker_profile ?? {};
  const wmForensics = insights.watermark_forensics ?? {};
  const ai = insights.ai_analysis ?? {};
  const mediaInfo = insights.media_info ?? {};
  const stages = insights.detection_stages ?? {};
  const ssim = matchQ.ssim_alteration ?? {};

  const timelineEvents = [
    vel.first_seen && { label: "First violation detected", timestamp: fmtDate(vel.first_seen), severity: "amber" as const },
    vel.last_7d_count > 0 && { label: `${vel.last_7d_count} violations in last 7 days`, timestamp: vel.acceleration === "ACCELERATING" ? "⚠ Trend accelerating" : "Stable trend", severity: vel.acceleration === "ACCELERATING" ? "red" as const : "blue" as const },
    wmForensics.traced_to_recipient_count > 0 && { label: `${wmForensics.traced_to_recipient_count} traced to recipients`, timestamp: "Watermark attribution", severity: "red" as const },
    vel.last_seen && { label: `${insights.total_violations} total violations confirmed`, timestamp: fmtDate(vel.last_seen), severity: "red" as const },
  ].filter(Boolean) as { label: string; timestamp: string; severity: "red" | "amber" | "blue" | "green" }[];

  if (timelineEvents.length === 0) {
    timelineEvents.push({ label: "Asset registered", timestamp: asset ? fmtDate(asset.created_at) : "—", severity: "blue" });
    timelineEvents.push({ label: `${insights.total_violations} violations confirmed`, timestamp: "Latest scan", severity: "red" });
  }

  const actions = [
    { n: "01", label: "Send DMCA Takedown", desc: "Issue a formal DMCA notice to hosting platforms for all detected violations.", cta: "Send DMCA", href: "/actions" },
    { n: "02", label: "Run Full Platform Scan", desc: "Trigger a discovery sweep across Twitter, YouTube, Telegram, and Google.", cta: "Scan now", href: "/scan" },
    { n: "03", label: "Review Propagation Graph", desc: "Explore the visual spread map to identify highest-risk distribution paths.", cta: "View graph", href: "/graph" },
  ];

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <PageTop asset={asset} insights={insights} />

      <div style={{ padding: "32px 40px 60px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28, alignItems: "start" }}>

          {/* ── LEFT COLUMN ──────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>

            {/* 1. Threat Analysis */}
            <section>
              <SectionLabel>Threat Analysis</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <StatCard
                  label="Composite Threat Score"
                  accentLeft={riskColor(score)}
                  value={<><span style={{ fontSize: 38, fontWeight: 300, color: riskColor(score) }}>{score.toFixed(1)}</span><span style={{ fontSize: 17, color: T.muted, fontWeight: 300, marginLeft: 2 }}>/10</span></>}
                  badge={{ text: riskLabel(score), color: riskColor(score), bg: riskBg(score) }}
                />
                <StatCard
                  label="Estimated Reach"
                  value={<span style={{ color: T.accent }}>{fmtViews(engagement.total_estimated_views ?? 0)}</span>}
                  sub="Estimated views"
                  badge={engagement.exposure_tier ? { text: engagement.exposure_tier, color: exposureColor[engagement.exposure_tier] ?? T.muted, bg: "rgba(255,255,255,0.06)" } : undefined}
                />
                <StatCard
                  label="Total Violations"
                  value={insights.total_violations}
                  sub={`${vel.days_active ?? 0} days active`}
                  badge={vel.acceleration ? { text: vel.acceleration, color: accelColor[vel.acceleration] ?? T.muted, bg: "rgba(255,255,255,0.06)" } : undefined}
                />
                <StatCard
                  label="Top Threat Platform"
                  value={<span style={{ fontSize: 26, fontWeight: 400, textTransform: "capitalize", color: T.primary }}>{insights.highest_threat_platform ?? "—"}</span>}
                  sub="Highest exposure"
                />
              </div>
            </section>

            {/* 2. Spread Velocity */}
            <section>
              <SectionLabel>Spread Velocity</SectionLabel>
              <Panel accentTop={`linear-gradient(90deg, ${T.accent}80, transparent)`} style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <MiniStat label="Violations / Day" value={(vel.violations_per_day ?? 0).toFixed(1)} color={T.accent} />
                  <MiniStat label="Last 7 Days" value={vel.last_7d_count ?? 0} color={vel.last_7d_count > 5 ? T.danger : T.warning} />
                  <MiniStat label="Last 30 Days" value={vel.last_30d_count ?? 0} color={T.primary} />
                  <div style={{ flex: 1, minWidth: 160, paddingTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <p style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, fontFamily: "'IBM Plex Mono', monospace" }}>First detected</p>
                      <p style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: T.secondary, margin: 0 }}>{fmtDateShort(vel.first_seen)}</p>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <p style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, fontFamily: "'IBM Plex Mono', monospace" }}>Last detected</p>
                      <p style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: T.secondary, margin: 0 }}>{fmtDateShort(vel.last_seen)}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <p style={{ fontSize: 11, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: 0, fontFamily: "'IBM Plex Mono', monospace" }}>Trend</p>
                      <Chip
                        text={vel.acceleration ?? "UNKNOWN"}
                        color={accelColor[vel.acceleration ?? "UNKNOWN"] ?? T.muted}
                        bg="rgba(255,255,255,0.06)"
                      />
                    </div>
                  </div>
                </div>
              </Panel>
            </section>

            {/* 3. Platform Breakdown */}
            {platforms.length > 0 && (
              <section>
                <SectionLabel>Platform Breakdown</SectionLabel>
                <Panel style={{ overflow: "hidden", padding: 0 }}>
                  <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.02)" }}>
                    <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "#6b7a96", textTransform: "uppercase", letterSpacing: "0.1em" }}>Platform</span>
                    <div style={{ display: "flex", gap: 48, marginRight: 8 }}>
                      <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "#6b7a96", textTransform: "uppercase", letterSpacing: "0.1em" }}>Violations</span>
                      <span style={{ fontSize: 10, fontFamily: "'IBM Plex Mono', monospace", color: "#6b7a96", textTransform: "uppercase", letterSpacing: "0.1em" }}>Match</span>
                    </div>
                  </div>
                  {platforms.map((p, i) => (
                    <PlatformRow
                      key={p.platform}
                      platform={p.platform}
                      count={p.violation_count}
                      views={p.total_views}
                      confidence={p.avg_confidence}
                      matchType={p.dominant_match_type}
                      isLast={i === platforms.length - 1}
                    />
                  ))}
                </Panel>
              </section>
            )}

            {/* 4. Signal Quality */}
            <section>
              <SectionLabel>Signal Quality</SectionLabel>
              <Panel accentTop={`linear-gradient(90deg, ${T.warning}70, transparent)`} style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
                  {Object.entries(matchQ.match_tier_counts ?? {}).map(([tier, cnt]) => (
                    <div key={tier} style={{ background: tier === "HIGH" ? T.dangerBg : T.warningBg, border: `1px solid ${tier === "HIGH" ? "rgba(220,38,38,0.3)" : "rgba(217,119,6,0.3)"}`, borderRadius: 8, padding: "10px 18px", textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 300, color: tier === "HIGH" ? T.danger : T.warning, fontFamily: "var(--font-display)", lineHeight: 1, margin: 0 }}>{cnt as number}</p>
                      <p style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 5, margin: "5px 0 0", fontFamily: "'IBM Plex Mono', monospace" }}>{tier} tier</p>
                    </div>
                  ))}
                  {Object.entries(matchQ.match_type_counts ?? {}).map(([type, cnt]) => (
                    <div key={type} style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 8, padding: "10px 18px", textAlign: "center" }}>
                      <p style={{ fontSize: 22, fontWeight: 300, color: T.accent, fontFamily: "var(--font-display)", lineHeight: 1, margin: 0 }}>{cnt as number}</p>
                      <p style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 5, margin: "5px 0 0", fontFamily: "'IBM Plex Mono', monospace" }}>{type}</p>
                    </div>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
                  <div>
                    <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: T.muted, marginBottom: 10, margin: "0 0 10px", fontFamily: "'IBM Plex Mono', monospace" }}>pHash Distance</p>
                    <p style={{ fontSize: 12, color: T.secondary, marginBottom: 5, margin: "0 0 5px" }}>Identical: <span style={{ color: T.primary, fontFamily: "'IBM Plex Mono', monospace" }}>{matchQ.phash?.identical_count ?? 0}</span></p>
                    <p style={{ fontSize: 12, color: T.secondary, marginBottom: 5, margin: "0 0 5px" }}>Very similar: <span style={{ color: T.primary, fontFamily: "'IBM Plex Mono', monospace" }}>{matchQ.phash?.very_similar_count ?? 0}</span></p>
                    <p style={{ fontSize: 12, color: T.secondary, margin: 0 }}>Similar: <span style={{ color: T.primary, fontFamily: "'IBM Plex Mono', monospace" }}>{matchQ.phash?.similar_count ?? 0}</span></p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: T.muted, marginBottom: 10, margin: "0 0 10px", fontFamily: "'IBM Plex Mono', monospace" }}>CLIP Similarity</p>
                    <p style={{ fontSize: 28, fontWeight: 300, color: T.accent, fontFamily: "var(--font-display)", lineHeight: 1, marginBottom: 6, margin: "0 0 6px" }}>
                      {((matchQ.clip_similarity?.avg ?? 0) * 100).toFixed(0)}%
                    </p>
                    <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>avg · <span style={{ color: T.primary }}>{matchQ.clip_similarity?.above_0_92_count ?? 0}</span> above 92%</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: T.muted, marginBottom: 10, margin: "0 0 10px", fontFamily: "'IBM Plex Mono', monospace" }}>Watermark</p>
                    <p style={{ fontSize: 28, fontWeight: 300, color: matchQ.watermark_verified_count > 0 ? T.success : T.muted, fontFamily: "var(--font-display)", lineHeight: 1, marginBottom: 6, margin: "0 0 6px" }}>
                      {matchQ.watermark_verified_count ?? 0}
                    </p>
                    <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>verified · {matchQ.watermark_verified_pct ?? 0}%</p>
                  </div>
                </div>
                {(ssim.available ?? 0) > 0 && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
                    <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: T.muted, marginBottom: 14, margin: "0 0 14px", fontFamily: "'IBM Plex Mono', monospace" }}>Visual Alteration (SSIM)</p>
                    <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                      <MiniStat label="Near-identical" value={ssim.near_identical_count ?? 0} color={T.success} />
                      <MiniStat label="Mildly altered" value={ssim.mildly_altered_count ?? 0} color={T.warning} />
                      <MiniStat label="Heavily altered" value={ssim.heavily_altered_count ?? 0} color={T.danger} />
                      <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, flex: 1, minWidth: 180, margin: 0 }}>
                        Avg SSIM: <span style={{ color: T.primary, fontFamily: "'IBM Plex Mono', monospace" }}>{((matchQ.ssim_alteration?.avg_ssim ?? 0) * 100).toFixed(0)}%</span>.
                        {" "}{ssim.heavily_altered_count > 0 ? "Content may have been cropped, re-encoded, or colour-graded to evade detection." : "Most copies appear visually close to the original."}
                      </p>
                    </div>
                  </div>
                )}
              </Panel>
            </section>

            {/* 5. Watermark Forensics */}
            {(wmForensics.attributed_violation_count ?? 0) > 0 && (
              <section>
                <SectionLabel>Watermark Forensics</SectionLabel>
                <Panel style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 28, flexWrap: "wrap" }}>
                    <MiniStat label="Attributed" value={wmForensics.attributed_violation_count} color={T.accent} />
                    <MiniStat label="Traced to Recipient" value={wmForensics.traced_to_recipient_count} color={wmForensics.traced_to_recipient_count > 0 ? T.danger : T.muted} />
                    <MiniStat label="Attribution Rate" value={`${wmForensics.attribution_rate_pct ?? 0}%`} color={T.primary} />
                  </div>
                  {(wmForensics.traced_recipients ?? []).length > 0 && (
                    <div>
                      {wmForensics.traced_recipients!.map((item, i) => (
                        <WatermarkRow key={item.violation_id} item={item} isLast={i === wmForensics.traced_recipients!.length - 1} />
                      ))}
                    </div>
                  )}
                </Panel>
              </section>
            )}

            {/* 6. Leaker Profiles */}
            {(leakerProfile.all_leakers ?? []).length > 0 && (
              <section>
                <SectionLabel>Leaker Profiles</SectionLabel>
                <Panel style={{ overflow: "hidden", padding: 0 }}>
                  {leakerProfile.all_leakers!.slice(0, 8).map((l, i) => (
                    <LeakerRow
                      key={l.leaker}
                      name={l.leaker}
                      count={l.count}
                      isRecipient={i === 0 && leakerProfile.is_registered_recipient}
                      isLast={i === Math.min(leakerProfile.all_leakers!.length, 8) - 1}
                    />
                  ))}
                </Panel>
              </section>
            )}

            {/* 7. Gemini AI Summary */}
            <section>
              <SectionLabel>Gemini AI Summary</SectionLabel>
              {ai.ai_summary && ai.ai_summary.toLowerCase() !== "error analyzing context." && ai.ai_summary.trim() ? (
                <Panel accentTop={`linear-gradient(90deg, ${T.accent}, rgba(59,130,246,0.2))`} style={{ padding: "22px 24px", background: "linear-gradient(135deg, rgba(59,130,246,0.06) 0%, rgba(13,15,18,0) 60%)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 6, background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)", flexShrink: 0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#7a93b8", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" }}>
                      Intent:
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "oklch(0.809 0.105 251.813)", letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {(ai.primary_intent ?? "UNKNOWN").replace(/_/g, " ")}
                    </span>
                    </div>
                    <span style={{ marginLeft: "auto" }}>
                      <Chip
                        text={`Risk ${(ai.risk_score ?? 0).toFixed(1)}/10`}
                        color={riskColor(ai.risk_score ?? 0)}
                        bg={riskBg(ai.risk_score ?? 0)}
                      />
                    </span>
                  </div>
                  <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.2)", borderRadius: 8, border: `1px solid rgba(59,130,246,0.12)` }}>
                  <p style={{ fontSize: 14, fontWeight: 400, color: "#c8d4e8", lineHeight: 1.8, margin: 0 }}>
                    {ai.ai_summary}
                  </p>
                  </div>
                </Panel>
              ) : (
                <Panel style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.warning} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span style={{ fontSize: 12, color: T.warning }}>Analysis unavailable —</span>
                  <span style={{ fontSize: 12, color: T.muted }}>run a deeper scan to generate AI context.</span>
                </Panel>
              )}
            </section>

            {/* 8. Detection Pipeline */}
            <section>
              <SectionLabel>Detection Pipeline</SectionLabel>
              <Panel accentTop={`linear-gradient(90deg, ${T.success}70, transparent)`} style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
                  {Object.entries(stages.stage_hit_counts ?? {}).map(([stage, hits]) => (
                    <div key={stage} style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.18)", borderRadius: 8, padding: "12px 18px", textAlign: "center", minWidth: 80 }}>
                      <p style={{ fontSize: 22, fontWeight: 300, color: T.accent, fontFamily: "var(--font-display)", lineHeight: 1, margin: 0 }}>{hits as number}</p>
                      <p style={{ fontSize: 10, color: "#8a9db8", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6, margin: "6px 0 0", fontFamily: "'IBM Plex Mono', monospace" }}>{stage} hits</p>
                    </div>
                  ))}
                  <div style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 18px", textAlign: "center", minWidth: 80 }}>
                    <p style={{ fontSize: 22, fontWeight: 300, color: T.primary, fontFamily: "var(--font-display)", lineHeight: 1, margin: 0 }}>{stages.violations_with_stage_data ?? 0}</p>
                    <p style={{ fontSize: 10, color: "#8a9db8", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 6, margin: "6px 0 0", fontFamily: "'IBM Plex Mono', monospace" }}>with stage data</p>
                  </div>
                </div>
                <div style={{ paddingTop: 16, borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <p style={{ fontSize: 10, color: "#8a9db8", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, fontFamily: "'IBM Plex Mono', monospace" }}>Media types:</p>
                  {Object.entries(mediaInfo.media_type_counts ?? {}).map(([type, cnt]) => (
                    <Chip key={type} text={`${cnt} ${type}`} color={T.secondary} bg="rgba(255,255,255,0.06)" />
                  ))}
                  {(mediaInfo.failed_count ?? 0) > 0 && (
                    <Chip text={`${mediaInfo.failed_count} failed`} color={T.danger} bg={T.dangerBg} />
                  )}
                  {(mediaInfo.pending_count ?? 0) > 0 && (
                    <Chip text={`${mediaInfo.pending_count} pending`} color={T.warning} bg={T.warningBg} />
                  )}
                </div>
              </Panel>
            </section>

          </div>{/* end left column */}

          {/* ── RIGHT SIDEBAR ────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 90, alignSelf: "start" }}>

            {/* Asset metadata */}
            <Panel sidebar style={{ padding: "16px 18px" }}>
              <p style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14, margin: "0 0 14px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>Asset Info</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["Type", insights.asset_type ?? "image"],
                  ["Recipients", String(insights.registered_recipients ?? 0)],
                  ["Distributions", String(insights.total_distributions ?? 0)],
                  ["Prop. Channels", String(insights.propagation_channels ?? 0)],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>{label}</p>
                    <p style={{ fontSize: 12, color: T.primary, fontFamily: "'IBM Plex Mono', monospace", textTransform: "capitalize", margin: 0 }}>{val}</p>
                  </div>
                ))}
                {(insights.asset_keywords ?? []).length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {insights.asset_keywords!.slice(0, 6).map((kw) => (
                      <Chip key={kw} text={kw} color={T.muted} bg="rgba(255,255,255,0.04)" />
                    ))}
                  </div>
                )}
              </div>
            </Panel>

            {/* Engagement Risk */}
            <Panel sidebar style={{ padding: "16px 18px" }}>
              <p style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14, margin: "0 0 14px", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>Engagement Exposure</p>
              <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
                <MiniStat label="Total Views" value={fmtViews(engagement.total_estimated_views ?? 0)} color={T.accent} />
                <MiniStat label="Total Likes" value={fmtViews(engagement.total_estimated_likes ?? 0)} color={T.primary} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["Avg views / violation", fmtViews(engagement.avg_views_per_violation ?? 0)],
                  ["Peak violation", `${fmtViews(engagement.max_single_violation_views ?? 0)} views`],
                ].map(([lbl, val]) => (
                  <div key={lbl} style={{ display: "flex", justifyContent: "space-between" }}>
                    <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>{lbl}</p>
                    <p style={{ fontSize: 11, fontFamily: "'IBM Plex Mono', monospace", color: T.secondary, margin: 0 }}>{val}</p>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 11, color: T.muted, margin: 0 }}>Exposure tier</p>
                  <Chip
                    text={engagement.exposure_tier ?? "UNKNOWN"}
                    color={exposureColor[engagement.exposure_tier ?? "UNKNOWN"] ?? T.muted}
                    bg="rgba(255,255,255,0.06)"
                  />
                </div>
              </div>
            </Panel>

            {/* Threat Timeline */}
            <Panel sidebar style={{ padding: "16px 18px" }}>
              <p style={{ fontSize: 14, fontWeight: 400, color: "oklch(0.809 0.105 251.813)", marginBottom: 18, letterSpacing: "0.01em", fontFamily: "var(--font-display)", margin: "0 0 18px" }}>
                Threat Timeline
              </p>
              {timelineEvents.map((ev, i) => (
                <TimelineEvent key={i} label={ev.label} timestamp={ev.timestamp} severity={ev.severity} isLast={i === timelineEvents.length - 1} />
              ))}
            </Panel>

            {/* Recommended Actions */}
            <Panel sidebar style={{ overflow: "hidden", padding: 0 }}>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 14, fontWeight: 400, color: "oklch(0.809 0.105 251.813)", fontFamily: "var(--font-display)", margin: 0 }}>Recommended Actions</p>
              </div>
              {actions.map((a, i) => (
                <ActionRow key={a.n} n={a.n} label={a.label} desc={a.desc} cta={a.cta} href={a.href} isLast={i === actions.length - 1} />
              ))}
            </Panel>

            {/* Export CTA */}
            <ExportBtn asset={asset} insights={insights} />

          </div>{/* end sidebar */}
        </div>
      </div>
    </div>
  );
}