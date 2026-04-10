"use client";

import { useState, useEffect } from "react";
import { listAssets, getAssetImageUrl, type Asset } from "@/lib/api";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/ui/MetricCard";
import { SkeletonAssetCard } from "@/components/ui/Skeleton";

// ─── Mock insight data per asset ───────────────────────────────────────────────
function mockInsight(asset: Asset) {
  const score = Math.floor(20 + asset.violation_count * 15 + Math.random() * 30);
  const threats = asset.violation_count + Math.floor(Math.random() * 4);
  const leakers = Math.max(1, Math.floor(asset.violation_count * 0.7));
  const summaries = [
    "AI analysis indicates high risk of commercial piracy on streaming platforms. Multiple near-duplicate copies detected with minor visual alterations.",
    "Content identified as spreading through Telegram channels with a coordinated distribution pattern. Watermark integrity compromised in 2 copies.",
    "Low-frequency leak pattern detected primarily on Twitter. Content appears mostly unaltered — standard distribution profile.",
    "Gemini threat analysis flags this asset as a priority target. Automated scraping bots detected across 4 platforms.",
  ];
  const threatLevel = score >= 70 ? "Critical" : score >= 40 ? "High" : score >= 20 ? "Medium" : "Low";
  const variant = score >= 70 ? "violation" : score >= 40 ? "pending" : score >= 20 ? "info" : "verified";
  const daysAgo = Math.floor(Math.random() * 10) + 1;
  return {
    score,
    threats,
    leakers,
    summary: summaries[asset.id.charCodeAt(0) % summaries.length],
    threatLevel,
    variant,
    generated: `${daysAgo}d ago`,
  };
}

// ─── Insights Card ─────────────────────────────────────────────────────────────
function InsightCard({ asset }: { asset: Asset }) {
  const insight = mockInsight(asset);

  return (
    <div className="neu-raised flex flex-col h-full">
      <div className="p-6 flex-1 flex flex-col">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 neu-inset rounded-[12px] overflow-hidden shrink-0 border border-transparent hover:border-[var(--neu-primary)] transition-colors">
            <img
              src={getAssetImageUrl(asset.id)}
              alt={asset.name}
              loading="lazy"
              className="w-full h-full object-cover opacity-90"
            />
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-[14px] font-bold text-[var(--neu-text)] truncate" title={asset.name}>{asset.name}</p>
            <p className="text-[11px] font-mono text-[var(--neu-text-muted)] mt-1.5">Generated {insight.generated}</p>
          </div>
          <Badge variant={insight.variant as "violation" | "pending" | "info" | "verified"}>
            {insight.threatLevel}
          </Badge>
        </div>

        <p className="text-[13px] font-sans text-[var(--neu-text-muted)] leading-relaxed line-clamp-2 mb-6">
          {insight.summary}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-[6px] neu-inset-sm text-[var(--neu-text)]">
              {insight.threats} threats
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-[6px] neu-inset-sm text-[var(--neu-text)]">
              {insight.leakers} leaker{insight.leakers !== 1 ? "s" : ""}
            </span>
          </div>
          <Link href={`/insights/${asset.id}`}>
            <Button variant="secondary" size="sm">Report</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Insights Index Page ───────────────────────────────────────────────────────
export default function InsightsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAssets()
      .then(setAssets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const analysed = assets.length;
  const threats  = assets.reduce((s, a) => s + a.violation_count, 0);
  const leakers  = assets.reduce((s, a) => s + Math.max(0, Math.floor(a.violation_count * 0.7)), 0);
  const reports  = assets.filter((a) => a.violation_count > 0).length;

  return (
    <>
      <PageHeader
        title="INSIGHTS"
        subtitle="AI-powered threat intelligence across all registered assets"
        action={
          <Button variant="primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Report
          </Button>
        }
      />

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard label="Assets Analysed"    value={loading ? "—" : analysed}         accentColor="blue"  />
          <MetricCard label="Threats Identified"  value={loading ? "—" : threats}           accentColor="red"   />
          <MetricCard label="Leaker Profiles"     value={loading ? "—" : leakers}           accentColor="amber" />
          <MetricCard label="Reports Generated"   value={loading ? "—" : reports}           accentColor="green" />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonAssetCard />
            <SkeletonAssetCard />
            <SkeletonAssetCard />
            <SkeletonAssetCard />
          </div>
        ) : assets.length === 0 ? (
          <div className="neu-inset rounded-[20px] px-8 py-20 text-center">
            <div className="w-14 h-14 neu-raised rounded-xl flex items-center justify-center mx-auto mb-6 text-[var(--neu-text-faint)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/>
                <path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
              </svg>
            </div>
            <p className="text-[16px] font-bold text-[var(--neu-text)] uppercase tracking-wide mb-2">No insights generated yet</p>
            <p className="text-[13px] font-sans text-[var(--neu-text-muted)] mb-6">Register assets and run scans before generating AI reports</p>
            <Button variant="primary">Generate New Report</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {assets.map((asset) => <InsightCard key={asset.id} asset={asset} />)}
          </div>
        )}
      </div>
    </>
  );
}
