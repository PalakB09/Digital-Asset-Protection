"use client";

import { useEffect, useState } from "react";
import { getStats, listViolations, scanByUrl, getViolationImageUrl, type Stats, type Violation, type ScanResult } from "@/lib/api";
import Link from "next/link";

function StatsCard({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  return (
    <div className="stats-card animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="badge" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
          Live
        </span>
      </div>
      <p className="text-3xl font-bold mb-1" style={{ color }}>{value}</p>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Scan
  const [scanUrl, setScanUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  useEffect(() => {
    Promise.all([
      getStats().catch(() => ({ total_assets: 0, total_violations: 0, high_confidence_matches: 0, platforms_monitored: 0 })),
      listViolations().catch(() => [])
    ]).then(([st, viols]) => {
      setStats(st as Stats);
      setViolations((viols as Violation[]).slice(0, 5)); // top 5
    }).finally(() => setLoading(false));
  }, []);

  async function handleQuickScan(e: React.FormEvent) {
    e.preventDefault();
    if (!scanUrl.trim()) return;

    setScanning(true);
    setScanResult(null);

    const isVideo = scanUrl.toLowerCase().includes("youtube") || scanUrl.toLowerCase().match(/\.(mp4|mov|webm)$/);
    
    try {
      const res = await scanByUrl(scanUrl.trim(), "unknown", isVideo ? "video" : "image");
      setScanResult(res);
    } catch (e) {
      setScanResult({ matched: false, message: `Scan failed: ${e}` });
    } finally {
      setScanning(false);
      setScanUrl("");
    }
  }

  function getSeverityColor(confidence: number, tier?: string) {
    if (tier === "HIGH" || confidence >= 0.9) return "var(--danger)";
    if (confidence >= 0.7) return "#f59e0b"; // amber
    if (confidence >= 0.4) return "#3b82f6"; // blue
    return "var(--success)";
  }

  function getSeverityLabel(confidence: number, tier?: string) {
    if (tier === "HIGH" || confidence >= 0.9) return "CRITICAL";
    if (confidence >= 0.7) return "HIGH";
    if (confidence >= 0.4) return "MEDIUM";
    return "LOW";
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p style={{ color: "var(--text-secondary)" }}>Overview of your digital asset protection status</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
              label="Registered Assets"
              value={stats?.total_assets ?? 0}
              icon="🖼️"
              color="var(--accent-primary)"
            />
            <StatsCard
              label="Total Violations"
              value={stats?.total_violations ?? 0}
              icon="⚠️"
              color="var(--accent-secondary)"
            />
            <StatsCard
              label="High Confidence"
              value={stats?.high_confidence_matches ?? 0}
              icon="🔴"
              color="#f87171"
            />
            <StatsCard
              label="Platforms Tracked"
              value={stats?.platforms_monitored ?? 0}
              icon="🌐"
              color="var(--accent-tertiary)"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (Quick Scan & AI Insights) */}
            <div className="lg:col-span-1 space-y-6">
              
              {/* Quick Scan Widget */}
              <div className="card p-5 animate-fade-in">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-xl">⚡</span> Quick Scan Widget
                </h2>
                <form onSubmit={handleQuickScan} className="space-y-3">
                  <input
                    type="url"
                    placeholder="https://..."
                    value={scanUrl}
                    onChange={(e) => setScanUrl(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={scanning || !scanUrl.trim()}
                      className="btn btn-primary flex-1 text-sm justify-center"
                    >
                      {scanning ? "Scanning..." : "Scan Now"}
                    </button>
                    <Link href="/scan" className="btn btn-outline text-sm px-3 flex items-center justify-center" title="Full Scan & Upload">
                      📁
                    </Link>
                  </div>
                </form>

                {scanResult && (
                  <div className={`mt-4 p-3 rounded-lg border text-sm ${scanResult.matched ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                    <p className="font-semibold" style={{ color: scanResult.matched ? "var(--danger)" : "var(--success)" }}>
                      {scanResult.status === "queued" ? "⏳ Scanning in background..." : (scanResult.matched ? "🚨 Match Detected!" : "✅ No Match")}
                    </p>
                    {scanResult.confidence !== undefined && (
                      <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
                        Confidence: {(scanResult.confidence * 100).toFixed(1)}%
                      </p>
                    )}
                    {scanResult.status === "queued" && scanResult.job_id && (
                      <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Job ID: {scanResult.job_id.substring(0, 8)}...</p>
                    )}
                  </div>
                )}
              </div>

              {/* AI Insights Panel */}
              <div className="card p-5 animate-fade-in" style={{ animationDelay: "0.1s" }}>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-xl">🤖</span> AI Insights
                </h2>
                <div className="space-y-4">
                  <div className="p-3 rounded-lg" style={{ background: "rgba(108, 99, 255, 0.08)", borderLeft: "3px solid var(--accent-primary)" }}>
                    <p className="text-sm font-medium">Content spread detected</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>High activity for "Official IPL 2026 promo" across Twitter and Telegram in the last 2 hours.</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "rgba(248, 113, 113, 0.08)", borderLeft: "3px solid #f87171" }}>
                    <p className="text-sm font-medium">Action Recommended</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>3 new CRITICAL violations on Instagram require immediate DMCA review.</p>
                  </div>
                </div>
                <Link href="/insights" className="text-xs font-semibold mt-4 inline-block hover:underline" style={{ color: "var(--accent-primary)" }}>
                  View Full Analytics →
                </Link>
              </div>

            </div>

            {/* Right Column (Live Violations Feed) */}
            <div className="lg:col-span-2 space-y-6">
              <div className="card p-5 animate-fade-in" style={{ animationDelay: "0.2s" }}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <span className="text-xl">📡</span> Live Violations Feed
                  </h2>
                  <Link href="/violations" className="text-xs font-semibold hover:underline" style={{ color: "var(--accent-primary)" }}>
                    View All →
                  </Link>
                </div>

                {violations.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="text-sm" style={{ color: "var(--text-muted)" }}>No recent violations detected.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {violations.map((v) => {
                      const sevColor = getSeverityColor(v.confidence, v.match_tier);
                      const sevLabel = getSeverityLabel(v.confidence, v.match_tier);
                      
                      return (
                        <div key={v.id} className="flex items-center gap-4 p-3 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                          <div className="w-12 h-12 rounded-md overflow-hidden bg-black shrink-0">
                            {v.image_path?.match(/\.(mp4|mov|webm)$/i) ? (
                              <video src={getViolationImageUrl(v.id)} muted playsInline className="w-full h-full object-cover" />
                            ) : (
                              <img src={getViolationImageUrl(v.id)} alt="Viol" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{v.asset_name}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                              <span className="capitalize text-white">{v.platform}</span>
                              <span>•</span>
                              <span>{(v.confidence * 100).toFixed(1)}% match</span>
                              <span>•</span>
                              <span>{new Date(v.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center">
                            <span className="badge text-[10px]" style={{
                              background: "transparent",
                              color: sevColor,
                              border: `1px solid ${sevColor}`
                            }}>
                              {sevLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
