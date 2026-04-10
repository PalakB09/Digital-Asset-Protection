"use client";

import { useState, useEffect, useRef } from "react";
import {
  registerAsset,
  registerVideoAsset,
  registerAssetFromUrl,
  listAssets,
  getAssetImageUrl,
  deleteAsset,
  type Asset,
} from "@/lib/api";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SkeletonAssetCard } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/PageHeader";

// ─── Register Drawer ────────────────────────────────────────────────────────
function RegisterSection({
  onAssetRegistered,
}: {
  onAssetRegistered: () => void;
}) {
  const [description, setDescription] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [urlMediaType, setUrlMediaType] = useState<"auto" | "image" | "video">("auto");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
    keywords?: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isImage && !isVideo) {
      setMessage({ type: "error", text: "Please upload an image or video file." });
      return;
    }
    const desc = description.trim();
    if (!desc) {
      setMessage({ type: "error", text: "Add an asset description first — it's required to generate discovery keywords." });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const res = isVideo
        ? await registerVideoAsset(file, desc)
        : await registerAsset(file, desc);
      setMessage({
        type: "success",
        text: res.message ?? `"${file.name}" registered and fingerprinted.`,
        keywords: res.keywords,
      });
      setDescription("");
      onAssetRegistered();
    } catch (err) {
      setMessage({ type: "error", text: "We couldn't register this asset. Try again." });
    } finally {
      setUploading(false);
    }
  }

  async function handleUrlRegister() {
    const u = assetUrl.trim();
    if (!u || !description.trim()) {
      setMessage({ type: "error", text: "Both a URL and description are required." });
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const res = await registerAssetFromUrl(u, urlMediaType, description.trim());
      setMessage({
        type: "success",
        text: res.message ?? "Asset registered from URL.",
        keywords: res.keywords,
      });
      setAssetUrl("");
      setDescription("");
      onAssetRegistered();
    } catch (err) {
      setMessage({ type: "error", text: "We couldn't register this URL. Check that it points to an accessible image or video." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="neu-raised p-6 space-y-6">
      <h2 className="text-[16px] font-bold text-[var(--neu-text)] uppercase tracking-wide">Register new asset</h2>

      {/* Description field */}
      <div>
        <label htmlFor="asset-desc" className="block text-[11px] font-bold uppercase tracking-widest text-[var(--neu-text-muted)] mb-1">
          Asset description <span className="text-[var(--neu-text-faint)] font-bold">(required)</span>
        </label>
        <p className="text-[11px] font-sans text-[var(--neu-text-faint)] mb-3 leading-relaxed">
          Describe what this asset is. Used to generate discovery search keywords — not analyzed by AI vision.
        </p>
        <textarea
          id="asset-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Official IPL 2026 promo for Chennai; leaked clip from Show Name episode 3"
          rows={2}
          className="neu-input resize-y min-h-[70px]"
        />
      </div>

      {/* Upload zone */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--neu-text-muted)] mb-2">Upload file</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/mp4,video/mpeg,video/quicktime,video/webm,video/x-msvideo"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = "";
          }}
        />
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleUpload(f);
          }}
          className={`
            neu-inset rounded-xl p-8 text-center cursor-pointer
            transition-all duration-200 border-2
            ${dragOver
              ? "border-[var(--neu-primary-lt)] ring-inset ring-2 ring-[var(--neu-primary-lt)]"
              : "border-transparent hover:shadow-[var(--neu-inset-sm)]"
            }
            ${uploading ? "cursor-wait opacity-70" : ""}
          `}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-[3px]">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--neu-primary)] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
              <p className="text-[12px] font-bold text-[var(--neu-text-muted)] uppercase tracking-wide">Processing — extracting fingerprints and keywords…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--neu-text-faint)]">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <p className="text-[14px] font-bold text-[var(--neu-text)]">Drop a file or click to upload</p>
              <p className="text-[12px] font-mono text-[var(--neu-text-faint)]">JPG, PNG, WebP, MP4, MOV, WebM · Max 200 MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Register from URL */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--neu-text-muted)] mb-2">Or register from URL</p>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="url"
              value={assetUrl}
              onChange={(e) => setAssetUrl(e.target.value)}
              placeholder="https://..."
              className="neu-input"
            />
          </div>
          <div className="relative">
            <select
              value={urlMediaType}
              onChange={(e) => setUrlMediaType(e.target.value as "auto" | "image" | "video")}
              className="neu-input pr-8 appearance-none"
            >
              <option value="auto">Auto</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--neu-text-faint)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={handleUrlRegister}
            disabled={uploading || !assetUrl.trim() || !description.trim()}
            loading={uploading}
          >
            Register
          </Button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 neu-inset-sm rounded-lg border-l-4 ${message.type === "success" ? "border-[var(--neu-success)]" : "border-[var(--neu-danger)]"}`}>
          <p className="text-[13px] font-bold">{message.text}</p>
          {message.type === "success" && message.keywords && message.keywords.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--neu-text-faint)] mb-2">Discovery keywords</p>
              <div className="flex flex-wrap gap-2">
                {message.keywords.map((k, idx) => (
                  <span key={idx} className="text-[11px] font-mono neu-inset px-2 py-0.5 rounded-[6px] text-[var(--neu-primary)]">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Asset Card ──────────────────────────────────────────────────────────────
function AssetCard({
  asset,
  onDelete,
  deleting,
}: {
  asset: Asset;
  onDelete: (a: Asset) => void;
  deleting: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="neu-raised overflow-hidden flex flex-col"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative aspect-video overflow-hidden">
        {asset.asset_type === "video" ? (
          <video
            src={getAssetImageUrl(asset.id)}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={getAssetImageUrl(asset.id)}
            alt={asset.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
        
        {/* Inner shadow overlay for depth */}
        <div className="absolute inset-0 shadow-[inset_0_0_12px_rgba(0,0,0,0.3)] pointer-events-none" />

        <div className="absolute top-3 right-3">
          <div className="w-6 h-6 rounded-full neu-primary-pill !bg-[var(--neu-success)] flex items-center justify-center text-white" title="Verified and protected">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        {hovered && (
          <div className="absolute inset-0 bg-[var(--neu-surface-dk)]/90 flex items-center justify-center gap-3 transition-opacity duration-200">
            {asset.violation_count > 0 && (
              <Link href={`/graph/${asset.id}`} title="View propagation graph">
                <Button variant="secondary" size="icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="5" cy="12" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="19" r="2" /><line x1="7" y1="12" x2="17" y2="6" /><line x1="7" y1="12" x2="17" y2="18" />
                  </svg>
                </Button>
              </Link>
            )}
            <Link href={`/insights/${asset.id}`} title="View insights">
              <Button variant="secondary" size="icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </Button>
            </Link>
            <Link href={`/assets/${asset.id}`} title="Manage distribution">
              <Button variant="secondary" size="icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <p className="text-[14px] font-bold text-[var(--neu-text)] truncate mb-2" title={asset.name}>
          {asset.name}
        </p>

        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Badge variant={asset.asset_type === "video" ? "info" : "neutral"}>
              {asset.asset_type ?? "image"}
            </Badge>
            {asset.violation_count > 0 && (
              <Badge variant="violation">{asset.violation_count} violations</Badge>
            )}
          </div>
          <span className="text-[11px] font-mono text-[var(--neu-text-muted)] shrink-0">
            {new Date(asset.created_at).toLocaleDateString()}
          </span>
        </div>

        {asset.description && (
          <p className="text-[11px] font-sans text-[var(--neu-text-muted)] line-clamp-2 leading-relaxed mb-4">
            {asset.description}
          </p>
        )}

        {asset.keywords && asset.keywords.length > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--neu-text-faint)] mb-2">Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {asset.keywords.slice(0, 4).map((k, idx) => (
                <span key={idx} className="text-[10px] neu-inset text-[var(--neu-primary)] font-mono px-2 py-0.5 rounded-[6px]">
                  {k}
                </span>
              ))}
              {asset.keywords.length > 4 && (
                <span className="text-[10px] font-mono text-[var(--neu-text-faint)] mt-0.5">+{asset.keywords.length - 4}</span>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto pt-4 flex flex-col gap-3">
          <p className="text-[11px] font-mono font-bold text-[var(--neu-text-muted)] truncate" title={`pHash: ${asset.phash}`}>
            pHash: {asset.phash}
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="w-full justify-center"
            disabled={deleting}
            loading={deleting}
            onClick={() => onDelete(asset)}
          >
            {!deleting && "Delete asset"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Assets Page ──────────────────────────────────────────────────────────────
export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadAssets();
  }, []);

  async function loadAssets() {
    try {
      const data = await listAssets();
      setAssets(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(asset: Asset) {
    const label = asset.name.length > 60 ? `${asset.name.slice(0, 60)}…` : asset.name;
    if (
      !window.confirm(
        `Delete this asset?\n\n"${label}"\n\nThis removes all fingerprints, embeddings, keywords, and linked violation records. This cannot be undone.`
      )
    ) return;

    setDeletingId(asset.id);
    try {
      await deleteAsset(asset.id);
      await loadAssets();
    } catch {
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="ASSETS"
        subtitle="Register and manage your protected media assets"
        action={
          <Button
            variant="primary"
            onClick={() => document.getElementById("register-section")?.scrollIntoView({ behavior: "smooth" })}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Register asset
          </Button>
        }
      />

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">

        <div id="register-section" className="mb-8">
          <RegisterSection onAssetRegistered={loadAssets} />
        </div>

        <div className="neu-divider my-8" />

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[18px] font-bold text-[var(--neu-text)] uppercase tracking-wide">
            Registered assets
            {!loading && (
              <span className="ml-3 text-[14px] font-mono text-[var(--neu-text-muted)]">({assets.length})</span>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonAssetCard key={i} />)}
          </div>
        ) : assets.length === 0 ? (
          <div className="neu-inset rounded-xl p-12 text-center border-2 border-transparent">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-[var(--neu-text-faint)]">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
              <path d="m21 15-5-5L5 21"/>
            </svg>
            <p className="text-[16px] font-bold text-[var(--neu-text)] mb-2 uppercase tracking-wide">No assets registered yet</p>
            <p className="text-[13px] font-sans text-[var(--neu-text-muted)]">Upload your first image or video above to start protecting it</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onDelete={handleDelete}
                deleting={deletingId === asset.id}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
