"use client";

import { useState, useEffect, useRef } from "react";
import { listAssets, getAssetImageUrl, type Asset } from "@/lib/api";
import { getAssetInsights } from "@/lib/api";
import Link from "next/link";

// ─── Full TypeScript Interfaces — mirrors insights.py response ───────────────
interface VelocityData {
  first_seen: string | null;
  last_seen: string | null;
  days_active: number;
  violations_per_day: number;
  last_7d_count: number;
  last_30d_count: number;
  acceleration: "ACCELERATING" | "STABLE" | "DECLINING" | "UNKNOWN";
}

interface PlatformBreakdown {
  platform: string;
  violation_count: number;
  total_views: number;
  total_likes: number;
  avg_confidence: number;
  watermark_verified_count: number;
  high_tier_count: number;
  dominant_match_type: string;
}

interface MatchQuality {
  overall_confidence_avg: number;
  reranked_confidence_avg: number;
  watermark_verified_count: number;
  watermark_verified_pct: number;
  match_tier_counts: Record<string, number>;
  match_type_counts: Record<string, number>;
  phash: { available: number; avg_distance: number; identical_count: number; very_similar_count: number; similar_count: number };
  clip_similarity: { available: number; avg: number; above_0_92_count: number };
  ssim_alteration: { available: number; avg_ssim: number; heavily_altered_count: number; mildly_altered_count: number; near_identical_count: number };
}

interface WatermarkForensics {
  attributed_violation_count: number;
  traced_to_recipient_count: number;
  attribution_rate_pct: number;
  traced_recipients: Array<{
    violation_id: string;
    watermark_id: string;
    recipient_name: string;
    recipient_identifier: string | null;
    platform: string;
    source_url: string;
    detected_at: string | null;
  }>;
}

interface LeakerProfile {
  top_leaker: string | null;
  top_leaker_count: number;
  unique_leaker_count: number;
  leaker_risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  is_registered_recipient: boolean;
  all_leakers: Array<{ leaker: string; count: number }>;
}

interface EngagementRisk {
  total_estimated_views: number;
  total_estimated_likes: number;
  max_single_violation_views: number;
  max_single_violation_likes: number;
  avg_views_per_violation: number;
  exposure_tier: "VIRAL" | "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";
  top_violation_id: string | null;
  top_violation_url: string | null;
  top_violation_platform: string | null;
}

interface DetectionStages {
  violations_with_stage_data: number;
  stage_hit_counts: Record<string, number>;
}

interface MediaInfo {
  media_type_counts: Record<string, number>;
  processing_status_counts: Record<string, number>;
  failed_count: number;
  pending_count: number;
}

interface InsightData {
  asset_id: string;
  asset_name: string;
  asset_type: string | null;
  asset_keywords: string[];
  registered_recipients: number;
  total_distributions: number;
  total_violations: number;
  propagation_channels: number;
  composite_threat_score: number;
  velocity: VelocityData;
  engagement_risk: EngagementRisk;
  platform_breakdown: PlatformBreakdown[];
  highest_threat_platform: string;
  match_quality: MatchQuality;
  detection_stages: DetectionStages;
  watermark_forensics: WatermarkForensics;
  leaker_profile: LeakerProfile;
  media_info: MediaInfo;
  ai_analysis: {
    primary_intent: string;
    risk_score: number;
    ai_summary: string;
  };
}

interface EnrichedAsset extends Asset {
  insights: InsightData | null;
  threatLevel: "Critical" | "High" | "Medium" | "Low";
  variant: "violation" | "pending" | "info" | "verified";
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function scoreColor(score: number): string {
  if (score >= 8) return "#ef4444";
  if (score >= 5.5) return "#f97316";
  if (score >= 3) return "#eab308";
  return "#22c55e";
}

function tierColor(tier: string): string {
  const map: Record<string, string> = {
    VIRAL: "#ef4444", HIGH: "#f97316", MODERATE: "#eab308", LOW: "#22c55e", UNKNOWN: "#6b7280",
  };
  return map[tier] ?? "#6b7280";
}

function accelColor(a: string): string {
  const map: Record<string, string> = {
    ACCELERATING: "#ef4444", STABLE: "#22c55e", DECLINING: "#3b82f6", UNKNOWN: "#6b7280",
  };
  return map[a] ?? "#6b7280";
}

function leakerRiskColor(r: string): string {
  const map: Record<string, string> = {
    CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#eab308", LOW: "#22c55e", UNKNOWN: "#6b7280",
  };
  return map[r] ?? "#6b7280";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(score / 10, 1);
  const color = scoreColor(score);
  const [dash, setDash] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDash(pct * circ), 120);
    return () => clearTimeout(t);
  }, [pct, circ]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}
      />
      <text
        x="50%" y="50%"
        dominantBaseline="middle" textAnchor="middle"
        fill={color}
        style={{ transform: "rotate(90deg)", transformOrigin: "center", fontSize: 13, fontWeight: 700, fontFamily: "'IBM Plex Sans', sans-serif" }}
      >
        {score.toFixed(1)}
      </text>
    </svg>
  );
}

function PlatformBar({ platform, views, maxViews, violations, confidence, color }: {
  platform: string; views: number; maxViews: number; violations: number; confidence: number; color: string;
}) {
  const pct = maxViews > 0 ? (views / maxViews) * 100 : 0;
  const [width, setWidth] = useState(0);
  useEffect(() => { setTimeout(() => setWidth(pct), 80); }, [pct]);

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--neu-text)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {platform}
        </span>
        <div style={{ display: "flex", gap: 12 }}>
          <span style={{ fontSize: 12, color: "var(--neu-text-muted)", fontFamily: "'IBM Plex Sans', sans-serif" }}>{violations} violations</span>
          <span style={{ fontSize: 12, color: "var(--neu-text-muted)", fontFamily: "'IBM Plex Sans', sans-serif" }}>{fmt(views)} views</span>
          <span style={{ fontSize: 12, color: color, fontWeight: 700, fontFamily: "'IBM Plex Sans', sans-serif" }}>{Math.round(confidence * 100)}% conf</span>
        </div>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${width}%`, background: color, borderRadius: 99,
          transition: "width 1s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: `0 0 8px ${color}80`,
        }} />
      </div>
    </div>
  );
}

// Fixed: Extracted RiskBar to fix Rules of Hooks
function RiskBar({ level, count, pct, color, idx }: { level: string, count: number, pct: number, color: string, idx: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { setTimeout(() => setW(pct), 100 + idx * 80); }, [pct, idx]);

  const labels: Record<string, string> = {
    Critical: "Critical (≥8.0)",
    High: "High (≥5.5)",
    Medium: "Medium (≥3.0)",
    Low: "Low (<3.0)"
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {labels[level]}
        </span>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {count} ({pct}%)
        </span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${w}%`, background: color,
          borderRadius: 99, boxShadow: `0 0 6px ${color}60`,
          transition: `width 1s ${0.1 + idx * 0.08}s cubic-bezier(0.16,1,0.3,1)`,
        }} />
      </div>
    </div>
  );
}

// Fixed: Extracted LeakerBar to fix Rules of Hooks
function LeakerBar({ leaker, count, maxCount, idx }: { leaker: string, count: number, maxCount: number, idx: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const [w, setW] = useState(0);
  useEffect(() => { setTimeout(() => setW(pct), 100 + idx * 50); }, [pct, idx]);
  const riskColor = count >= 5 ? "#ef4444" : count >= 3 ? "#f97316" : count >= 2 ? "#eab308" : "#22c55e";

  return (
    <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%", background: `${riskColor}20`,
            border: `1px solid ${riskColor}50`, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 800, color: riskColor,
          }}>
            {idx + 1}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "'IBM Plex Sans', sans-serif" }}>{leaker}</span>
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: riskColor, fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {count}×
        </span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${w}%`, background: riskColor,
          borderRadius: 99, transition: `width 0.9s ${idx * 0.04}s cubic-bezier(0.16,1,0.3,1)`,
        }} />
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, icon, accentColor }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; accentColor: string;
}) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 16, padding: "18px 20px",
      display: "flex", alignItems: "flex-start", gap: 14,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: `${accentColor}18`, display: "flex", alignItems: "center", justifyContent: "center",
        color: accentColor,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1, fontFamily: "'IBM Plex Serif', serif", letterSpacing: "-0.03em" }}>
          {value}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4, fontFamily: "'IBM Plex Sans', sans-serif" }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 10, color: accentColor, marginTop: 2, fontFamily: "'IBM Plex Sans', sans-serif" }}>{sub}</div>}
      </div>
    </div>
  );
}

function StageBadge({ stage, count, total }: { stage: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.07)",
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", fontFamily: "'IBM Plex Sans', sans-serif" }}>{pct}%</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.08em", textAlign: "center" }}>
        {stage}
      </div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{count} hits</div>
    </div>
  );
}

function TierPill({ tier }: { tier: string }) {
  const color = tierColor(tier);
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em",
      color, background: `${color}1a`, border: `1px solid ${color}40`,
      padding: "2px 7px", borderRadius: 99,
    }}>
      {tier}
    </span>
  );
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <h3 style={{
        fontSize: 10, fontWeight: 800, color: "rgba(255,255,255,0.35)",
        textTransform: "uppercase", letterSpacing: "0.15em", margin: 0,
      }}>
        {title}
      </h3>
      {action}
    </div>
  );
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 20, padding: 24,
      backdropFilter: "blur(12px)",
      ...style,
    }}>
      {children}
    </div>
  );
}

function Skeleton({ w = "100%", h = 16, style = {} }: { w?: string | number; h?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: 6,
      background: "rgba(255,255,255,0.05)",
      animation: "pulse 1.8s ease-in-out infinite",
      ...style,
    }} />
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AggregatedInsightsPage() {
  const [assets, setAssets] = useState<EnrichedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "forensics" | "platforms" | "leakers">("overview");

  useEffect(() => {
    async function fetchAll() {
      try {
        const rawAssets = await listAssets();
        const enriched = await Promise.all(
          rawAssets.map(async (asset) => {
            let insights: InsightData | null = null;
            if (asset.violation_count > 0) {
              try { insights = await getAssetInsights(asset.id); } catch { }
            }
            const score = insights?.composite_threat_score ?? 0;
            const threatLevel = score >= 8 ? "Critical" : score >= 5.5 ? "High" : score >= 3 ? "Medium" : "Low";
            const variant = score >= 8 ? "violation" : score >= 5.5 ? "pending" : score >= 3 ? "info" : "verified";
            return { ...asset, insights, threatLevel, variant } as EnrichedAsset;
          })
        );
        setAssets(enriched);
      } catch { }
      finally { setLoading(false); }
    }
    fetchAll();
  }, []);

  // ─── Aggregations ─────────────────────────────────────────────────────────
  const withInsights = assets.filter(a => a.insights !== null);
  const totalViolations = assets.reduce((s, a) => s + a.violation_count, 0);
  const totalViews = withInsights.reduce((s, a) => s + (a.insights?.engagement_risk.total_estimated_views ?? 0), 0);
  const totalLikes = withInsights.reduce((s, a) => s + (a.insights?.engagement_risk.total_estimated_likes ?? 0), 0);
  const totalTracedLeakers = withInsights.reduce((s, a) => s + (a.insights?.watermark_forensics.traced_to_recipient_count ?? 0), 0);
  const totalUniqueLeakers = withInsights.reduce((s, a) => s + (a.insights?.leaker_profile.unique_leaker_count ?? 0), 0);
  const activeIncidents = assets.filter(a => a.violation_count > 0).length;
  const acceleratingCount = withInsights.filter(a => a.insights?.velocity.acceleration === "ACCELERATING").length;
  const avgThreatScore = withInsights.length
    ? withInsights.reduce((s, a) => s + (a.insights?.composite_threat_score ?? 0), 0) / withInsights.length
    : 0;

  // Distribution
  const dist = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  withInsights.forEach(a => dist[a.threatLevel as keyof typeof dist]++);

  // Top assets by score
  const topAssets = [...withInsights]
    .sort((a, b) => (b.insights?.composite_threat_score ?? 0) - (a.insights?.composite_threat_score ?? 0))
    .slice(0, 6);

  // Platform aggregation across all assets
  const platformMap: Record<string, { views: number; violations: number; confidence_sum: number; confidence_n: number }> = {};
  withInsights.forEach(a => {
    a.insights!.platform_breakdown.forEach(p => {
      if (!platformMap[p.platform]) platformMap[p.platform] = { views: 0, violations: 0, confidence_sum: 0, confidence_n: 0 };
      platformMap[p.platform].views += p.total_views;
      platformMap[p.platform].violations += p.violation_count;
      platformMap[p.platform].confidence_sum += p.avg_confidence;
      platformMap[p.platform].confidence_n += 1;
    });
  });
  const platforms = Object.entries(platformMap)
    .map(([name, d]) => ({ name, views: d.views, violations: d.violations, confidence: d.confidence_n ? d.confidence_sum / d.confidence_n : 0 }))
    .sort((a, b) => b.views - a.views);
  const maxPlatformViews = platforms[0]?.views ?? 1;

  // Detection stage aggregation
  const stageMap: Record<string, number> = {};
  let totalStageViolations = 0;
  withInsights.forEach(a => {
    const ds = a.insights!.detection_stages;
    totalStageViolations += ds.violations_with_stage_data;
    Object.entries(ds.stage_hit_counts).forEach(([k, v]) => {
      stageMap[k] = (stageMap[k] ?? 0) + v;
    });
  });

  // All leakers aggregated
  const globalLeakerMap: Record<string, number> = {};
  withInsights.forEach(a => {
    a.insights!.leaker_profile.all_leakers.forEach(l => {
      globalLeakerMap[l.leaker] = (globalLeakerMap[l.leaker] ?? 0) + l.count;
    });
  });
  const topLeakers = Object.entries(globalLeakerMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([leaker, count]) => ({ leaker, count }));

  // Global AI summary from top asset
  const globalSummary = topAssets[0]?.insights?.ai_analysis?.ai_summary
    ?? "Awaiting telemetry to generate global threat assessment.";

  // Watermark forensics totals
  const totalAttributed = withInsights.reduce((s, a) => s + (a.insights?.watermark_forensics.attributed_violation_count ?? 0), 0);
  const avgAttributionRate = withInsights.length
    ? withInsights.reduce((s, a) => s + (a.insights?.watermark_forensics.attribution_rate_pct ?? 0), 0) / withInsights.length
    : 0;

  // Avg match quality
  const avgConfidence = withInsights.length
    ? withInsights.reduce((s, a) => s + (a.insights?.match_quality.overall_confidence_avg ?? 0), 0) / withInsights.length
    : 0;
  const avgWmVerifiedPct = withInsights.length
    ? withInsights.reduce((s, a) => s + (a.insights?.match_quality.watermark_verified_pct ?? 0), 0) / withInsights.length
    : 0;

  // Viral count
  const viralCount = withInsights.filter(a => a.insights?.engagement_risk.exposure_tier === "VIRAL").length;

  const PLATFORM_COLORS = ["#ef4444", "#f97316", "#eab308", "#3b82f6", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "forensics", label: "Forensics" },
    { id: "platforms", label: "Platforms" },
    { id: "leakers", label: "Leakers" },
  ] as const;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@700;800&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .insights-page * { box-sizing: border-box; }
        .insights-page { font-family: 'IBM Plex Sans', sans-serif; }
        .insights-fade { animation: fadeUp 0.5s ease both; }
        .tab-btn {
          padding: 7px 16px; border-radius: 8px; border: 1px solid transparent;
          font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
          cursor: pointer; transition: all 0.15s; background: transparent; color: rgba(255,255,255,0.4);
        }
        .tab-btn:hover { color: rgba(255,255,255,0.7); }
        .tab-btn.active { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.12); color: #fff; }
        .asset-card { transition: all 0.2s; }
        .asset-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.15) !important; }
      `}</style>

      <div className="insights-page" style={{
        minHeight: "100vh",
        background: "var(--neu-bg, #0a0a0f)",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Ambient glow */}
        <div style={{
          position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)",
          width: 800, height: 400, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(239,68,68,0.06) 0%, transparent 70%)",
          pointerEvents: "none", zIndex: 0,
        }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "32px 24px" }}>

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", background: "#ef4444",
                  boxShadow: "0 0 12px #ef4444",
                  animation: "pulse 2s ease-in-out infinite",
                }} />
                <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(247, 245, 245, 0.65)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                  Live Intelligence Feed
                </span>
              </div>
              <h1 style={{
                fontFamily: "'IBM Plex Serif', sans-serif", fontWeight: 800, fontSize: 32,
                margin: 0, letterSpacing: "-0.02em", color: "#fff",
                lineHeight: 1,
              }}>
                Global Threat Insights
              </h1>
              <p style={{ fontSize: 13, color: "rgba(220, 213, 213, 0.35)", marginTop: 6, marginBottom: 0 }}>
                AI-powered threat intelligence across {assets.length} monitored assets
              </p>
            </div>
            <button style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.7)",
              fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              cursor: "pointer",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export Report
            </button>
          </div>

          {/* ── Top Metrics Row ─────────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} h={88} style={{ borderRadius: 16 }} />
            )) : (<>
              <StatTile label="Total Violations" value={fmt(totalViolations)}
                sub={`${activeIncidents} active incidents`} accentColor="#ef4444"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>}
              />
              <StatTile label="Total Estimated Views" value={fmt(totalViews)}
                sub={viralCount > 0 ? `${viralCount} assets viral` : undefined} accentColor="#f97316"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>}
              />
              <StatTile label="Traced Leakers" value={totalTracedLeakers}
                sub={`${totalUniqueLeakers} unique actors`} accentColor="#eab308"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
              />
              <StatTile label="Avg Threat Score" value={avgThreatScore.toFixed(2)}
                sub={acceleratingCount > 0 ? `${acceleratingCount} accelerating` : "all stable"} accentColor={scoreColor(avgThreatScore)}
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg>}
              />
            </>)}
          </div>

          {/* ── Secondary Metrics Row ──────────────────────────────────────── */}
          {!loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              <StatTile label="Total Attributed" value={totalAttributed}
                sub={`Avg ${avgAttributionRate.toFixed(0)}% rate`} accentColor="#8b5cf6"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" /></svg>}
              />
              <StatTile label="Match Confidence" value={`${(avgConfidence * 100).toFixed(0)}%`}
                sub={`${avgWmVerifiedPct.toFixed(0)}% watermarked`} accentColor="#06b6d4"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
              />
              <StatTile label="Total Likes" value={fmt(totalLikes)}
                sub="engagement signal" accentColor="#ec4899"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>}
              />
              <StatTile label="Platforms Tracked" value={platforms.length}
                sub={platforms[0] ? `Top: ${platforms[0].name}` : undefined} accentColor="#14b8a6"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>}
              />
            </div>
          )}

          {/* ── Tabs ───────────────────────────────────────────────────────── */}
          <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
            {tabs.map(t => (
              <button key={t.id} className={`tab-btn ${activeTab === t.id ? "active" : ""}`}
                onClick={() => setActiveTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              TAB: OVERVIEW
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "overview" && (
            <div className="insights-fade">
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>

                {/* AI Global Assessment */}
                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <h3 style={{ fontSize: 24, fontWeight: 600, color: "#8ec5ff", margin: 0, fontFamily: "'IBM Plex Serif', serif" }}>Global AI Threat Assessment</h3>
                    {acceleratingCount > 0 ? (
                      <span style={{
                        fontSize: 9, fontWeight: 800, color: "#ef4444",
                        background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                        padding: "3px 8px", borderRadius: 99, textTransform: "uppercase", letterSpacing: "0.1em",
                        animation: "pulse 2s ease-in-out infinite",
                      }}>
                        ⚠ {acceleratingCount} Accelerating
                      </span>
                    ) : null}
                  </div>
                  {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <Skeleton h={14} /><Skeleton h={14} w="80%" /><Skeleton h={60} style={{ marginTop: 12, borderRadius: 10 }} />
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, margin: "0 0 16px" }}>
                        Tracking <strong style={{ color: "#fff" }}>{totalViolations}</strong> confirmed violations across{" "}
                        <strong style={{ color: "#fff" }}>{activeIncidents}</strong> active incidents.
                        Commercial piracy intent flagged in <strong style={{ color: "#ef4444" }}>{dist.Critical}</strong> Critical-tier assets.
                        Avg confidence: <strong style={{ color: "#06b6d4" }}>{(avgConfidence * 100).toFixed(0)}%</strong>.
                        {acceleratingCount > 0 && (
                          <span style={{ color: "#f97316" }}> {acceleratingCount} assets are showing accelerating violation velocity.</span>
                        )}
                      </p>
                      <div style={{
                        background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)",
                        borderLeft: "3px solid #ef4444",
                        borderRadius: 12, padding: "14px 16px",
                      }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>
                          Top Priority AI Analysis — {topAssets[0]?.insights?.ai_analysis.primary_intent ?? "—"}
                        </div>
                        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
                          "{globalSummary}"
                        </p>
                      </div>
                    </>
                  )}
                </Card>

                {/* Risk Distribution */}
                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <h3 style={{
                      fontFamily: "'IBM Plex Serif', serif", fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                      margin: 0,
                    }}>
                      Risk Distribution
                    </h3>
                  </div>
                  {loading ? <Skeleton h={120} style={{ borderRadius: 12 }} /> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {(["Critical", "High", "Medium", "Low"] as const).map((level, idx) => {
                        const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e"];
                        const count = dist[level];
                        const pct = assets.length > 0 ? Math.round((count / assets.length) * 100) : 0;
                        return <RiskBar key={level} level={level} count={count} pct={pct} color={colors[idx]} idx={idx} />;
                      })}
                    </div>
                  )}
                </Card>
              </div>

              {/* Detection Pipeline */}
              {!loading && Object.keys(stageMap).length > 0 && (
                <Card style={{ marginBottom: 16 }}>
                  <CardHeader title="Detection Pipeline — Stage Hit Rates" />
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {Object.entries(stageMap).map(([stage, count]) => (
                      <StageBadge key={stage} stage={stage} count={count} total={totalStageViolations} />
                    ))}
                  </div>
                </Card>
              )}

              {/* Priority Targets Grid */}
              <div>
                <h3 style={{
                  fontFamily: "'IBM Plex Serif', serif", fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                  marginBottom: 14,
                }}>
                  Priority Targets — Ranked by Composite Score
                </h3>
                {loading ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={140} style={{ borderRadius: 16 }} />)}
                  </div>
                ) : topAssets.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                    No high-priority targets detected yet.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                    {topAssets.map((asset, idx) => {
                      const score = asset.insights!.composite_threat_score;
                      const color = scoreColor(score);
                      const tier = asset.insights!.engagement_risk.exposure_tier;
                      const accel = asset.insights!.velocity.acceleration;
                      return (
                        <Link href={`/insights/${asset.id}`} key={asset.id} style={{ textDecoration: "none" }}>
                          <div className="asset-card" style={{
                            background: "rgba(255,255,255,0.03)",
                            border: `1px solid rgba(255,255,255,0.07)`,
                            borderRadius: 16, padding: 18,
                            cursor: "pointer",
                            animationDelay: `${idx * 60}ms`,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                              <div style={{ position: "relative", flexShrink: 0 }}>
                                <img src={getAssetImageUrl(asset.id)} alt={asset.name}
                                  style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", display: "block" }} />
                                {idx === 0 && (
                                  <div style={{
                                    position: "absolute", top: -4, right: -4,
                                    background: "#ef4444", borderRadius: "50%", width: 14, height: 14,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 8, fontWeight: 800, color: "#fff",
                                  }}>1</div>
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                  {asset.name}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                                  <TierPill tier={tier} />
                                  <span style={{ fontSize: 9, color: accelColor(accel), fontWeight: 700, textTransform: "uppercase", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                    {accel}
                                  </span>
                                </div>
                              </div>
                              <ScoreRing score={score} size={56} />
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                              {[
                                { label: "Violations", val: asset.violation_count },
                                { label: "Views", val: fmt(asset.insights!.engagement_risk.total_estimated_views) },
                                { label: "Leakers", val: asset.insights!.leaker_profile.unique_leaker_count },
                              ].map(m => (
                                <div key={m.label} style={{
                                  background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "7px 10px",
                                }}>
                                  <div style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "'IBM Plex Sans', sans-serif" }}>{m.val}</div>
                                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'IBM Plex Sans', sans-serif" }}>{m.label}</div>
                                </div>
                              ))}
                            </div>
                            <div style={{ marginTop: 10, fontSize: 13, color: "rgba(255,255,255,0.4)", fontStyle: "italic", lineHeight: 1.4, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                              {asset.insights!.ai_analysis.ai_summary.slice(0, 80)}{asset.insights!.ai_analysis.ai_summary.length > 80 ? "…" : ""}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: FORENSICS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "forensics" && (
            <div className="insights-fade">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <h3 style={{
                      fontFamily: "'IBM Plex Serif', serif", fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                      margin: 0,
                    }}>
                      Watermark Attribution
                    </h3>
                  </div>
                  {loading ? <Skeleton h={120} style={{ borderRadius: 12 }} /> : (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                        {[
                          { label: "Attributed Violations", val: totalAttributed, color: "#8b5cf6" },
                          { label: "Traced to Recipients", val: totalTracedLeakers, color: "#ef4444" },
                          { label: "Avg Attribution Rate", val: `${avgAttributionRate.toFixed(1)}%`, color: "#06b6d4" },
                          { label: "Avg WM Verified", val: `${avgWmVerifiedPct.toFixed(1)}%`, color: "#22c55e" },
                        ].map(m => (
                          <div key={m.label} style={{
                            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 10, padding: "12px 14px",
                          }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: m.color, fontFamily: "'IBM Plex Sans', sans-serif" }}>{m.val}</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3, fontFamily: "'IBM Plex Sans', sans-serif" }}>{m.label}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Card>

                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <h3 style={{
                      fontFamily: "'IBM Plex Serif', serif", fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                      margin: 0,
                    }}>
                      Match Signal Quality
                    </h3>
                  </div>
                  {loading ? <Skeleton h={120} style={{ borderRadius: 12 }} /> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        { label: "Avg Overall Confidence", val: `${(avgConfidence * 100).toFixed(1)}%`, color: "#06b6d4" },
                        {
                          label: "Avg Reranked Confidence", val: (() => {
                            const avg = withInsights.length
                              ? withInsights.reduce((s, a) => s + (a.insights?.match_quality.reranked_confidence_avg ?? 0), 0) / withInsights.length : 0;
                            return `${(avg * 100).toFixed(1)}%`;
                          })(), color: "#8b5cf6"
                        },
                        { label: "Total pHash Identical", val: withInsights.reduce((s, a) => s + (a.insights?.match_quality.phash.identical_count ?? 0), 0), color: "#ef4444" },
                        { label: "CLIP ≥0.92 Matches", val: withInsights.reduce((s, a) => s + (a.insights?.match_quality.clip_similarity.above_0_92_count ?? 0), 0), color: "#f97316" },
                        { label: "Heavily Altered (SSIM<0.80)", val: withInsights.reduce((s, a) => s + (a.insights?.match_quality.ssim_alteration.heavily_altered_count ?? 0), 0), color: "#eab308" },
                      ].map(m => (
                        <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", fontFamily: "'IBM Plex Sans', sans-serif" }}>{m.label}</span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: m.color, fontFamily: "'IBM Plex Sans', sans-serif" }}>{m.val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Traced Recipients Table */}
              {!loading && withInsights.length > 0 && (
                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <h3 style={{
                      fontFamily: "'IBM Plex Serif', serif", fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                      margin: 0,
                    }}>
                      Traced Recipients — Watermark Cross-Reference
                    </h3>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Recipient", "Platform", "Violation URL", "Detected"].map(h => (
                            <th key={h} style={{
                              textAlign: "left", padding: "8px 12px",
                              fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.3)",
                              textTransform: "uppercase", letterSpacing: "0.1em",
                              borderBottom: "1px solid rgba(255,255,255,0.06)",
                              fontFamily: "'IBM Plex Sans', sans-serif",
                            }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {withInsights.flatMap(a =>
                          a.insights!.watermark_forensics.traced_recipients.slice(0, 3).map(r => (
                            <tr key={`${a.id}-${r.violation_id}`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td style={{ padding: "10px 12px" }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: "'IBM Plex Sans', sans-serif" }}>{r.recipient_name}</div>
                                {r.recipient_identifier && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'IBM Plex Sans', sans-serif" }}>{r.recipient_identifier}</div>}
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#f97316", textTransform: "uppercase", fontFamily: "'IBM Plex Sans', sans-serif" }}>{r.platform}</span>
                              </td>
                              <td style={{ padding: "10px 12px" }}>
                                {r.source_url ? (
                                  <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                                    style={{ fontSize: 10, color: "#06b6d4", textDecoration: "none" }}>
                                    {r.source_url.slice(0, 40)}…
                                  </a>
                                ) : <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>—</span>}
                              </td>
                              <td style={{ padding: "10px 12px", fontSize: 10, color: "rgba(255,255,255,0.35)", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                {r.detected_at ? new Date(r.detected_at).toLocaleDateString() : "—"}
                              </td>
                            </tr>
                          ))
                        ).slice(0, 12)}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: PLATFORMS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "platforms" && (
            <div className="insights-fade">
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <h3 style={{
                      fontFamily: "'IBM Plex Serif', serif", fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                      margin: 0,
                    }}>
                      Platform Exposure Breakdown — By Total Views
                    </h3>
                  </div>
                  {loading ? <Skeleton h={200} style={{ borderRadius: 12 }} /> : (
                    <div>
                      {platforms.map((p, i) => (
                        <PlatformBar key={p.name}
                          platform={p.name} views={p.views} maxViews={maxPlatformViews}
                          violations={p.violations} confidence={p.confidence}
                          color={PLATFORM_COLORS[i % PLATFORM_COLORS.length]}
                        />
                      ))}
                    </div>
                  )}
                </Card>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <Card>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                      <h3 style={{
                        fontFamily: "'IBM Plex Serif', serif", fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                        margin: 0,
                      }}>
                        Exposure Tiers
                      </h3>
                    </div>
                    {loading ? <Skeleton h={100} style={{ borderRadius: 12 }} /> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(["VIRAL", "HIGH", "MODERATE", "LOW"] as const).map(tier => {
                          const count = withInsights.filter(a => a.insights?.engagement_risk.exposure_tier === tier).length;
                          return (
                            <div key={tier} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                              <TierPill tier={tier} />
                              <span style={{ fontSize: 15, fontWeight: 800, color: tierColor(tier), fontFamily: "'IBM Plex Sans', sans-serif" }}>{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>

                  <Card>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                      <h3 style={{
                        fontFamily: "'IBM Plex Serif', serif", fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                        margin: 0,
                      }}>
                        Velocity Summary
                      </h3>
                    </div>
                    {loading ? <Skeleton h={100} style={{ borderRadius: 12 }} /> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {(["ACCELERATING", "STABLE", "DECLINING", "UNKNOWN"] as const).map(state => {
                          const count = withInsights.filter(a => a.insights?.velocity.acceleration === state).length;
                          return (
                            <div key={state} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: accelColor(state), textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                {state}
                              </span>
                              <span style={{ fontSize: 15, fontWeight: 800, color: accelColor(state), fontFamily: "'IBM Plex Sans', sans-serif" }}>{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: LEAKERS
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "leakers" && (
            <div className="insights-fade">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <h3 style={{
                      fontFamily: "'IBM Plex Serif', serif", fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                      margin: 0,
                    }}>
                      Top Leaker Actors — {topLeakers.length} identified
                    </h3>
                  </div>
                  {loading ? <Skeleton h={240} style={{ borderRadius: 12 }} /> : topLeakers.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.25)", fontSize: 15, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                      No leaker data available yet.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {topLeakers.map((l, i) => (
                        <LeakerBar key={l.leaker} leaker={l.leaker} count={l.count} maxCount={topLeakers[0].count} idx={i} />
                      ))}
                    </div>
                  )}
                </Card>

                <Card>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <h3 style={{
                      fontFamily: "'IBM Plex Serif', serif", fontSize: 24, fontWeight: 500, color: "rgba(255,255,255,0.6)",
                      margin: 0,
                    }}>
                      Leaker Risk Profile — Per Asset
                    </h3>
                  </div>
                  {loading ? <Skeleton h={240} style={{ borderRadius: 12 }} /> : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 400, overflowY: "auto" }}>
                      {withInsights
                        .filter(a => a.insights!.leaker_profile.top_leaker)
                        .sort((a, b) => (b.insights!.leaker_profile.top_leaker_count) - (a.insights!.leaker_profile.top_leaker_count))
                        .map(a => {
                          const lp = a.insights!.leaker_profile;
                          const color = leakerRiskColor(lp.leaker_risk_level);
                          return (
                            <div key={a.id} style={{
                              padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 10,
                              display: "flex", alignItems: "center", gap: 12,
                            }}>
                              <img src={getAssetImageUrl(a.id)} alt={a.name}
                                style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'IBM Plex Sans', sans-serif" }}>{a.name}</div>
                                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                  Top: <span style={{ color: "#fff" }}>{lp.top_leaker}</span> ({lp.top_leaker_count}×)
                                  {lp.is_registered_recipient && (
                                    <span style={{ color: "#ef4444", marginLeft: 6 }}>⚠ Known Recipient</span>
                                  )}
                                </div>
                              </div>
                              <div style={{ flexShrink: 0 }}>
                                <span style={{
                                  fontSize: 9, fontWeight: 800, color, background: `${color}1a`,
                                  border: `1px solid ${color}40`, padding: "2px 7px", borderRadius: 99, textTransform: "uppercase",
                                }}>
                                  {lp.leaker_risk_level}
                                </span>
                                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "right", marginTop: 3, fontFamily: "'IBM Plex Sans', sans-serif" }}>
                                  {lp.unique_leaker_count} unique
                                </div>
                              </div>
                            </div>
                          );
                        })
                      }
                      {withInsights.filter(a => a.insights!.leaker_profile.top_leaker).length === 0 && (
                        <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.25)", fontSize: 13 }}>
                          No leaker profiles identified yet.
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}