"use client";

import { useState, useEffect } from "react";
import {
  listViolations,
  getAssetImageUrl,
  getViolationImageUrl,
  generateDMCA,
  getDMCADownloadUrl,
  type Violation,
} from "@/lib/api";

export default function ViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingDMCA, setGeneratingDMCA] = useState<string | null>(null);

  useEffect(() => {
    loadViolations();
  }, []);

  async function loadViolations() {
    try {
      const data = await listViolations();
      setViolations(data);
    } catch {
      // empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateDMCA(violationId: string) {
    setGeneratingDMCA(violationId);
    try {
      await generateDMCA(violationId);
      // Download the PDF
      window.open(getDMCADownloadUrl(violationId), "_blank");
    } catch (e) {
      alert(`Failed to generate DMCA: ${e}`);
    } finally {
      setGeneratingDMCA(null);
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
        <h1 className="text-3xl font-bold mb-2">Violations</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Detected infringements of your registered assets
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : violations.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">✅</p>
          <p className="text-lg font-medium mb-2">No violations detected</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Scan images to detect potential infringements
          </p>
          <a href="/scan" className="btn btn-primary mt-4 inline-flex">
            🔍 Start Scanning
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {violations.map((v, i) => (
            <div key={v.id} className="card p-5 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="flex flex-col lg:flex-row gap-5">
                {/* Images */}
                <div className="flex gap-4 shrink-0">
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Violation</p>
                    <div className="w-24 h-24 rounded-lg overflow-hidden" style={{ border: "2px solid var(--danger)" }}>
                      {v.image_path && v.image_path.match(/\.(mp4|mov|webm|avi)$/i) ? (
                        <video src={getViolationImageUrl(v.id)} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                      ) : (
                        <img
                          src={getViolationImageUrl(v.id)}
                          alt="Violation"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Original</p>
                    <div className="w-24 h-24 rounded-lg overflow-hidden" style={{ border: "2px solid var(--success)" }}>
                      {v.asset_type === "video" ? (
                        <video src={getAssetImageUrl(v.asset_id)} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                      ) : (
                        <img
                          src={getAssetImageUrl(v.asset_id)}
                          alt="Original"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="badge font-bold text-[10px]" style={{
                      background: "transparent",
                      color: getSeverityColor(v.confidence, v.match_tier),
                      border: `1px solid ${getSeverityColor(v.confidence, v.match_tier)}`
                    }}>
                      • {getSeverityLabel(v.confidence, v.match_tier)} SEVERITY
                    </span>
                    <span className={`badge ${v.match_tier === "HIGH" ? "badge-high" : "badge-medium"}`}>
                      {v.match_tier} TIER
                    </span>
                    <span className="badge" style={{
                      background: "rgba(108, 99, 255, 0.15)",
                      color: "var(--accent-primary)",
                      border: "1px solid rgba(108, 99, 255, 0.3)",
                    }}>
                      {v.match_type.toUpperCase()}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)", textTransform: "capitalize" }}>
                      {v.platform}
                    </span>
                  </div>

                  <p className="font-semibold text-sm mb-1">
                    Matched: <span style={{ color: "var(--accent-primary)" }}>{v.asset_name}</span>
                  </p>
                  
                  {v.leaked_by && (
                    <p className="font-bold text-xs mb-2 px-2 py-1 inline-block rounded" style={{ background: "rgba(220, 38, 38, 0.15)", color: "#f87171", border: "1px solid rgba(220, 38, 38, 0.45)" }}>
                      🕵️ Leak Source Identified: {v.leaked_by}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <span>Confidence: <strong style={{ color: "var(--text-primary)" }}>
                      {(v.confidence * 100).toFixed(1)}%
                    </strong></span>
                    <span>Source: {v.source_url}</span>
                    <span>{new Date(v.created_at).toLocaleString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <a href={`/graph/${v.asset_id}`} className="btn btn-outline text-xs">
                    🕸️ Graph
                  </a>
                  <button
                    onClick={() => handleGenerateDMCA(v.id)}
                    disabled={generatingDMCA === v.id}
                    className="btn btn-danger text-xs"
                  >
                    {generatingDMCA === v.id ? (
                      <><div className="spinner" style={{ width: 14, height: 14 }}></div> Generating...</>
                    ) : (
                      <>📄 DMCA</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
