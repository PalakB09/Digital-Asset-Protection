"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  listViolations,
  getAssetImageUrl,
  getViolationImageUrl,
  generateDMCA,
  getDMCADownloadUrl,
  type Violation,
} from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";

// ─── Badge variant helpers ────────────────────────────────────────────────────
type BadgeVariant = "verified" | "violation" | "pending" | "info" | "neutral";

function getSeverityVariant(confidence: number, tier?: string): BadgeVariant {
  if (tier === "HIGH" || confidence >= 0.9) return "violation";
  if (confidence >= 0.7) return "pending";
  if (confidence >= 0.4) return "info";
  return "neutral";
}

function getSeverityLabel(confidence: number, tier?: string): string {
  if (tier === "HIGH" || confidence >= 0.9) return "Critical";
  if (confidence >= 0.7) return "High";
  if (confidence >= 0.4) return "Medium";
  return "Low";
}

// ─── Violation Detail Drawer ──────────────────────────────────────────────────
function ViolationDrawer({
  violation,
  onClose,
  onGenerateDMCA,
  generating,
}: {
  violation: Violation | null;
  onClose: () => void;
  onGenerateDMCA: (id: string) => void;
  generating: boolean;
}) {
  if (!violation) return null;

  const conf = (violation.confidence * 100).toFixed(1);
  const isCritical = violation.match_tier === "HIGH" || violation.confidence >= 0.9;

  return (
    <>
      <div
        className="fixed inset-0 bg-[var(--neu-surface)]/70 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed right-4 top-4 bottom-4 w-[420px] neu-raised rounded-[20px] z-50 overflow-hidden flex flex-col pointer-events-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-90 sticky top-0 bg-[var(--neu-surface)]">
          <h2 className="text-[16px] font-bold text-[var(--neu-text)] uppercase tracking-wide">Violation detail</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </Button>
        </div>

        <div className="flex-1 px-6 py-6 space-y-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-2">Violation</p>
              <div className="aspect-video neu-inset rounded-[12px] overflow-hidden border-2 border-[var(--neu-danger)]">
                {violation.image_path?.match(/\.(mp4|mov|webm|avi)$/i) ? (
                  <video src={getViolationImageUrl(violation.id)} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                ) : (
                  <img src={getViolationImageUrl(violation.id)} alt="Violation" className="w-full h-full object-cover" />
                )}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-2">Original</p>
              <div className="aspect-video neu-inset rounded-[12px] overflow-hidden border-2 border-[var(--neu-success)]">
                {violation.asset_type === "video" ? (
                  <video src={getAssetImageUrl(violation.asset_id)} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                ) : (
                  <img src={getAssetImageUrl(violation.asset_id)} alt="Original" className="w-full h-full object-cover" />
                )}
              </div>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Matched asset</p>
            <p className="text-[14px] font-bold text-[var(--neu-text)] truncate">{violation.asset_name}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant={getSeverityVariant(violation.confidence, violation.match_tier)}>
              {getSeverityLabel(violation.confidence, violation.match_tier)}
            </Badge>
            <Badge variant={violation.match_tier === "HIGH" ? "violation" : "pending"}>
              {violation.match_tier} tier
            </Badge>
            <Badge variant="info">{violation.match_type}</Badge>
          </div>

          {violation.leaked_by && (
            <div className="p-4 neu-inset-sm rounded-[10px] border-l-4 border-[var(--neu-danger)]">
              <p className="text-[12px] font-bold text-[var(--neu-danger)] uppercase tracking-wide">Leak source identified</p>
              <p className="text-[14px] font-mono text-[var(--neu-text)] mt-1">{violation.leaked_by}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Platform</p>
              <p className="text-[13px] font-bold text-[var(--neu-text)] capitalize">{violation.platform}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Confidence</p>
              <p className={`font-mono text-[16px] font-bold ${isCritical ? "text-[var(--neu-danger)]" : "text-[var(--neu-text)]"}`}>
                {conf}%
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Detected</p>
              <p className="text-[12px] font-mono text-[var(--neu-text-muted)]">{new Date(violation.created_at).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Match type</p>
              <p className="text-[13px] font-bold text-[var(--neu-text)] uppercase tracking-wide">{violation.match_type}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Source URL</p>
            <a
              href={violation.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] font-mono text-[var(--neu-primary)] hover:text-[var(--neu-primary-lt)] hover:underline truncate block"
              title={violation.source_url}
            >
              {violation.source_url}
            </a>
          </div>

          <div>
            <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Violation ID</p>
            <p className="text-[11px] font-mono text-[var(--neu-text-muted)]">{violation.id}</p>
          </div>
        </div>

        <div className="px-6 py-5 border-t border-[var(--neu-surface-dk)] opacity-90 flex gap-3">
          <Link href={`/graph/${violation.asset_id}`} className="flex-1">
            <Button variant="secondary" className="w-full justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
                <line x1="7" y1="12" x2="17" y2="6"/><line x1="7" y1="12" x2="17" y2="18"/>
              </svg>
              Graph
            </Button>
          </Link>
          <Button
            variant="destructive"
            className="flex-1 justify-center"
            onClick={() => onGenerateDMCA(violation.id)}
            loading={generating}
          >
            {!generating && (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Send DMCA
              </>
            )}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Violations Page ──────────────────────────────────────────────────────────
export default function ViolationsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedViolation, setSelectedViolation] = useState<Violation | null>(null);
  const [generatingDMCA, setGeneratingDMCA] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  useEffect(() => {
    listViolations()
      .catch(() => [])
      .then((data) => setViolations(data as Violation[]))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerateDMCA(violationId: string) {
    setGeneratingDMCA(violationId);
    try {
      await generateDMCA(violationId);
      window.open(getDMCADownloadUrl(violationId), "_blank");
    } catch {
    } finally {
      setGeneratingDMCA(null);
    }
  }

  const filtered = violations.filter((v) => {
    if (filterSeverity === "all") return true;
    const label = getSeverityLabel(v.confidence, v.match_tier).toLowerCase();
    return label === filterSeverity;
  });

  return (
    <>
      <PageHeader
        title="VIOLATIONS"
        subtitle="Detected infringements of your registered assets"
        action={
          <Link href="/scan">
            <Button variant="primary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
              </svg>
              New scan
            </Button>
          </Link>
        }
      />

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">

        <div className="flex items-center gap-4 mb-6">
          <p className="text-[11px] font-bold text-[var(--neu-text-muted)] uppercase tracking-widest">Filter:</p>
          <div className="flex gap-2 neu-inset p-1.5 rounded-[12px]">
            {["all", "critical", "high", "medium", "low"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterSeverity(f)}
                className={`
                  px-4 py-1.5 text-[12px] font-bold uppercase tracking-wide rounded-[8px] transition-all duration-200
                  ${filterSeverity === f
                    ? "neu-raised text-[var(--neu-primary)]"
                    : "text-[var(--neu-text-muted)] hover:text-[var(--neu-text)] hover:shadow-[var(--neu-shadow-xs)]"
                  }
                `}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="neu-raised overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-90">
            <h2 className="text-[15px] font-bold text-[var(--neu-text)] uppercase tracking-wide">
              All violations
              {!loading && (
                <span className="ml-3 font-mono text-[var(--neu-text-muted)]">
                  ({filtered.length})
                </span>
              )}
            </h2>
            {!loading && violations.length > 0 && (
              <p className="text-[12px] font-sans text-[var(--neu-text-muted)]">
                Click a row to view details
              </p>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="neu-table">
              <thead>
                <tr>
                  <th className="w-10 px-4 py-3"><span className="sr-only">Select</span></th>
                  <th className="w-[110px]">Preview</th>
                  <th>Asset</th>
                  <th>Platform</th>
                  <th>Severity</th>
                  <th className="text-right">Confidence</th>
                  <th>Detected</th>
                  <th className="text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonTableRow key={i} />)
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--neu-text-faint)]">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                          <polyline points="9 12 11 14 15 10"/>
                        </svg>
                        <p className="text-[16px] font-bold text-[var(--neu-text)] uppercase tracking-wide">
                          {violations.length === 0 ? "No violations detected" : "No violations match this filter"}
                        </p>
                        <p className="text-[13px] font-sans text-[var(--neu-text-muted)]">
                          {violations.length === 0
                            ? "Your assets are currently safe across all monitored platforms"
                            : "Try a different severity filter"}
                        </p>
                        {violations.length === 0 && (
                          <Link href="/scan" className="mt-3">
                            <Button variant="primary">Start scanning</Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((v) => {
                    const conf = (v.confidence * 100).toFixed(1);
                    const isCritical = v.match_tier === "HIGH" || v.confidence >= 0.9;

                    return (
                      <tr
                        key={v.id}
                        onClick={() => setSelectedViolation(v)}
                        className={`
                          cursor-pointer group transition-colors duration-150
                          ${selectedViolation?.id === v.id
                            ? "bg-[var(--neu-surface-dk)] border-l-2 border-l-[var(--neu-primary)]"
                            : "hover:bg-[var(--neu-surface-lt)]"
                          }
                        `}
                      >
                        <td className="w-10 pl-6 pr-2 py-3">
                          <div className={`w-2 h-6 rounded-full neu-raised opacity-80 ${isCritical ? "bg-[var(--neu-danger)] shadow-[0_0_8px_var(--neu-danger)]" : "bg-[var(--neu-warning)]"}`} />
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <div className="w-10 h-10 neu-inset rounded-[8px] overflow-hidden shrink-0 border border-transparent">
                              {v.image_path?.match(/\.(mp4|mov|webm|avi)$/i) ? (
                                <video src={getViolationImageUrl(v.id)} muted playsInline className="w-full h-full object-cover" />
                              ) : (
                                <img src={getViolationImageUrl(v.id)} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="w-10 h-10 neu-inset rounded-[8px] overflow-hidden shrink-0 border border-transparent z-10 -ml-5 shadow-[0_0_10px_var(--neu-surface)]">
                              {v.asset_type === "video" ? (
                                <video src={getAssetImageUrl(v.asset_id)} muted playsInline className="w-full h-full object-cover" />
                              ) : (
                                <img src={getAssetImageUrl(v.asset_id)} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-[13px] font-bold text-[var(--neu-text)] truncate">{v.asset_name}</p>
                          {v.leaked_by ? (
                            <p className="text-[11px] font-mono text-[var(--neu-danger)] truncate mt-1">Leaked by: {v.leaked_by}</p>
                          ) : (
                            <p className="text-[11px] font-mono text-[var(--neu-text-muted)] truncate mt-1" title={v.source_url}>
                              {v.source_url.length > 40 ? `${v.source_url.slice(0, 40)}…` : v.source_url}
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <Badge variant="neutral">{v.platform}</Badge>
                        </td>

                        <td className="px-4 py-3">
                          <Badge variant={getSeverityVariant(v.confidence, v.match_tier)}>
                            {getSeverityLabel(v.confidence, v.match_tier)}
                          </Badge>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono text-[14px] font-bold ${isCritical ? "text-[var(--neu-danger)]" : "text-[var(--neu-text-muted)]"}`}>
                            {conf}%
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="text-[12px] font-mono text-[var(--neu-text-muted)]" title={new Date(v.created_at).toLocaleString()}>
                            {new Date(v.created_at).toLocaleDateString()}
                          </span>
                        </td>

                        <td className="px-6 py-3 text-right">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedViolation(v);
                              }}
                            >
                              View
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              loading={generatingDMCA === v.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleGenerateDMCA(v.id);
                              }}
                            >
                              {generatingDMCA !== v.id && "DMCA"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {!loading && filtered.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--neu-surface-dk)] opacity-80">
                <p className="text-[12px] font-mono text-[var(--neu-text-muted)]">
                  Showing {filtered.length} of {violations.length} violation{violations.length !== 1 ? "s" : ""}
                </p>
                <p className="text-[12px] font-mono text-[var(--neu-text-faint)]">
                  Page 1 of 1
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <ViolationDrawer
        violation={selectedViolation}
        onClose={() => setSelectedViolation(null)}
        onGenerateDMCA={handleGenerateDMCA}
        generating={generatingDMCA === selectedViolation?.id}
      />
    </>
  );
}
