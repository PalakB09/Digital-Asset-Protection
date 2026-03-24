"use client";

import { useState, useEffect } from "react";
import { listAssets, type Asset } from "@/lib/api";
import Link from "next/link";

export default function GraphOverviewPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAssets()
      .then(setAssets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const assetsWithViolations = assets.filter(a => a.violation_count > 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Propagation Graph</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Visualize how your protected content has spread across platforms
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : assetsWithViolations.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🕸️</p>
          <p className="text-lg font-medium mb-2">No propagation data yet</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Scan images to detect violations and build the propagation graph
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assetsWithViolations.map((asset) => (
            <Link key={asset.id} href={`/graph/${asset.id}`}>
              <div className="card p-5 cursor-pointer">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                       style={{ background: "rgba(108, 99, 255, 0.15)" }}>
                    🖼️
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{asset.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {new Date(asset.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="badge badge-high">{asset.violation_count} violation{asset.violation_count !== 1 ? 's' : ''}</span>
                  <span className="text-xs" style={{ color: "var(--accent-primary)" }}>View Graph →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
