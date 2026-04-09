"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getAsset, type Asset } from "@/lib/api";

const API_BASE = "http://localhost:8000/api";

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

async function getAssetInsights(assetId: string): Promise<InsightsData> {
  const res = await fetch(`${API_BASE}/assets/${assetId}/insights`);
  if (!res.ok) throw new Error("Failed to load insights");
  return res.json();
}

function riskColor(score: number): string {
  if (score >= 7) return "#ef4444";
  if (score >= 4) return "#f59e0b";
  return "#22c55e";
}

function riskLabel(level: string): { color: string; bg: string } {
  switch (level) {
    case "CRITICAL":
      return { color: "#fca5a5", bg: "rgba(239, 68, 68, 0.15)" };
    case "MEDIUM":
      return { color: "#fcd34d", bg: "rgba(245, 158, 11, 0.15)" };
    default:
      return { color: "#86efac", bg: "rgba(34, 197, 94, 0.15)" };
  }
}

function intentIcon(intent: string): string {
  switch (intent) {
    case "COMMERCIAL_PIRACY":
      return "🏴‍☠️";
    case "PARODY_MEME":
      return "😂";
    case "NEWS_REVIEW":
      return "📰";
    default:
      return "❓";
  }
}

export default function AssetInsightsPage() {
  const params = useParams();
  const assetId = params.id as string;
  const [asset, setAsset] = useState<Asset | null>(null);
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAsset(assetId), getAssetInsights(assetId)])
      .then(([assetData, insightsData]) => {
        setAsset(assetData);
        setInsights(insightsData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [assetId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center" style={{ height: "60vh" }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">⚠️</p>
        <p className="text-lg font-medium mb-2">Failed to load insights</p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{error}</p>
      </div>
    );
  }

  if (!insights || insights.total_violations === 0) {
    return (
      <div>
        <div className="mb-6">
          <a href="/assets" className="text-sm" style={{ color: "var(--accent-primary)" }}>
            ← Back to Assets
          </a>
          <h1 className="text-3xl font-bold mt-2 mb-2">Deep Insights</h1>
          <p style={{ color: "var(--text-secondary)" }}>{asset?.name}</p>
        </div>
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🔍</p>
          <p className="text-lg font-medium mb-2">No violations detected yet</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Scan some content first to generate insights for this asset
          </p>
        </div>
      </div>
    );
  }

  const tm = insights.threat_metrics;
  const lp = insights.leaker_profile;
  const si = insights.semantic_intent;
  const aa = insights.alteration_analysis;
  const leakerStyle = riskLabel(lp.leaker_risk_level);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <a href="/assets" className="text-sm" style={{ color: "var(--accent-primary)" }}>
          ← Back to Assets
        </a>
        <h1 className="text-3xl font-bold mt-2 mb-2">Deep Insights</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          {asset?.name} — AI-powered threat analysis
        </p>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 animate-fade-in">
        <div className="stats-card">
          <p className="text-2xl font-bold" style={{ color: "var(--danger)" }}>
            {insights.total_violations}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Total Violations</p>
        </div>
        <div className="stats-card">
          <p className="text-2xl font-bold" style={{ color: riskColor(tm.average_threat_score) }}>
            {tm.average_threat_score.toFixed(1)}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Threat Score /10</p>
        </div>
        <div className="stats-card">
          <p className="text-2xl font-bold" style={{ color: "#3b82f6" }}>
            {tm.total_estimated_views.toLocaleString()}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Estimated Views</p>
        </div>
        <div className="stats-card">
          <p className="text-2xl font-bold capitalize" style={{ color: "#f59e0b" }}>
            {tm.highest_threat_platform}
          </p>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Top Platform</p>
        </div>
      </div>

      {/* Main Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>

        {/* AI Summary Card */}
        <div className="card p-6" style={{ borderTop: "4px solid #8b5cf6" }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🤖</span>
            <h3 className="text-sm font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
              AI Analysis
            </h3>
          </div>
          <div
            className="p-4 rounded-lg mb-4"
            style={{
              background: "rgba(139, 92, 246, 0.08)",
              border: "1px solid rgba(139, 92, 246, 0.2)",
            }}
          >
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
              {si.ai_summary || "No AI summary available."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl">{intentIcon(si.primary_intent)}</span>
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Detected Intent</p>
              <p className="text-sm font-semibold" style={{ color: "#a78bfa" }}>
                {si.primary_intent.replace(/_/g, " ")}
              </p>
            </div>
          </div>
        </div>

        {/* Leaker Profile Card */}
        <div className="card p-6" style={{ borderTop: `4px solid ${leakerStyle.color}` }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🕵️</span>
            <h3 className="text-sm font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
              Leaker Profile
            </h3>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>Top Leaker</p>
              <p className="text-lg font-bold">{lp.top_leaker}</p>
            </div>
            <span
              className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{
                background: leakerStyle.bg,
                color: leakerStyle.color,
                border: `1px solid ${leakerStyle.color}40`,
              }}
            >
              {lp.leaker_risk_level}
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {lp.leaker_risk_level === "CRITICAL"
              ? "This leaker has been identified in 3+ violations — immediate action recommended."
              : lp.leaker_risk_level === "MEDIUM"
              ? "This leaker has appeared in multiple violations — monitor closely."
              : "Low-frequency leak source. Continue standard monitoring."}
          </p>
        </div>

        {/* Threat Score Gauge */}
        <div className="card p-6" style={{ borderTop: "4px solid #f59e0b" }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🎯</span>
            <h3 className="text-sm font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
              Threat Metrics
            </h3>
          </div>
          <div className="space-y-4">
            {/* Threat Score Bar */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Risk Level</span>
                <span className="font-mono font-bold" style={{ color: riskColor(tm.average_threat_score) }}>
                  {tm.average_threat_score.toFixed(1)} / 10
                </span>
              </div>
              <div className="w-full rounded-full h-3" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-3 rounded-full transition-all"
                  style={{
                    width: `${Math.min(tm.average_threat_score * 10, 100)}%`,
                    background: `linear-gradient(90deg, #22c55e, #f59e0b, #ef4444)`,
                  }}
                ></div>
              </div>
            </div>
            {/* Views */}
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: "rgba(59, 130, 246, 0.08)" }}>
              <span className="text-sm">👁️ Estimated Reach</span>
              <span className="font-mono font-bold" style={{ color: "#60a5fa" }}>
                {tm.total_estimated_views.toLocaleString()} views
              </span>
            </div>
            {/* Platform */}
            <div className="flex justify-between items-center p-3 rounded-lg" style={{ background: "rgba(245, 158, 11, 0.08)" }}>
              <span className="text-sm">🌐 Highest Threat Platform</span>
              <span className="font-mono font-bold capitalize" style={{ color: "#fbbf24" }}>
                {tm.highest_threat_platform}
              </span>
            </div>
          </div>
        </div>

        {/* Alteration Analysis */}
        <div className="card p-6" style={{ borderTop: "4px solid #06b6d4" }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🔬</span>
            <h3 className="text-sm font-semibold uppercase" style={{ color: "var(--text-muted)" }}>
              Alteration Analysis
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg text-center" style={{ background: "rgba(6, 182, 212, 0.08)" }}>
              <p className="text-2xl font-bold" style={{ color: "#22d3ee" }}>
                {aa.visually_altered_count}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Altered Copies</p>
            </div>
            <div className="p-4 rounded-lg text-center" style={{ background: "rgba(6, 182, 212, 0.08)" }}>
              <p className="text-2xl font-bold" style={{ color: "#22d3ee" }}>
                {(aa.average_ssim_score * 100).toFixed(0)}%
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Avg Similarity</p>
            </div>
          </div>
          <p className="text-xs mt-4" style={{ color: "var(--text-secondary)" }}>
            {aa.visually_altered_count > 0
              ? `${aa.visually_altered_count} violation(s) show visual modifications (SSIM < 90%). The content may have been cropped, resized, or re-encoded.`
              : "All detected copies appear to be unaltered reproductions of the original."}
          </p>
        </div>
      </div>
    </div>
  );
}
