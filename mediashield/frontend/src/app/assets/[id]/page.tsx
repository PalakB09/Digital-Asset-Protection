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
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

const API_BASE = "http://localhost:8000/api";

// ─── Tab bar ──────────────────────────────────────────────────────────────────
type TabId = "distributions" | "violations";

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "distributions", label: "Distributions" },
    { id: "violations",    label: "Violations" },
  ];
  return (
    <div className="flex gap-2 neu-inset p-2 rounded-[12px] w-fit">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`
            px-5 py-2 text-[12px] font-bold uppercase tracking-wide rounded-[8px] transition-all duration-200
            ${active === t.id
              ? "neu-raised text-[var(--neu-primary)]"
              : "text-[var(--neu-text-muted)] hover:text-[var(--neu-text)] hover:shadow-[var(--neu-shadow-xs)]"
            }
          `}
        >
          {t.label}
        </button>
      ))}
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
      setMsg({ type: "success", text: `Twitter scan queued for ${res.asset_name}.` });
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
    <div className="space-y-6">
      {/* Add partner form */}
      <div className="neu-raised p-6">
        <p className="text-[14px] font-bold text-[var(--neu-text)] mb-4 uppercase tracking-wide">Add distribution partner</p>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Partner name — e.g. Acme Media"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={adding}
            className="flex-1 neu-input"
          />
          <input
            type="text"
            placeholder="Identifier — email or agency ID"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            disabled={adding}
            className="flex-1 neu-input"
          />
          <Button variant="primary" type="submit" loading={adding} disabled={!name || !identifier}>
            {!adding && "Add partner"}
          </Button>
        </form>
      </div>

      {msg && (
        <div className={`p-4 neu-inset-sm rounded-[10px] border-l-4 ${msg.type === "success" ? "border-[var(--neu-success)]" : "border-[var(--neu-danger)]"}`}>
          <p className="text-[13px] font-bold">{msg.text}</p>
        </div>
      )}

      {/* Distribution log table */}
      <div className="neu-raised overflow-hidden">
        <div className="flex flex-wrap items-center justify-between px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-80 gap-3">
          <p className="text-[15px] font-bold text-[var(--neu-text)] uppercase tracking-wide">Distribution log</p>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm" loading={scraping} onClick={handleScrapeX}>
              {!scraping && "Scan X / Twitter"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              loading={generating}
              disabled={distributions.length === 0 || distributions.every(d => d.generated)}
              onClick={handleGenerate}
            >
              {!generating && "Generate pending copies"}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" repeat={3} />
          </div>
        ) : distributions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[15px] font-bold text-[var(--neu-text)] uppercase tracking-wide">No partners yet</p>
            <p className="text-[13px] font-sans text-[var(--neu-text-muted)] mt-2">Add a distribution partner above to start tracking</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="neu-table">
              <thead>
                <tr>
                  <th>Partner</th>
                  <th>Identifier</th>
                  <th>Watermark ID</th>
                  <th className="text-right">Copy</th>
                </tr>
              </thead>
              <tbody>
                {distributions.map((d) => (
                  <tr key={d.recipient_id}>
                    <td><p className="text-[13px] font-bold text-[var(--neu-text)]">{d.recipient_name}</p></td>
                    <td><p className="text-[12px] font-sans text-[var(--neu-text-muted)]">{d.recipient_identifier}</p></td>
                    <td>
                      <p className="text-[11px] font-mono text-[var(--neu-text-faint)] truncate max-w-[120px]" title={d.watermark_id}>
                        {d.watermark_id}
                      </p>
                    </td>
                    <td className="text-right">
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
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" repeat={3} />
      </div>
    );
  }
  if (violations.length === 0) {
    return (
      <div className="neu-raised px-6 py-16 text-center">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-[var(--neu-text-faint)]">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
        </svg>
        <p className="text-[16px] font-bold text-[var(--neu-text)] uppercase tracking-wide">No violations for this asset</p>
        <p className="text-[13px] font-sans text-[var(--neu-text-muted)] mt-2">Run a scan to detect infringements</p>
      </div>
    );
  }
  return (
    <div className="neu-raised overflow-hidden">
      <div className="overflow-x-auto">
        <table className="neu-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Severity</th>
              <th className="text-right">Confidence</th>
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
                  <td><Badge variant="neutral">{v.platform}</Badge></td>
                  <td><Badge variant={sev as "violation" | "pending" | "info"}>{sevLabel}</Badge></td>
                  <td className="text-right">
                    <span className={`font-mono text-[13px] font-bold ${isCrit ? "text-[var(--neu-danger)]" : "text-[var(--neu-text-muted)]"}`}>
                      {(v.confidence * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <span className="font-mono text-[11px] text-[var(--neu-text-muted)]" title={new Date(v.created_at).toLocaleString()}>
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
    if (!asset) return;
    if (!window.confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteAsset(assetId);
      router.push("/assets");
    } catch { setDeleting(false); }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Asset" backHref="/assets" backLabel="Back to Assets" />
        <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="aspect-video w-full rounded-xl" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
            <div className="space-y-5">
              <Skeleton className="h-40 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!asset) {
    return (
      <>
        <PageHeader title="Asset not found" backHref="/assets" backLabel="Back to Assets" />
        <div className="flex-1 px-8 py-16 text-center">
          <p className="text-[14px] font-bold text-[var(--neu-text-muted)] uppercase tracking-wide">This asset does not exist or was deleted.</p>
        </div>
      </>
    );
  }

  const hasViolations = asset.violation_count > 0;
  const statusVariant = hasViolations ? "violation" : "verified";
  const statusLabel = hasViolations ? `${asset.violation_count} violation${asset.violation_count !== 1 ? "s" : ""}` : "Protected";

  return (
    <>
      <PageHeader
        title={asset.name}
        subtitle="Asset detail and distribution tracking"
        backHref="/assets"
        backLabel="Back to Assets"
        action={
          <Link href={`/insights/${assetId}`}>
            <Button variant="secondary" size="sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              View Insights
            </Button>
          </Link>
        }
      />

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left col — 65% ────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Hero media */}
            <div className="neu-inset rounded-[16px] overflow-hidden border-2 border-transparent">
              <div className="aspect-video">
                {asset.asset_type === "video" ? (
                  <video src={getAssetImageUrl(assetId)} controls className="w-full h-full object-contain" />
                ) : (
                  <img src={getAssetImageUrl(assetId)} alt={asset.name} className="w-full h-full object-contain" />
                )}
              </div>
            </div>

            {/* Metadata card */}
            <div className="neu-raised p-6">
              <h2 className="text-[16px] font-bold text-[var(--neu-text)] mb-5 uppercase tracking-wide">Asset metadata</h2>
              <div className="grid grid-cols-2 gap-5 text-sm">
                <div>
                  <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Filename</p>
                  <p className="font-mono text-[12px] font-bold text-[var(--neu-text)] truncate" title={asset.name}>{asset.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Type</p>
                  <Badge variant={asset.asset_type === "video" ? "info" : "neutral"}>
                    {asset.asset_type ?? "image"}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Registered</p>
                  <p className="text-[12px] font-mono text-[var(--neu-text-muted)]">{new Date(asset.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Asset ID</p>
                  <p className="font-mono text-[11px] text-[var(--neu-text-muted)] truncate" title={asset.id}>{asset.id}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">pHash fingerprint</p>
                  <p className="font-mono text-[11px] text-[var(--neu-text-muted)] truncate" title={asset.phash}>{asset.phash}</p>
                </div>
                {asset.description && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-1.5">Description</p>
                    <p className="text-[13px] font-sans text-[var(--neu-text-muted)] leading-relaxed">{asset.description}</p>
                  </div>
                )}
              </div>

              {/* Keywords */}
              {asset.keywords && asset.keywords.length > 0 && (
                <div className="mt-6 pt-5 border-t border-[var(--neu-surface-dk)] opacity-80">
                  <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-3">Discovery keywords</p>
                  <div className="flex flex-wrap gap-2">
                    {asset.keywords.map((k, i) => (
                      <span key={i} className="text-[11px] font-mono neu-inset text-[var(--neu-primary)] rounded-[6px] px-2 py-0.5">{k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Tabs section */}
            <div>
              <TabBar active={activeTab} onChange={setActiveTab} />
              <div className="mt-6">
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

          {/* ── Right col — 35%, sticky ──────────────────────────── */}
          <div className="space-y-6 lg:sticky lg:top-[90px] lg:self-start">

            {/* Status card */}
            <div className="neu-raised p-6">
              <p className="text-[11px] font-bold text-[var(--neu-text-muted)] uppercase tracking-widest mb-4">Status</p>
              <div className="flex items-center gap-3 mb-4">
                <Badge variant={statusVariant}>{statusLabel}</Badge>
              </div>
              <p className="text-[11px] font-mono font-bold text-[var(--neu-text-faint)]">
                Registered {new Date(asset.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Quick actions */}
            <div className="neu-raised p-6">
              <p className="text-[11px] font-bold text-[var(--neu-text-muted)] uppercase tracking-widest mb-4">Quick actions</p>
              <div className="flex flex-col gap-3">
                <Link href="/scan">
                  <Button variant="primary" className="w-full justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
                    </svg>
                    Scan Now
                  </Button>
                </Link>
                {hasViolations && (
                  <Link href={`/graph/${assetId}`}>
                    <Button variant="secondary" className="w-full justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
                        <line x1="7" y1="12" x2="17" y2="6"/><line x1="7" y1="12" x2="17" y2="18"/>
                      </svg>
                      View Propagation Graph
                    </Button>
                  </Link>
                )}
                <Link href={`/insights/${assetId}`}>
                  <Button variant="secondary" className="w-full justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                    AI Insights
                  </Button>
                </Link>
              </div>
            </div>

            {/* Danger zone */}
            <div className="neu-raised p-6 border-l-4 border-[var(--neu-danger)]">
              <p className="text-[11px] font-bold text-[var(--neu-danger)] uppercase tracking-widest mb-2">Danger zone</p>
              <p className="text-[11px] font-sans text-[var(--neu-text-muted)] mb-5 leading-relaxed">
                Permanently removes this asset, all fingerprints, embeddings, keywords, and linked violation records.
              </p>
              <Button
                variant="destructive"
                className="w-full justify-center"
                loading={deleting}
                onClick={handleDelete}
              >
                {!deleting && "Delete asset"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
