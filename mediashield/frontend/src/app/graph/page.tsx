"use client";

import { useState, useEffect } from "react";
import { listAssets, getAssetImageUrl, type Asset } from "@/lib/api";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { SkeletonAssetCard } from "@/components/ui/Skeleton";

// ─── Graph Preview Card ────────────────────────────────────────────────────────
function GraphCard({ asset }: { asset: Asset }) {
  const nodeCount = Math.max(1, asset.violation_count * 2 + 3);

  return (
    <div className="neu-raised flex flex-col h-full">
      <div className="relative aspect-video neu-inset rounded-[12px] overflow-hidden border-2 border-transparent">
        <img
          src={getAssetImageUrl(asset.id)}
          alt={asset.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(0,0,0,0.3)] pointer-events-none" />
        
        <div className="absolute top-3 left-3">
          <span className="text-[11px] font-mono font-bold px-3 py-1 bg-[var(--neu-surface)] text-[var(--neu-primary)] rounded-full shadow-[var(--neu-shadow-sm)] border border-[var(--neu-surface-lt)]">
            {nodeCount} node{nodeCount !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <p className="text-[14px] font-bold text-[var(--neu-text)] truncate mb-2" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-[11px] font-mono text-[var(--neu-text-muted)] mb-4">
          {new Date(asset.created_at).toLocaleDateString()}
        </p>

        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[var(--neu-text-faint)] mb-4">
          <span>{new Set(["twitter", "telegram", "youtube", "google"]).size} platforms</span>
          <span className="text-[var(--neu-surface-dk)]">|</span>
          <span className={asset.violation_count > 0 ? "text-[var(--neu-danger)]" : ""}>{asset.violation_count} viols</span>
          <span className="text-[var(--neu-surface-dk)]">|</span>
          <span>0 dist</span>
        </div>

        {asset.violation_count > 0 && (
          <div className="mb-4">
            <Badge variant="violation">{asset.violation_count} violations detected</Badge>
          </div>
        )}

        <div className="mt-auto pt-4">
          <Link href={`/graph/${asset.id}`} className="block">
            <Button variant="secondary" className="w-full justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
                <line x1="7" y1="12" x2="17" y2="6"/><line x1="7" y1="12" x2="17" y2="18"/>
              </svg>
              View Graph
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Graph Index Page ──────────────────────────────────────────────────────────
export default function GraphIndexPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listAssets()
      .then((all) => setAssets(all.filter((a) => a.violation_count > 0)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = assets.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="PROPAGATION"
        subtitle="Visualise how your protected assets have spread across platforms"
        action={
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--neu-text-faint)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets…"
              className="neu-input pl-9 w-48"
            />
          </div>
        }
      />

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonAssetCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="neu-inset rounded-[20px] px-8 py-16 text-center border-2 border-transparent">
            <div className="w-14 h-14 neu-raised rounded-xl flex items-center justify-center mx-auto mb-5 text-[var(--neu-text-faint)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
                <line x1="7" y1="12" x2="17" y2="6"/><line x1="7" y1="12" x2="17" y2="18"/>
              </svg>
            </div>
            <p className="text-[16px] font-bold text-[var(--neu-text)] mb-2 uppercase tracking-wide">
              {assets.length === 0 ? "No graph data yet" : "No results for this search"}
            </p>
            <p className="text-[13px] font-sans text-[var(--neu-text-muted)] mb-6">
              {assets.length === 0
                ? "Scan assets to generate propagation data"
                : `No assets match "${search}"`}
            </p>
            {assets.length === 0 && (
              <Link href="/scan">
                <Button variant="primary">Go to Scan</Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((asset) => <GraphCard key={asset.id} asset={asset} />)}
          </div>
        )}
      </div>
    </>
  );
}
