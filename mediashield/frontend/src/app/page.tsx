"use client";

import { useEffect, useState } from "react";
import { getStats, type Stats } from "@/lib/api";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => setStats({ total_assets: 0, total_violations: 0, high_confidence_matches: 0, platforms_monitored: 0 }))
      .finally(() => setLoading(false));
  }, []);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            color="#ff6584"
          />
          <StatsCard
            label="Platforms Tracked"
            value={stats?.platforms_monitored ?? 0}
            icon="🌐"
            color="var(--accent-tertiary)"
          />
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a href="/assets" className="flex items-center gap-3 p-3 rounded-lg transition-colors"
               style={{ background: "rgba(108, 99, 255, 0.05)" }}>
              <span className="text-xl">📤</span>
              <div>
                <p className="font-medium text-sm">Register New Asset</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Upload and protect an image</p>
              </div>
            </a>
            <a href="/scan" className="flex items-center gap-3 p-3 rounded-lg transition-colors"
               style={{ background: "rgba(108, 99, 255, 0.05)" }}>
              <span className="text-xl">🔍</span>
              <div>
                <p className="font-medium text-sm">Scan for Violations</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Check an image against your assets</p>
              </div>
            </a>
            <a href="/violations" className="flex items-center gap-3 p-3 rounded-lg transition-colors"
               style={{ background: "rgba(108, 99, 255, 0.05)" }}>
              <span className="text-xl">📋</span>
              <div>
                <p className="font-medium text-sm">View Violations</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Review detected infringements</p>
              </div>
            </a>
          </div>
        </div>

        <div className="card p-6 animate-fade-in">
          <h2 className="text-lg font-semibold mb-4">How It Works</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                   style={{ background: "rgba(108, 99, 255, 0.2)", color: "var(--accent-primary)" }}>1</div>
              <div>
                <p className="font-medium text-sm">Register Assets</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Upload original images to generate pHash + CLIP fingerprints</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                   style={{ background: "rgba(255, 101, 132, 0.2)", color: "var(--accent-secondary)" }}>2</div>
              <div>
                <p className="font-medium text-sm">Scan Suspects</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Upload potential copies — system detects matches via tiered pipeline</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                   style={{ background: "rgba(0, 212, 170, 0.2)", color: "var(--accent-tertiary)" }}>3</div>
              <div>
                <p className="font-medium text-sm">Take Action</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>View the propagation graph, generate DMCA notices</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
