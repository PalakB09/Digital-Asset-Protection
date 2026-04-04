"use client";

import { useState, useEffect } from "react";
import {
  listViolations,
  generateDMCA,
  getDMCADownloadUrl,
  type Violation,
} from "@/lib/api";

export default function ActionsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadViolations();
  }, []);

  async function loadViolations() {
    try {
      const data = await listViolations();
      // Only keep violations with high/critical severity for the actions table by default 
      // or just list them all. We'll list all for visibility.
      setViolations(data.sort((a,b) => b.confidence - a.confidence));
    } catch {
      // empty state
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateDMCA(violationId: string) {
    setProcessing(violationId + "-dmca");
    try {
      await generateDMCA(violationId);
      window.open(getDMCADownloadUrl(violationId), "_blank");
    } catch (e) {
      alert(`Failed to generate DMCA: ${e}`);
    } finally {
      setProcessing(null);
    }
  }

  async function handleSendNotice(violationId: string) {
    setProcessing(violationId + "-notice");
    try {
      // Mock network request for sending a notice
      await new Promise((resolve) => setTimeout(resolve, 1500));
      alert("Takedown Notice Sent Successfully (Mock)!");
    } finally {
      setProcessing(null);
    }
  }

  function getSeverityLabel(confidence: number, tier?: string) {
    if (tier === "HIGH" || confidence >= 0.9) return "CRITICAL";
    if (confidence >= 0.7) return "HIGH";
    if (confidence >= 0.4) return "MEDIUM";
    return "LOW";
  }

  function getSeverityColor(confidence: number, tier?: string) {
    if (tier === "HIGH" || confidence >= 0.9) return "var(--danger)";
    if (confidence >= 0.7) return "#f59e0b"; // amber
    if (confidence >= 0.4) return "#3b82f6"; // blue
    return "var(--success)";
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Enforcement Actions</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Manage takedowns and generate legal notices for detected violations
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : violations.length === 0 ? (
        <div className="text-center py-16 card">
          <p className="text-5xl mb-4">⚖️</p>
          <p className="text-lg font-medium mb-2">No actionable violations</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            There are currently no detected violations requiring enforcement.
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden animate-fade-in">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                  <th className="p-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>ASSET / PLATFORM</th>
                  <th className="p-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>CONFIDENCE</th>
                  <th className="p-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>SEVERITY</th>
                  <th className="p-4 text-xs font-semibold text-right" style={{ color: "var(--text-muted)" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {violations.map((v) => (
                  <tr key={v.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td className="p-4">
                      <p className="font-semibold text-sm truncate max-w-[200px]" title={v.asset_name}>{v.asset_name}</p>
                      <p className="text-xs uppercase mt-1" style={{ color: "var(--text-muted)" }}>
                        {v.platform} · {new Date(v.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="p-4 font-mono text-sm">
                      {(v.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="p-4">
                      <span className="badge text-[10px] font-bold" style={{
                        background: "transparent",
                        color: getSeverityColor(v.confidence, v.match_tier),
                        border: `1px solid ${getSeverityColor(v.confidence, v.match_tier)}`
                      }}>
                        {getSeverityLabel(v.confidence, v.match_tier)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleGenerateDMCA(v.id)}
                          disabled={processing !== null}
                          className="btn btn-outline text-xs"
                          title="Download DMCA PDF"
                        >
                          {processing === v.id + "-dmca" ? "Generating..." : "📄 Gen DMCA"}
                        </button>
                        <button
                          onClick={() => handleSendNotice(v.id)}
                          disabled={processing !== null}
                          className="btn btn-primary text-xs"
                          style={{
                            background: "var(--danger)",
                            borderColor: "var(--danger)",
                            color: "white"
                          }}
                        >
                          {processing === v.id + "-notice" ? "Sending..." : "📤 Send Notice"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
