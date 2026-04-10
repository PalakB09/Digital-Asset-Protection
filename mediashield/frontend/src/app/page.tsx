"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getStats,
  listViolations,
  scanByUrl,
  getViolationImageUrl,
  type Stats,
  type Violation,
  type ScanResult,
} from "@/lib/api";
import { MetricCard } from "@/components/ui/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";

// ─── Quick Scan Widget ────────────────────────────────────────────────────────
function QuickScanWidget() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [result, setResult] = useState<ScanResult | null>(null);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setScanning(true);
    setResult(null);
    setProgress(10);

    // Simulate progress ticks while waiting
    const ticker = setInterval(() => {
      setProgress((p) => Math.min(p + 12, 88));
    }, 400);

    const isVideo =
      url.toLowerCase().includes("youtube") ||
      url.toLowerCase().match(/\.(mp4|mov|webm)$/);

    try {
      const res = await scanByUrl(url.trim(), "unknown", isVideo ? "video" : "image");
      clearInterval(ticker);
      setProgress(100);
      setResult(res);
    } catch (err) {
      clearInterval(ticker);
      setResult({ matched: false, message: "We couldn't complete the scan. Try again." });
    } finally {
      setScanning(false);
      setUrl("");
      setTimeout(() => setProgress(0), 600);
    }
  }

  return (
    <div className="neu-raised p-6">
      <h2 className="text-[16px] font-bold text-[var(--neu-text)] mb-5 uppercase tracking-wide">Quick Scan</h2>

      <form onSubmit={handleScan} className="space-y-4">
        <div>
          <label htmlFor="scan-url" className="block text-[12px] font-bold text-[var(--neu-text-muted)] mb-2 uppercase tracking-widest">
            URL to scan
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--neu-text-faint)]">
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
            </div>
            <input
              id="scan-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://twitter.com/..."
              required
              className="neu-input pl-10"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="primary" loading={scanning} className="flex-1" type="submit">
            {!scanning && (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
                </svg>
                Scan Now
              </>
            )}
          </Button>
          <Link href="/scan" className="shrink-0 flex items-center justify-center">
            <Button variant="secondary" size="icon" title="Open full scan page">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
            </Button>
          </Link>
        </div>
      </form>

      {/* Progress bar */}
      {scanning && progress > 0 && (
        <div className="mt-5">
          <div className="neu-progress-track">
            <div className="neu-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-[11px] font-bold tracking-wide uppercase text-[var(--neu-text-muted)] mt-2">Scanning sources…</p>
        </div>
      )}

      {/* Scan result */}
      {result && !scanning && (
        <div className={`mt-5 p-4 neu-inset-sm rounded-[10px] border-l-4 ${result.matched ? "border-[var(--neu-danger)]" : "border-[var(--neu-success)]"}`}>
          <p className="font-bold text-[14px]">
            {result.status === "queued"
              ? "Scan queued in background"
              : result.matched
              ? "Match detected"
              : "No match found"}
          </p>
          {result.confidence !== undefined && (
            <p className="font-mono text-[11px] font-bold mt-1 text-[var(--neu-text-muted)]">
              Confidence: {(result.confidence * 100).toFixed(1)}%
            </p>
          )}
          {result.status === "queued" && result.job_id && (
            <p className="text-[11px] font-mono mt-1 text-[var(--neu-text-faint)]">Job: {result.job_id.substring(0, 8)}…</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── AI Insights Panel ────────────────────────────────────────────────────────
function AIInsightsPanel() {
  const insights = [
    {
      type: "info" as const,
      title: "Content spread detected",
      body: 'High activity for "Official IPL 2026 promo" across Twitter and Telegram in the last 2 hours. 14 new posts indexed.',
      accent: "var(--neu-info)",
    },
    {
      type: "violation" as const,
      title: "Action recommended",
      body: "3 new critical violations on Instagram require immediate DMCA review. Similarity scores above 95%.",
      accent: "var(--neu-danger)",
    },
  ];

  return (
    <div className="neu-raised p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[16px] font-bold text-[var(--neu-text)] uppercase tracking-wide">AI Insights</h2>
        <Badge variant="info">Live</Badge>
      </div>

      <div className="space-y-4">
        {insights.map((insight, i) => (
          <div key={i} className="neu-inset-sm p-4 border-l-4" style={{ borderColor: insight.accent }}>
            <p className="text-[13px] font-bold text-[var(--neu-text)] mb-1.5">{insight.title}</p>
            <p className="text-[12px] font-sans text-[var(--neu-text-muted)] leading-relaxed">{insight.body}</p>
          </div>
        ))}
      </div>

      <Link
        href="/insights"
        className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--neu-primary)] hover:text-[var(--neu-primary-lt)] mt-5 transition-colors"
      >
        View full analytics
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Violations Table (dashboard view — top 5) ────────────────────────────────
function ViolationsTable({ violations, loading }: { violations: Violation[]; loading: boolean; }) {
  function getSeverityBadgeVariant(confidence: number, tier?: string) {
    if (tier === "HIGH" || confidence >= 0.9) return "violation" as const;
    if (confidence >= 0.7) return "pending" as const;
    if (confidence >= 0.4) return "info" as const;
    return "neutral" as const;
  }

  function getSeverityLabel(confidence: number, tier?: string) {
    if (tier === "HIGH" || confidence >= 0.9) return "Critical";
    if (confidence >= 0.7) return "High";
    if (confidence >= 0.4) return "Medium";
    return "Low";
  }

  return (
    <div className="neu-raised overflow-hidden h-full flex flex-col">
      <div className="flex items-center justify-between p-6 border-b border-[var(--neu-surface-dk)] opacity-80">
        <h2 className="text-[16px] font-bold text-[var(--neu-text)] uppercase tracking-wide">Live Violations Feed</h2>
        <Link href="/violations" className="text-[12px] font-bold uppercase tracking-wide text-[var(--neu-primary)] hover:text-[var(--neu-primary-lt)] transition-colors">
          View all →
        </Link>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="neu-table">
          <thead>
            <tr>
              <th className="w-12"><span className="sr-only">Thumbnail</span></th>
              <th>Asset</th>
              <th>Platform</th>
              <th>Severity</th>
              <th className="text-right">Confidence</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonTableRow key={i} />)
            ) : violations.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--neu-text-faint)]">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                    <p className="text-[15px] font-bold text-[var(--neu-text)]">No violations detected</p>
                    <p className="text-[13px] font-sans text-[var(--neu-text-muted)]">Your assets are currently safe</p>
                    <Link href="/scan" className="mt-3">
                      <Button variant="primary">Start scanning</Button>
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              violations.map((v) => {
                const conf = (v.confidence * 100).toFixed(1);
                const isCritical = (v.match_tier === "HIGH" || v.confidence >= 0.9);

                return (
                  <tr key={v.id}>
                    <td>
                      <div className="w-10 h-10 neu-inset rounded-lg overflow-hidden shrink-0">
                        {v.image_path?.match(/\.(mp4|mov|webm)$/i) ? (
                          <video src={getViolationImageUrl(v.id)} muted playsInline className="w-full h-full object-cover" />
                        ) : (
                          <img src={getViolationImageUrl(v.id)} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                    </td>
                    <td className="max-w-[180px]">
                      <p className="text-[13px] font-bold font-sans text-[var(--neu-text)] truncate">{v.asset_name}</p>
                      {v.leaked_by && (
                        <p className="text-[11px] font-sans font-bold text-[var(--neu-danger)] truncate mt-1">
                          Leaked by: {v.leaked_by}
                        </p>
                      )}
                    </td>
                    <td><Badge variant="neutral">{v.platform}</Badge></td>
                    <td><Badge variant={getSeverityBadgeVariant(v.confidence, v.match_tier)}>{getSeverityLabel(v.confidence, v.match_tier)}</Badge></td>
                    <td className="text-right">
                      <span className={`font-mono text-[13px] font-bold ${isCritical ? "text-[var(--neu-danger)]" : "text-[var(--neu-text-muted)]"}`}>
                        {conf}%
                      </span>
                    </td>
                    <td>
                      <span className="font-mono text-[11px] text-[var(--neu-text-muted)]" title={new Date(v.created_at).toLocaleString()}>
                        {new Date(v.created_at).toLocaleDateString()}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [violationsLoading, setViolationsLoading] = useState(true);

  useEffect(() => {
    getStats()
      .catch(() => ({ total_assets: 0, total_violations: 0, high_confidence_matches: 0, platforms_monitored: 0 }))
      .then((s) => setStats(s as Stats))
      .finally(() => setStatsLoading(false));

    listViolations()
      .catch(() => [])
      .then((v) => setViolations((v as Violation[]).slice(0, 5)))
      .finally(() => setViolationsLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="DASHBOARD"
        subtitle="Overview of your digital asset protection status"
        action={
          <Link href="/scan">
            <Button variant="primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
              New Scan
            </Button>
          </Link>
        }
      />

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">
        {/* Metric Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard label="Total Assets" value={stats?.total_assets ?? 0} accentColor="blue" loading={statsLoading} />
          <MetricCard label="Active Monitoring" value={stats?.platforms_monitored ?? 0} accentColor="green" loading={statsLoading} />
          <MetricCard label="Violations Found" value={stats?.total_violations ?? 0} accentColor="red" loading={statsLoading} />
          <MetricCard label="High Confidence" value={stats?.high_confidence_matches ?? 0} accentColor="amber" loading={statsLoading} />
        </div>

        {/* Primary content — 65/35 split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="space-y-6">
            <QuickScanWidget />
            <AIInsightsPanel />
          </div>
          <div className="lg:col-span-2">
            <ViolationsTable violations={violations} loading={violationsLoading} />
          </div>
        </div>
      </div>
    </>
  );
}
