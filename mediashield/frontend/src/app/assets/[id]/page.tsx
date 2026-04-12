"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  getAsset,
  getAssetImageUrl,
  getAssetDistributions,
  addAssetRecipients,
  generateProtectedCopies,
  queueTwitterScrape,
  getJobStatus,
  listViolations,
  deleteAsset,
  type Asset,
  type AssetDistribution,
  type Violation,
} from "@/lib/api";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

const API_BASE = "http://localhost:8000/api";

// ─── Tab bar ──────────────────────────────────────────────────────────────────
type TabId = "distributions" | "violations";

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "distributions", label: "Distributions" },
    { id: "violations",    label: "Violations"    },
  ];
  return (
    <div className="eg-tab-bar">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`eg-tab ${active === t.id ? "active" : ""}`}
          aria-selected={active === t.id}
          role="tab"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Metadata Row ──────────────────────────────────────────────────────────────
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 py-3" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <span
        className="shrink-0 text-[11px] font-medium uppercase tracking-[0.06em] w-[120px]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </span>
      <span className="text-[13px] font-mono truncate flex-1" style={{ color: "var(--text-primary)" }}>
        {children}
      </span>
    </div>
  );
}

// ─── Message ──────────────────────────────────────────────────────────────────
function Msg({ msg }: { msg: { type: "success" | "error"; text: string } }) {
  return (
    <div className={msg.type === "success" ? "eg-alert-success" : "eg-alert-error"}>
      <p className="text-[13px] font-medium">{msg.text}</p>
    </div>
  );
}

// ─── Distributions Tab ────────────────────────────────────────────────────────
function DistributionsTab({
  assetId,
  distributions,
  loading,
  onRefresh,
}: {
  assetId: string;
  distributions: AssetDistribution[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !identifier.trim()) return;
    setAdding(true);
    setMsg(null);
    try {
      await addAssetRecipients(assetId, [{ name: name.trim(), identifier: identifier.trim() }]);
      setName(""); setIdentifier("");
      setMsg({ type: "success", text: "Partner added." });
      onRefresh();
    } catch (err) {
      setMsg({ type: "error", text: `Failed to add: ${err}` });
    } finally { setAdding(false); }
  }

  async function handleGenerate() {
    setGenerating(true);
    setMsg(null);
    try {
      const res = await generateProtectedCopies(assetId);
      setMsg({ type: "success", text: res.message });
      onRefresh();
    } catch (err) {
      setMsg({ type: "error", text: `Generation failed: ${err}` });
    } finally { setGenerating(false); }
  }

  async function handleScrapeX() {
    setScraping(true);
    setMsg(null);
    try {
      const res = await queueTwitterScrape(assetId);
      setMsg({ type: "success", text: `Scan queued for ${res.asset_name}.` });
      for (let i = 0; i < 15; i++) {
        const job = await getJobStatus(res.job_id);
        if (job.status === "done" || job.status === "failed") {
          setMsg({ type: job.status === "done" ? "success" : "error", text: `Twitter scan ${job.status} for ${res.asset_name}.` });
          break;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      setMsg({ type: "error", text: `Scan failed: ${err}` });
    } finally { setScraping(false); }
  }

  return (
    <div className="space-y-5">
      {/* Add partner */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: 20,
        }}
      >
        <p className="text-[12px] font-medium mb-4 uppercase tracking-[0.06em]" style={{ color: "var(--text-muted)" }}>
          Add distribution partner
        </p>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Partner name — e.g. Acme Media"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={adding}
            className="eg-input flex-1"
          />
          <input
            type="text"
            placeholder="Identifier — email or agency ID"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={adding}
            className="eg-input flex-1"
          />
          <Button variant="accent" type="submit" loading={adding} disabled={!name || !identifier} className="shrink-0">
            {!adding && "Add partner"}
          </Button>
        </form>
      </div>

      {msg && <Msg msg={msg} />}

      {/* Distribution log */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 gap-3"
          style={{ borderBottom: "1px solid var(--border-subtle)" }}
        >
          <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>Distribution log</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" loading={scraping} onClick={handleScrapeX}
              aria-label="Scan Twitter for this asset">
              {!scraping && "Scan X / Twitter"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={generating}
              disabled={distributions.length === 0 || distributions.every(d => d.generated)}
              onClick={handleGenerate}
              aria-label="Generate protected copies"
            >
              {!generating && "Generate copies"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            <Skeleton className="h-10 w-full rounded" repeat={3} />
          </div>
        ) : distributions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-[14px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>No partners yet</p>
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Add a distribution partner above to start tracking</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="eg-table">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Identifier</th>
                  <th>Watermark ID</th>
                  <th style={{ textAlign: "right" }}>Copy</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map((d) => (
                  <tr key={d.recipient_id}>
                    <td>
                      <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{d.recipient_name}</p>
                    </td>
                    <td>
                      <p className="text-[12px] font-mono" style={{ color: "var(--text-secondary)" }}>{d.recipient_identifier}</p>
                    </td>
                    <td>
                      <p className="text-[11px] font-mono truncate max-w-[120px]" style={{ color: "var(--text-muted)" }} title={d.watermark_id}>
                        {d.watermark_id}
                      </p>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {d.generated ? (
                        <a
                          href={`${API_BASE}/assets${d.distribution_url?.replace("/api/assets", "")}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Badge variant="verified">Download</Badge>
                        </a>
                      ) : (
                        <Badge variant="pending">Pending</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Violations Tab ────────────────────────────────────────────────────────────
function ViolationsTab({ violations, loading }: { violations: Violation[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded" repeat={3} />
      </div>
    );
  }
  if (violations.length === 0) {
    return (
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: "48px 24px",
          textAlign: "center",
        }}
      >
        <div className="mb-4" style={{ color: "var(--success)" }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9 12 11 14 15 10"/>
          </svg>
        </div>
        <p className="text-[15px] font-medium mb-1" style={{ color: "var(--text-primary)" }}>No violations detected</p>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>Run a scan to check for infringements</p>
      </div>
    );
  }
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div className="overflow-x-auto">
        <table className="eg-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Severity</th>
              <th style={{ textAlign: "right" }}>Confidence</th>
              <th>Detected</th>
            </tr>
          </thead>
          <tbody>
            {violations.map((v) => {
              const isCrit = v.match_tier === "HIGH" || v.confidence >= 0.9;
              const sev = isCrit ? "violation" : v.confidence >= 0.7 ? "pending" : "info";
              const sevLabel = isCrit ? "Critical" : v.confidence >= 0.7 ? "High" : v.confidence >= 0.4 ? "Medium" : "Low";
              return (
                <tr key={v.id}>
                  <td>
                    <Badge variant="neutral">{v.platform}</Badge>
                  </td>
                  <td>
                    <Badge variant={sev as "violation" | "pending" | "info"}>{sevLabel}</Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span
                      className="font-mono text-[13px] font-medium"
                      style={{ color: isCrit ? "var(--danger)" : "var(--text-secondary)" }}
                    >
                      {(v.confidence * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }} title={new Date(v.created_at).toLocaleString()}>
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteModal({
  assetName,
  onConfirm,
  onCancel,
  deleting,
}: {
  assetName: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="eg-modal-backdrop" onClick={onCancel}>
      <div className="eg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{ width: 36, height: 36, background: "var(--danger-soft)", border: "1px solid var(--danger-border)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Delete asset</p>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>This action cannot be undone</p>
          </div>
        </div>

        <p className="text-[13px] mb-2" style={{ color: "var(--text-secondary)" }}>
          You are about to permanently delete:
        </p>
        <p className="text-[13px] font-mono px-3 py-2 rounded mb-4 truncate" style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}>
          {assetName}
        </p>
        <p className="text-[12px] mb-6" style={{ color: "var(--text-muted)" }}>
          All fingerprints, embeddings, keywords, and linked violation records will be removed.
        </p>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={deleting} aria-label="Cancel deletion">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={deleting} aria-label="Confirm asset deletion">
            {!deleting && "Delete asset"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Asset Detail Page ─────────────────────────────────────────────────────────
export default function AssetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assetId = params.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [distributions, setDistributions] = useState<AssetDistribution[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [distLoading, setDistLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("distributions");
  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!assetId) return;
    Promise.all([
      getAsset(assetId),
      getAssetDistributions(assetId).finally(() => setDistLoading(false)),
      listViolations().catch(() => [] as Violation[]),
    ])
      .then(([a, dists, viols]) => {
        setAsset(a);
        setDistributions(dists);
        setViolations(viols.filter((v) => v.asset_id === assetId));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assetId]);

  async function refreshDistributions() {
    setDistLoading(true);
    const dists = await getAssetDistributions(assetId).catch(() => []);
    setDistributions(dists);
    setDistLoading(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAsset(assetId);
      router.push("/assets");
    } catch { setDeleting(false); }
  }

  // ── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <>
        <div
          className="sticky top-0 z-30 px-8 py-5"
          style={{
            background: "rgba(11,15,23,0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div className="max-w-[1200px] mx-auto">
            <Skeleton className="h-3 w-20 rounded mb-3" />
            <Skeleton className="h-6 w-48 rounded" />
          </div>
        </div>
        <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <Skeleton className="w-full rounded-xl" style={{ aspectRatio: "16/9" }} />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-36 w-full rounded-xl" />
              <Skeleton className="h-44 w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!asset) {
    return (
      <>
        <div
          className="sticky top-0 z-30 px-8 py-5"
          style={{ background: "rgba(11,15,23,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border-subtle)" }}
        >
          <div className="max-w-[1200px] mx-auto">
            <Link href="/assets" className="inline-flex items-center gap-1.5 mb-3 text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to Assets
            </Link>
            <h1 className="text-[22px] font-semibold" style={{ color: "var(--text-primary)" }}>Asset not found</h1>
          </div>
        </div>
        <div className="flex-1 px-8 py-16 text-center">
          <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>This asset does not exist or was deleted.</p>
        </div>
      </>
    );
  }

  const hasViolations = asset.violation_count > 0;
  const statusVariant = hasViolations ? "violation" : "verified";
  const statusLabel = hasViolations
    ? `${asset.violation_count} violation${asset.violation_count !== 1 ? "s" : ""}`
    : "Protected";

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-30 px-8 py-5"
        style={{
          background: "rgba(11,15,23,0.90)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="max-w-[1200px] mx-auto flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/assets"
              className="inline-flex items-center gap-1.5 mb-2 text-[12px] font-medium transition-colors"
              style={{ color: "var(--text-muted)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"/>
                <polyline points="12 19 5 12 12 5"/>
              </svg>
              Assets
            </Link>
            <h1
              className="font-semibold truncate"
              style={{ fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.01em" }}
            >
              {asset.name}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/insights/${assetId}`}>
              <Button variant="secondary" size="sm" aria-label="View AI insights">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
                AI Insights
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

          {/* ── Left column ─────────────────────────────────────── */}
          <div className="space-y-6 min-w-0">

            {/* Media hero */}
            <div
              style={{
                borderRadius: 12,
                overflow: "hidden",
                border: "1px solid var(--border-subtle)",
                boxShadow: "var(--soft-glow)",
              }}
            >
              <div style={{ aspectRatio: "16/9", background: "var(--bg-primary)" }}>
                {asset.asset_type === "video" ? (
                  <video
                    src={getAssetImageUrl(assetId)}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={getAssetImageUrl(assetId)}
                    alt={asset.name}
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
            </div>

            {/* Metadata card */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                padding: "20px 24px",
              }}
            >
              <p
                className="text-[11px] font-medium uppercase tracking-[0.06em] mb-4"
                style={{ color: "var(--text-muted)" }}
              >
                Asset metadata
              </p>

              <div>
                <MetaRow label="Filename">
                  <span style={{ color: "var(--text-primary)" }}>{asset.name}</span>
                </MetaRow>
                <MetaRow label="Type">
                  <Badge variant={asset.asset_type === "video" ? "info" : "neutral"}>
                    {asset.asset_type ?? "image"}
                  </Badge>
                </MetaRow>
                <MetaRow label="Registered">
                  <span style={{ color: "var(--text-secondary)" }}>
                    {new Date(asset.created_at).toLocaleString()}
                  </span>
                </MetaRow>
                <MetaRow label="Asset ID">
                  <span style={{ color: "var(--text-muted)" }} title={asset.id}>{asset.id}</span>
                </MetaRow>
                <MetaRow label="pHash">
                  <span style={{ color: "var(--text-muted)" }} title={asset.phash}>{asset.phash}</span>
                </MetaRow>
                {asset.description && (
                  <MetaRow label="Description">
                    <span className="font-sans" style={{ fontFamily: "var(--font-sans)", color: "var(--text-secondary)", fontSize: 13 }}>
                      {asset.description}
                    </span>
                  </MetaRow>
                )}
              </div>

              {/* Keywords */}
              {asset.keywords && asset.keywords.length > 0 && (
                <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.06em] mb-3" style={{ color: "var(--text-muted)" }}>
                    Discovery keywords
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {asset.keywords.map((k, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-mono px-2 py-0.5 rounded"
                        style={{
                          background: "var(--accent-soft)",
                          border: "1px solid rgba(142,197,255,0.15)",
                          color: "var(--accent-primary)",
                        }}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div>
              <TabBar active={activeTab} onChange={setActiveTab} />
              <div className="mt-5">
                {activeTab === "distributions" ? (
                  <DistributionsTab
                    assetId={assetId}
                    distributions={distributions}
                    loading={distLoading}
                    onRefresh={refreshDistributions}
                  />
                ) : (
                  <ViolationsTab violations={violations} loading={false} />
                )}
              </div>
            </div>
          </div>

          {/* ── Right column — sticky ────────────────────────────── */}
          <div className="space-y-4 lg:sticky lg:top-[90px] lg:self-start">

            {/* Status card */}
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid ${hasViolations ? "var(--danger-border)" : "var(--success-border)"}`,
                borderRadius: 12,
                padding: 20,
              }}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] mb-4" style={{ color: "var(--text-muted)" }}>
                Status
              </p>
              <div className="flex items-center gap-3 mb-3">
                <span
                  className="eg-status-dot"
                  style={{
                    background: hasViolations ? "var(--danger)" : "var(--success)",
                    boxShadow: `0 0 8px ${hasViolations ? "var(--danger)" : "var(--success)"}`,
                    width: 9, height: 9,
                  }}
                />
                <span
                  className="text-[20px] font-semibold"
                  style={{ color: hasViolations ? "var(--danger)" : "var(--success)", lineHeight: 1 }}
                >
                  {statusLabel}
                </span>
              </div>
              <p className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
                Registered {new Date(asset.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Quick actions */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] mb-4" style={{ color: "var(--text-muted)" }}>
                Quick actions
              </p>
              <div className="flex flex-col gap-2">
                <Link href="/scan" className="w-full">
                  <Button variant="primary" className="w-full justify-center" aria-label="Scan for leaks">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
                    </svg>
                    Scan now
                  </Button>
                </Link>
                {hasViolations && (
                  <Link href={`/graph/${assetId}`} className="w-full">
                    <Button variant="ghost" className="w-full justify-center" aria-label="View propagation graph">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
                        <line x1="7" y1="12" x2="17" y2="6"/><line x1="7" y1="12" x2="17" y2="18"/>
                      </svg>
                      View graph
                    </Button>
                  </Link>
                )}
                <Link href={`/insights/${assetId}`} className="w-full">
                  <Button variant="ghost" className="w-full justify-center" aria-label="View AI insights">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                    AI insights
                  </Button>
                </Link>
              </div>
            </div>

            {/* Danger zone */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--danger-border)",
                borderRadius: 12,
                padding: 20,
              }}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] mb-2" style={{ color: "var(--danger)" }}>
                Danger zone
              </p>
              <p className="text-[12px] mb-4 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Permanently removes this asset, all fingerprints, embeddings, keywords, and linked violation records.
              </p>
              <Button
                variant="destructive"
                className="w-full justify-center"
                loading={deleting}
                onClick={() => setShowDeleteModal(true)}
                aria-label="Delete this asset permanently"
              >
                {!deleting && "Delete asset"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <DeleteModal
          assetName={asset.name}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          deleting={deleting}
        />
      )}
    </>
  );
}
