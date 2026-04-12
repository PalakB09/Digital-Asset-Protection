"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getAsset, getAssetImageUrl, type Asset } from "@/lib/api";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";

const API_BASE = "http://localhost:8000/api";

// ─── Design tokens (local, Zed-dark palette) ─────────────────────────────────
const T = {
  bg:          "#0D0F12",
  surface:     "#13161B",
  surfaceSide: "#0F1115",
  border:      "#1E2228",
  borderHover: "rgba(59,130,246,0.4)",
  muted:       "#97a1b7ff",
  secondary:   "#b6bcc6ff",
  primary:     "#F9FAFB",
  accent:      "#3B82F6",
  danger:      "#DC2626",
  dangerBg:    "rgba(220,38,38,0.10)",
  warning:     "#D97706",
  warningBg:   "rgba(217,119,6,0.10)",
  success:     "#16A34A",
  successBg:   "rgba(22,163,74,0.10)",
} as const;

// ─── InsightsData interface ────────────────────────────────────────────────────
interface InsightsData {
  asset_id: string;
  total_violations: number;
  threat_metrics: {
    average_threat_score: number;
    highest_threat_platform: string;
    total_estimated_views: number;
  };
  leaker_profile: {
    top_leaker: string;
    leaker_risk_level: string;
  };
  semantic_intent: {
    primary_intent: string;
    ai_summary: string;
  };
  alteration_analysis: {
    visually_altered_count: number;
    average_ssim_score: number;
  };
  message?: string;
}

async function fetchInsights(id: string): Promise<InsightsData> {
  const res = await fetch(`${API_BASE}/assets/${id}/insights`);
  if (!res.ok) throw new Error("Failed to load insights");
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtViews(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
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
  if (score >= 4) return "High risk";
  return "Low risk";
}

function confColor(pct: number) {
  if (pct >= 80) return T.danger;
  if (pct >= 60) return T.warning;
  return T.muted;
}

// ─── Card wrapper ─────────────────────────────────────────────────────────────
function Panel({
  children,
  className = "",
  style = {},
  sidebar = false,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  sidebar?: boolean;
}) {
  return (
    <div
      className={className}
      style={{
        background: sidebar ? T.surfaceSide : T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: 15,
        fontWeight: 500,
        fontFamily: "var(--font-body)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "#6B7280",
        marginBottom: 16,
      }}
    >
      {children}
    </p>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accentLeft,
  badge,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accentLeft?: string;         // left-border color
  badge?: { text: string; color: string; bg: string };
}) {
  return (
    <div
      style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        borderLeft: accentLeft ? `3px solid ${accentLeft}` : undefined,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Label */}
      <p style={{ fontSize: 12, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: T.muted, marginBottom: 4, fontFamily: "var(--font-body)" }}>
        {label}
      </p>

      {/* Value */}
      <p style={{ fontSize: 40, fontWeight: 300, color: T.primary, lineHeight: 1, fontFamily: "var(--font-display)" }}>
        {value}
      </p>

      {/* Sub-label + optional badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        {sub && (
          <p style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: T.muted }}>
            {sub}
          </p>
        )}
        {badge && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              padding: "2px 8px",
              borderRadius: 4,
              background: badge.bg,
              color: badge.color,
              letterSpacing: "0.04em",
            }}
          >
            {badge.text}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────────────
const severityDot: Record<"red" | "amber" | "blue", string> = {
  red:   T.danger,
  amber: T.warning,
  blue:  T.accent,
};

function TimelineEvent({
  label,
  timestamp,
  severity,
  isLast,
}: {
  label: string;
  timestamp: string;
  severity: "red" | "amber" | "blue";
  isLast: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {/* Dot + connector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: severityDot[severity],
            boxShadow: `0 0 6px ${severityDot[severity]}`,
            marginTop: 4,
            flexShrink: 0,
          }}
        />
        {!isLast && (
          <div
            style={{
              width: 1,
              flex: 1,
              background: `linear-gradient(to bottom, ${T.accent}60, ${T.border})`,
              marginTop: 4,
              marginBottom: 4,
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ paddingBottom: isLast ? 0 : 20 }}>
        <p style={{ fontSize: 15, fontWeight: 500, color: "#F9FAFB", lineHeight: 1.3 }}>{label}</p>
        <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: T.muted, marginTop: 4 }}>{timestamp}</p>
      </div>
    </div>
  );
}

// ─── Leaker row ───────────────────────────────────────────────────────────────
function LeakerRow({
  name,
  platform,
  violations,
  confidence,
}: {
  name: string;
  platform: string;
  violations: number;
  confidence: number;
}) {
  const [hovered, setHovered] = useState(false);
  const initials = name.split(/[\s@]+/).map((w) => w[0]?.toUpperCase()).slice(0, 2).join("");

  const platformBg: Record<string, string> = {
    telegram: "rgba(91,85,218,0.15)",
    twitter:  "rgba(29,161,242,0.15)",
    youtube:  "rgba(255,0,0,0.12)",
  };
  const platformColor: Record<string, string> = {
    telegram: "#8B83F7",
    twitter:  "#38B2F4",
    youtube:  "#FF5F57",
  };
  const pk = platform.toLowerCase();

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 20px",
        borderBottom: `1px solid ${T.border}`,
        borderLeft: `2px solid ${hovered ? T.borderHover : "transparent"}`,
        transition: "border-color 150ms ease",
        cursor: "default",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "rgba(59,130,246,0.15)",
          border: `1px solid rgba(59,130,246,0.25)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: 12,
          fontWeight: 600,
          color: T.accent,
        }}
      >
        {initials}
      </div>

      {/* Name + violations */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 15, fontWeight: 500, color: T.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </p>
        <p style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: T.muted, marginTop: 2 }}>
          {violations} violation{violations !== 1 ? "s" : ""} linked
        </p>
      </div>

      {/* Platform badge */}
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          padding: "2px 8px",
          borderRadius: 4,
          background: platformBg[pk] ?? "rgba(255,255,255,0.06)",
          color: platformColor[pk] ?? T.secondary,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {platform}
      </span>

      {/* Confidence */}
      <p
        style={{
          fontSize: 16,
          fontWeight: 500,
          fontFamily: "var(--font-mono)",
          color: confColor(confidence),
          minWidth: 40,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {confidence}%
      </p>
    </div>
  );
}

// ─── Action row ───────────────────────────────────────────────────────────────
function ActionRow({
  n,
  label,
  desc,
  cta,
  href,
  isLast,
}: {
  n: string;
  label: string;
  desc: string;
  cta: string;
  href: string;
  isLast: boolean;
}) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderBottom: isLast ? "none" : `1px solid ${T.border}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {/* Number */}
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: T.accent,
            fontFamily: "var(--font-mono)",
            lineHeight: "20px",
            flexShrink: 0,
          }}
        >
          {n}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#F9FAFB", marginBottom: 4 }}>{label}</p>
          <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, marginBottom: 10 }}>{desc}</p>
          <Link href={href}>
            <ActionButton>{cta}</ActionButton>
          </Link>
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
      style={{
        height: 28,
        padding: "0 12px",
        fontSize: 12,
        fontWeight: 500,
        borderRadius: 4,
        border: `1px solid ${hovered ? T.accent : T.border}`,
        background: hovered ? `rgba(59,130,246,0.10)` : "transparent",
        color: hovered ? T.accent : T.secondary,
        cursor: "pointer",
        transition: "all 150ms ease",
        outline: "none",
      }}
    >
      {children}
    </button>
  );
}

// ─── Ghost button ─────────────────────────────────────────────────────────────
function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 34,
        padding: "0 14px",
        fontSize: 14,
        fontWeight: 400,
        borderRadius: 6,
        border: `1px solid ${hovered ? T.border : T.border}`,
        background: hovered ? "rgba(255,255,255,0.04)" : "transparent",
        color: T.secondary,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "all 150ms ease",
        outline: "none",
      }}
    >
      {children}
    </button>
  );
}

// ─── Primary export button ────────────────────────────────────────────────────
function PrimaryBtn({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      style={{
        width: "100%",
        height: 40,
        fontSize: 14,
        fontWeight: 500,
        borderRadius: 6,
        border: "none",
        background: hovered ? "rgba(59,130,246,0.90)" : T.accent,
        color: "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        transition: "background 150ms ease",
        outline: "none",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[0,1,2,3].map(i => <Skeleton key={i} className="rounded" style={{ height: 120 }} />)}
          </div>
          <Skeleton className="rounded" style={{ height: 100 }} />
          <Skeleton className="rounded" style={{ height: 200 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton className="rounded" style={{ height: 220 }} />
          <Skeleton className="rounded" style={{ height: 280 }} />
          <Skeleton className="rounded" style={{ height: 44 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────
export default function AssetInsightDetailPage() {
  const params = useParams();
  const assetId = params.id as string;
  const [asset, setAsset] = useState<Asset | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) return;
    Promise.all([getAsset(assetId), fetchInsights(assetId)])
      .then(([a, ins]) => { setAsset(a); setInsights(ins); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [assetId]);

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ background: T.bg, minHeight: "100vh" }}>
        <PageTop asset={null} />
        <LoadingSkeleton />
      </div>
    );
  }

  // ── Error / no data state ─────────────────────────────────────
  if (error || !insights || insights.total_violations === 0) {
    const msg = error ?? "No insights available yet.";
    const sub = error ? "Check that the backend is reachable." : "Run a scan to generate AI insights for this asset.";
    return (
      <div style={{ background: T.bg, minHeight: "100vh" }}>
        <PageTop asset={asset} />
        <div style={{ padding: "40px", maxWidth: 600, margin: "0 auto" }}>
          <Panel style={{ padding: 32, textAlign: "center" }}>
            <span style={{ fontSize: 20, display: "block", marginBottom: 12 }}>⚠</span>
            <p style={{ fontSize: 15, fontWeight: 500, color: T.primary, marginBottom: 8 }}>
              {msg}
            </p>
            <p style={{ fontSize: 13, color: T.muted, marginBottom: 20, lineHeight: 1.6 }}>{sub}</p>
            <Link href="/scan">
              <button
                style={{
                  height: 36,
                  padding: "0 20px",
                  fontSize: 13,
                  fontWeight: 500,
                  borderRadius: 6,
                  border: "none",
                  background: T.accent,
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Scan now
              </button>
            </Link>
          </Panel>
        </div>
      </div>
    );
  }

  // ── Main content ──────────────────────────────────────────────
  const tm = insights.threat_metrics;
  const lp = insights.leaker_profile;
  const si = insights.semantic_intent;
  const aa = insights.alteration_analysis;
  const score = tm.average_threat_score;

  const mockLeakers = [
    { name: lp.top_leaker,        platform: tm.highest_threat_platform, violations: Math.floor(insights.total_violations * 0.6), confidence: 92 },
    { name: "@unknown_user_443",  platform: "Telegram",                  violations: Math.floor(insights.total_violations * 0.3), confidence: 74 },
    { name: "@redistributor_7x",  platform: "Twitter",                   violations: Math.floor(insights.total_violations * 0.1), confidence: 58 },
  ].filter((l) => l.violations > 0);

  const timelineEvents = [
    { label: "Asset registered",                                timestamp: asset ? new Date(asset.created_at).toLocaleString() : "—",  severity: "blue"  as const },
    { label: "First violation detected",                        timestamp: "2h after registration",                                     severity: "amber" as const },
    { label: "Spread to Telegram",                              timestamp: "4h after registration",                                     severity: "amber" as const },
    { label: `${insights.total_violations} violations confirmed`, timestamp: "Latest scan",                                             severity: "red"   as const },
  ];

  const actions = [
    { n: "01", label: "Send DMCA Takedown",      desc: "Issue a formal DMCA notice to hosting platforms for all detected violations.", cta: "Send DMCA",   href: "/actions" },
    { n: "02", label: "Run Full Platform Scan",  desc: "Trigger a discovery sweep across Twitter, YouTube, Telegram, and Google.",    cta: "Scan now",    href: "/scan"    },
    { n: "03", label: "Review Propagation Graph",desc: "Explore the visual spread map to identify the highest-risk distribution paths.", cta: "View graph", href: "/graph"   },
  ];

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      {/* ── Page header ─────────────────────────────────────── */}
      <PageTop asset={asset} />

      {/* Thin divider */}
      <div style={{ height: 1, background: T.border }} />

      {/* ── Body ────────────────────────────────────────────── */}
      <div style={{ padding: "32px 40px", maxWidth: 1200, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>

          {/* ── Left column ─────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Threat Analysis section */}
            <div>
              <SectionLabel>Threat Analysis</SectionLabel>

              {/* 2×2 stat grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {/* Risk Score */}
                <StatCard
                  label="Risk Score"
                  value={
                    <>
                      <span style={{ fontSize: 40, fontWeight: 300, color: riskColor(score) }}>
                        {score.toFixed(1)}
                      </span>
                      <span style={{ fontSize: 18, color: T.muted, fontWeight: 300, marginLeft: 2 }}>/10</span>
                    </>
                  }
                  accentLeft={riskColor(score)}
                  badge={{ text: riskLabel(score), color: riskColor(score), bg: riskBg(score) }}
                />

                {/* Estimated Reach */}
                <StatCard
                  label="Estimated Reach"
                  value={<span style={{ color: T.accent }}>{fmtViews(tm.total_estimated_views)}</span>}
                  sub="Estimated views"
                />

                {/* Total Violations */}
                <StatCard
                  label="Total Violations"
                  value={insights.total_violations}
                  sub="Across platforms"
                />

                {/* Top Threat Platform */}
                <StatCard
                  label="Top Threat Platform"
                  value={
                    <span style={{ fontSize: 28, fontWeight: 400, textTransform: "capitalize", color: T.primary }}>
                      {tm.highest_threat_platform}
                    </span>
                  }
                  sub="Highest exposure"
                />
              </div>
            </div>

            {/* AI Summary */}
            <div>
              <SectionLabel>Gemini AI Summary</SectionLabel>
              {si.ai_summary && si.ai_summary.toLowerCase() !== "error analyzing context." && si.ai_summary.trim() ? (
                <Panel style={{ padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: 500, color: T.muted, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                      Intent: <span style={{ color: "oklch(0.809 0.105 251.813)" }}>{si.primary_intent.replace(/_/g, " ")}</span>
                    </span>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 300, color: "oklch(0.722 0.0112 262.86)", lineHeight: 1.7 }}>
                    {si.ai_summary}
                  </p>
                </Panel>
              ) : (
                <Panel style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.warning} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span style={{ fontSize: 13, color: T.warning }}>Analysis unavailable —</span>
                  <span style={{ fontSize: 13, color: T.muted }}>run a deeper scan to generate AI context.</span>
                </Panel>
              )}
            </div>

            {/* Leaker Profiles */}
            {mockLeakers.length > 0 && (
              <div>
                <SectionLabel>Leaker Profiles</SectionLabel>
                <Panel style={{ overflow: "hidden", padding: 0 }}>
                  {mockLeakers.map((l, i) => (
                    <div key={l.name} style={{ borderBottom: i < mockLeakers.length - 1 ? `1px solid ${T.border}` : "none" }}>
                      <LeakerRow
                        name={l.name}
                        platform={l.platform}
                        violations={l.violations}
                        confidence={l.confidence}
                      />
                    </div>
                  ))}
                </Panel>
              </div>
            )}

            {/* Alteration Analysis */}
            {aa.visually_altered_count > 0 && (
              <div>
                <SectionLabel>Alteration Analysis</SectionLabel>
                <Panel style={{ padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center", minWidth: 80 }}>
                      <p style={{ fontSize: 32, fontWeight: 300, color: "oklch(0.809 0.105 251.813)", lineHeight: 1, fontFamily: "var(--font-display)" }}>
                        {aa.visually_altered_count}
                      </p>
                      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, marginTop: 6 }}>
                        Altered
                      </p>
                    </div>
                    <div style={{ textAlign: "center", minWidth: 80 }}>
                      <p style={{ fontSize: 32, fontWeight: 300, color: T.primary, lineHeight: 1, fontFamily: "var(--font-display)" }}>
                        {(aa.average_ssim_score * 100).toFixed(0)}%
                      </p>
                      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: T.muted, marginTop: 6 }}>
                        Avg SSIM
                      </p>
                    </div>
                    <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, flex: 1, minWidth: 180 }}>
                      {aa.visually_altered_count} violation{aa.visually_altered_count !== 1 ? "s" : ""} show visible
                      modifications. Content may have been cropped, re-encoded, or colour-graded to evade detection.
                    </p>
                  </div>
                </Panel>
              </div>
            )}
          </div>

          {/* ── Right sidebar column (sticky) ───────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 90, alignSelf: "start" }}>

            {/* Threat Timeline */}
            <Panel sidebar style={{ padding: 20 }}>
              <p style={{ fontSize: 19, fontWeight: 400, color: "oklch(0.809 0.105 251.813)", marginBottom: 20, letterSpacing: "0.02em", fontFamily: "var(--font-display)" }}>
                Threat Timeline
              </p>
              {timelineEvents.map((ev, i) => (
                <TimelineEvent
                  key={i}
                  label={ev.label}
                  timestamp={ev.timestamp}
                  severity={ev.severity}
                  isLast={i === timelineEvents.length - 1}
                />
              ))}
            </Panel>

            {/* Recommended Actions */}
            <Panel sidebar style={{ overflow: "hidden", padding: 0 }}>
              <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
                <p style={{ fontSize: 19, fontWeight: 400, color: "oklch(0.809 0.105 251.813)", fontFamily: "var(--font-display)" }}>Recommended Actions</p>
              </div>
              {actions.map((a, i) => (
                <ActionRow
                  key={a.n}
                  n={a.n}
                  label={a.label}
                  desc={a.desc}
                  cta={a.cta}
                  href={a.href}
                  isLast={i === actions.length - 1}
                />
              ))}
            </Panel>

            {/* Primary CTA */}
            <PrimaryBtn>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Full Report
            </PrimaryBtn>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page header (extracted) ──────────────────────────────────────────────────
function PageTop({ asset }: { asset: Asset | null }) {
  const [exportHovered, setExportHovered] = useState(false);

  // Extension chip
  const ext = asset?.name?.split(".").pop()?.toUpperCase() ?? "ASSET";

  return (
    <div
      style={{
        padding: "20px 40px",
        background: T.bg,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      {/* Left: back + title */}
      <div>
        <Link
          href="/insights"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 19,
            color: "oklch(0.722 0.0112 262.86)",
            textDecoration: "none",
            marginBottom: 10,
          }}
          className="hover-accent-text"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          Insights
        </Link>

        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1
            style={{
              fontSize: 40,
              fontWeight: 300,
              color: "oklch(0.809 0.105 251.813)",
              fontFamily: "var(--font-display)",
              lineHeight: 1.2,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            {asset?.name ?? "Asset Insights"}
          </h1>
          {asset && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                fontFamily: "var(--font-mono)",
                padding: "2px 8px",
                borderRadius: 4,
                background: "rgba(59,130,246,0.12)",
                border: "1px solid rgba(59,130,246,0.25)",
                color: "#3B82F6",
                letterSpacing: "0.06em",
              }}
            >
              .{ext}
            </span>
          )}
        </div>

        <p style={{ fontSize: 14, color: "oklch(0.722 0.0112 262.86)", marginTop: 6, lineHeight: 1.5 }}>
          AI-powered threat analysis and leaker profiling
        </p>
      </div>

      {/* Right: Export (ghost — NOT primary CTA) */}
      <button
        onMouseEnter={() => setExportHovered(true)}
        onMouseLeave={() => setExportHovered(false)}
        style={{
          height: 34,
          padding: "0 14px",
          fontSize: 16,
          fontWeight: 400,
          borderRadius: 6,
          border: `1px solid ${exportHovered ? "#3B82F6" : "#1E2228"}`,
          background: "transparent",
          color: exportHovered ? "#3B82F6" : "#9CA3AF",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "all 150ms ease",
          flexShrink: 0,
          outline: "none",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export report
      </button>
    </div>
  );
}
