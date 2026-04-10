"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getAsset, getAssetImageUrl, type Asset } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

const API_BASE = "http://localhost:8000/api";

// ─── Insights API ─────────────────────────────────────────────────────────────
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

// ─── Risk score color ─────────────────────────────────────────────────────────
function riskScoreColor(score: number): string {
  if (score >= 7) return "text-[var(--neu-danger)]";
  if (score >= 4) return "text-[var(--neu-warning)]";
  return "text-[var(--neu-success)]";
}

function riskScoreVariant(score: number): "violation" | "pending" | "verified" {
  if (score >= 7) return "violation";
  if (score >= 4) return "pending";
  return "verified";
}

// ─── Leaker Profile Card ──────────────────────────────────────────────────────
function LeakerCard({
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
  const initials = name.split(/[\s@]+/).map((w) => w[0]?.toUpperCase()).slice(0, 2).join("");

  return (
    <div className="flex items-center gap-4 py-4 border-b border-[var(--neu-surface-dk)] opacity-90 last:border-none">
      <div className="w-10 h-10 rounded-[10px] neu-inset flex items-center justify-center shrink-0">
        <span className="text-[12px] font-bold text-[var(--neu-primary)]">{initials}</span>
      </div>
      <div className="flex-1 min-w-0 pr-3">
        <p className="text-[14px] font-bold text-[var(--neu-text)] truncate">{name}</p>
        <p className="text-[11px] font-mono text-[var(--neu-text-muted)] mt-1">{violations} violations linked</p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <Badge variant="neutral">{platform}</Badge>
        <span className="text-[14px] font-mono font-bold text-[var(--neu-text-muted)] tabular-nums">{confidence}%</span>
      </div>
    </div>
  );
}

// ─── Timeline Event ────────────────────────────────────────────────────────────
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
  const dotColor = {
    red:   "bg-[var(--neu-danger)] shadow-[0_0_8px_var(--neu-danger)]",
    amber: "bg-[var(--neu-warning)] shadow-[0_0_8px_var(--neu-warning)]",
    blue:  "bg-[var(--neu-primary)] shadow-[0_0_8px_var(--neu-primary)]",
  };
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 neu-raised ${dotColor[severity]}`} />
        {!isLast && <div className="w-1 flex-1 neu-inset my-2 rounded-full" />}
      </div>
      <div className="pb-6">
        <p className="text-[14px] font-bold text-[var(--neu-text)]">{label}</p>
        <p className="text-[11px] font-mono text-[var(--neu-text-muted)] mt-1.5">{timestamp}</p>
      </div>
    </div>
  );
}

// ─── Recommended Actions ───────────────────────────────────────────────────────
function RecommendedActions({ hasViolations }: { hasViolations: boolean }) {
  const actions = [
    {
      n: "01",
      label: "Send DMCA Takedown",
      desc: "Issue a formal DMCA notice to hosting platforms for all detected violations.",
      cta: "Send DMCA",
      href: "/actions",
    },
    {
      n: "02",
      label: "Run Full Platform Scan",
      desc: "Trigger a comprehensive discovery sweep across Twitter, YouTube, Telegram, and Google.",
      cta: "Scan Now",
      href: "/scan",
    },
    {
      n: "03",
      label: "Review Propagation Graph",
      desc: "Explore the visual spread map to identify the highest-risk distribution paths.",
      cta: "View Graph",
      href: "/graph",
    },
  ];

  return (
    <div className="neu-raised overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-90">
        <h2 className="text-[15px] font-bold text-[var(--neu-text)] uppercase tracking-wide">Recommended Actions</h2>
      </div>
      <div className="p-6 space-y-6">
        {actions.map((a, i) => (
          <div key={a.n} className={`${i < actions.length - 1 ? "pb-6 border-b border-[var(--neu-surface-dk)]" : ""}`}>
            <div className="flex items-start gap-4">
              <span className="text-[14px] font-mono font-bold text-[var(--neu-primary)] neu-inset p-2 rounded-[8px] shrink-0 leading-none">{a.n}</span>
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-[14px] font-bold text-[var(--neu-text)] mb-1">{a.label}</p>
                <p className="text-[13px] font-sans text-[var(--neu-text-muted)] leading-relaxed">{a.desc}</p>
                <div className="mt-4">
                  <a href={a.href}>
                    <Button variant="secondary" size="sm">{a.cta}</Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Insights Detail Page ──────────────────────────────────────────────────────
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

  if (loading) {
    return (
      <>
        <PageHeader title="Insights" backHref="/insights" backLabel="Back to Insights" />
        <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 gap-5">
                <Skeleton className="h-[120px] rounded-xl neu-raised" />
                <Skeleton className="h-[120px] rounded-xl neu-raised" />
                <Skeleton className="h-[120px] rounded-xl neu-raised" />
                <Skeleton className="h-[120px] rounded-xl neu-raised" />
              </div>
              <Skeleton className="h-48 w-full rounded-xl neu-raised" />
              <Skeleton className="h-64 w-full rounded-xl neu-raised" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-72 rounded-xl neu-raised" />
              <Skeleton className="h-96 rounded-xl neu-raised" />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !insights || insights.total_violations === 0) {
    const message = error ?? "No violations detected for this asset yet.";
    const sub = error ? error : "Run a scan to generate insights data.";
    return (
      <>
        <PageHeader title={asset?.name ?? "Insights"} backHref="/insights" backLabel="Back to Insights" />
        <div className="flex-1 px-8 py-20 text-center max-w-[800px] mx-auto neu-inset rounded-[20px] mt-8">
          <div className="w-14 h-14 neu-raised rounded-xl flex items-center justify-center mx-auto mb-5 text-[var(--neu-text-faint)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
            </svg>
          </div>
          <p className="text-[16px] font-bold text-[var(--neu-text)] uppercase tracking-wide mb-2">{message}</p>
          <p className="text-[13px] font-sans text-[var(--neu-text-muted)] mb-6">{sub}</p>
          <a href="/scan"><Button variant="primary">Scan Now</Button></a>
        </div>
      </>
    );
  }

  const tm = insights.threat_metrics;
  const lp = insights.leaker_profile;
  const si = insights.semantic_intent;
  const aa = insights.alteration_analysis;

  const mockLeakers = [
    { name: lp.top_leaker,          platform: tm.highest_threat_platform, violations: Math.floor(insights.total_violations * 0.6), confidence: 92 },
    { name: "@unknown_user_443",     platform: "Telegram",                 violations: Math.floor(insights.total_violations * 0.3), confidence: 74 },
    { name: "@redistributor_7x",     platform: "Twitter",                  violations: Math.floor(insights.total_violations * 0.1), confidence: 58 },
  ].filter((l) => l.violations > 0);

  const timelineEvents = [
    { label: "Asset registered",       timestamp: asset ? new Date(asset.created_at).toLocaleString() : "—", severity: "blue" as const },
    { label: "First violation detected",timestamp: "2h after registration",   severity: "amber" as const },
    { label: "Spread to Telegram",      timestamp: "4h after registration",   severity: "amber" as const },
    { label: `${insights.total_violations} violations confirmed`, timestamp: "Latest scan",    severity: "red"   as const },
  ];

  return (
    <>
      <PageHeader
        title={asset?.name ?? "Asset Insights"}
        subtitle="AI-powered threat analysis and leaker profiling"
        backHref="/insights"
        backLabel="Back to Insights"
        action={
          <Button variant="secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Export Report
          </Button>
        }
      />

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column — 65% ──────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            <p className="text-[12px] font-bold text-[var(--neu-text-muted)] uppercase tracking-widest pl-2">Threat Analysis</p>

            <div className="grid grid-cols-2 gap-5">
              {/* Risk Score */}
              <div className="neu-raised p-6 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-3">Risk Score</p>
                <p className={`font-mono text-[42px] font-bold leading-none ${riskScoreColor(tm.average_threat_score)}`}>
                  {tm.average_threat_score.toFixed(1)}
                  <span className="text-[18px] text-[var(--neu-text-faint)]"> /10</span>
                </p>
                <div className="mt-4">
                  <Badge variant={riskScoreVariant(tm.average_threat_score)}>
                    {tm.average_threat_score >= 7 ? "Critical" : tm.average_threat_score >= 4 ? "High risk" : "Low risk"}
                  </Badge>
                </div>
              </div>

              {/* Estimated Reach */}
              <div className="neu-raised p-6 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-3">Estimated Reach</p>
                <p className="font-mono text-[42px] font-bold text-[var(--neu-primary)] leading-none">
                  {tm.total_estimated_views >= 1000 ? `${(tm.total_estimated_views / 1000).toFixed(0)}K` : tm.total_estimated_views}
                </p>
                <p className="text-[11px] font-bold text-[var(--neu-text-muted)] uppercase tracking-wide mt-3">Estimated views</p>
              </div>

              {/* Unique Violators */}
              <div className="neu-raised p-6 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-3">Total Violations</p>
                <p className="font-mono text-[36px] font-bold text-[var(--neu-text)] leading-none">{insights.total_violations}</p>
                <p className="text-[11px] font-bold text-[var(--neu-text-muted)] uppercase tracking-wide mt-3">Across platforms</p>
              </div>

              {/* Top Platform */}
              <div className="neu-raised p-6 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-3">Top Threat Platform</p>
                <p className="font-sans text-[28px] font-bold text-[var(--neu-text)] capitalize leading-none pt-2 pb-1">{tm.highest_threat_platform}</p>
                <p className="text-[11px] font-bold text-[var(--neu-text-muted)] uppercase tracking-wide mt-3">Highest exposure</p>
              </div>
            </div>

            {/* AI Analysis card */}
            <div className="neu-raised overflow-hidden">
              <div className="px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-90 flex items-center justify-between">
                <p className="text-[13px] font-bold text-[var(--neu-text)] uppercase tracking-wide flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--neu-primary)]">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Gemini AI Summary
                </p>
                <span className="text-[11px] font-mono text-[var(--neu-text-muted)]">Intent: <strong className="text-[var(--neu-text)]">{si.primary_intent.replace(/_/g, " ")}</strong></span>
              </div>
              <div className="p-6 neu-inset-sm m-4 rounded-[12px] border border-[var(--neu-surface-lt)]">
                <p className="text-[14px] font-sans text-[var(--neu-text-muted)] leading-[1.8]">
                  {si.ai_summary || "No AI summary available for this asset."}
                </p>
              </div>
            </div>

            {/* Leaker Profiles section */}
            <div className="pt-2">
              <p className="text-[12px] font-bold text-[var(--neu-text-muted)] uppercase tracking-widest mb-4 pl-2">Leaker Profiles</p>
              <div className="neu-raised px-6 py-2">
                {mockLeakers.map((l) => (
                  <LeakerCard
                    key={l.name}
                    name={l.name}
                    platform={l.platform}
                    violations={l.violations}
                    confidence={l.confidence}
                  />
                ))}
              </div>
            </div>

            {/* Alteration analysis */}
            {aa.visually_altered_count > 0 && (
              <div className="neu-raised p-6 mt-6">
                <p className="text-[13px] font-bold text-[var(--neu-text)] uppercase tracking-wide mb-5">Alteration Analysis</p>
                <div className="flex items-start gap-6">
                  <div className="neu-inset p-4 rounded-[12px] text-center min-w-[100px]">
                    <p className="font-mono text-[28px] font-bold text-[var(--neu-primary)]">{aa.visually_altered_count}</p>
                    <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mt-2">altered</p>
                  </div>
                  <div className="neu-inset p-4 rounded-[12px] text-center min-w-[100px]">
                    <p className="font-mono text-[28px] font-bold text-[var(--neu-text)]">{(aa.average_ssim_score * 100).toFixed(0)}%</p>
                    <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mt-2">avg SSIM</p>
                  </div>
                  <p className="text-[13px] font-sans text-[var(--neu-text-muted)] leading-relaxed pt-2">
                    {aa.visually_altered_count} violation{aa.visually_altered_count !== 1 ? "s" : ""} show visible modifications
                    (SSIM &lt; 90%). Content may have been cropped, re-encoded, or colour-graded to evade detection.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Right column — 35%, sticky ─────────────── */}
          <div className="space-y-6 lg:sticky lg:top-[90px] lg:self-start">

            <div className="neu-raised p-6">
              <h2 className="text-[15px] font-bold text-[var(--neu-text)] uppercase tracking-wide mb-6">Threat Timeline</h2>
              <div>
                {timelineEvents.map((ev, i) => (
                  <TimelineEvent
                    key={i}
                    label={ev.label}
                    timestamp={ev.timestamp}
                    severity={ev.severity}
                    isLast={i === timelineEvents.length - 1}
                  />
                ))}
              </div>
            </div>

            <RecommendedActions hasViolations={insights.total_violations > 0} />

            <Button variant="primary" className="w-full justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export Full Report
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
