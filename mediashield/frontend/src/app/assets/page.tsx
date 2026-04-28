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

// ─── Icons ────────────────────────────────────────────────────────────────────
function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

// ─── Register Section ─────────────────────────────────────────────────────────
function RegisterSection({ onAssetRegistered }: { onAssetRegistered: () => void }) {
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
      setMessage({ type: "error", text: "Upload an image or video file." });
      return;
    }
    const desc = description.trim();
    if (!desc) {
      setMessage({ type: "error", text: "Add an asset description — it's required to generate discovery keywords." });
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
    } catch {
      setMessage({ type: "error", text: "Registration failed. Try again." });
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
    } catch {
      setMessage({ type: "error", text: "Could not register this URL. Check that it points to an accessible image or video." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      id="register-section"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: 24,
      }}
    >
      <p className="text-[13px] font-medium mb-5" style={{ color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Register asset
      </p>

      <div className="space-y-5">
        {/* Description */}
        <div>
          <label htmlFor="asset-desc" className="eg-label">
            Description <span style={{ color: "var(--text-muted)", textTransform: "none", letterSpacing: 0 }}>(required)</span>
          </label>
          <p className="text-[12px] mb-2" style={{ color: "var(--text-muted)" }}>
            Describe the asset. Used to generate discovery keywords — not analyzed by AI vision.
          </p>
          <textarea
            id="asset-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Official IPL 2026 promo for Chennai; leaked clip from Show Name episode 3"
            rows={2}
            className="eg-textarea"
            style={{ minHeight: 72 }}
          />
        </div>

        {/* Upload dropzone */}
        <div>
          <p className="eg-label mb-2">Upload file</p>
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
            className="text-center cursor-pointer transition-all"
            style={{
              border: `1px dashed ${dragOver ? "var(--accent-primary)" : "var(--border-default)"}`,
              borderRadius: 10,
              padding: "28px 24px",
              background: dragOver ? "var(--accent-soft)" : "var(--bg-secondary)",
              boxShadow: dragOver ? "0 0 0 3px rgba(142,197,255,0.12)" : "none",
              opacity: uploading ? 0.6 : 1,
              cursor: uploading ? "wait" : "pointer",
            }}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="rounded-full animate-pulse"
                      style={{ width: 6, height: 6, background: "var(--accent-primary)", animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  Processing — extracting fingerprints and keywords…
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div style={{ color: "var(--text-muted)" }}>
                  <UploadIcon />
                </div>
                <p className="text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>
                  Drop a file or click to upload
                </p>
                <p className="text-[12px] font-mono" style={{ color: "var(--text-muted)" }}>
                  JPG, PNG, WebP, MP4, MOV, WebM · Max 200 MB
                </p>
              </div>
            )}
          </div>
        </div>

        {/* URL register */}
        <div>
          <p className="eg-label mb-2">Or register from URL</p>
          <div className="flex gap-2">
            <input
              type="url"
              value={assetUrl}
              onChange={(e) => setAssetUrl(e.target.value)}
              placeholder="https://..."
              className="eg-input flex-1"
              style={{ flexShrink: 1, minWidth: 0 }}
            />
            <div className="relative shrink-0">
              <select
                value={urlMediaType}
                onChange={(e) => setUrlMediaType(e.target.value as "auto" | "image" | "video")}
                className="eg-select"
              >
                <option value="auto">Auto</option>
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={handleUrlRegister}
              disabled={uploading || !assetUrl.trim() || !description.trim()}
              loading={uploading}
              className="shrink-0"
            >
              {!uploading && "Register"}
            </Button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={message.type === "success" ? "eg-alert-success" : "eg-alert-error"}>
            <p className="font-medium">{message.text}</p>
            {message.type === "success" && message.keywords && message.keywords.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-medium uppercase tracking-widest mb-2 opacity-70">Discovery keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {message.keywords.map((k, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-mono px-2 py-0.5 rounded"
                      style={{
                        background: "rgba(142,197,255,0.12)",
                        border: "1px solid rgba(142,197,255,0.2)",
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
        )}
      </div>
    </div>
  );
}

// ─── Asset Card ───────────────────────────────────────────────────────────────
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
  const [overlayVisible, setOverlayVisible] = useState(false);

  // Slight delay on overlay appearance for smoothness
  useEffect(() => {
    if (hovered) {
      const t = setTimeout(() => setOverlayVisible(true), 30);
      return () => clearTimeout(t);
    } else {
      setOverlayVisible(false);
    }
  }, [hovered]);

  return (
    <div
      className="overflow-hidden flex flex-col eg-card-interactive"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Media preview */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "16/9" }}>
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

        {/* Verified dot */}
        <div className="absolute top-2.5 right-2.5">
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 22,
              height: 22,
              background: asset.violation_count > 0 ? "var(--danger)" : "var(--success)",
              boxShadow: `0 0 8px ${asset.violation_count > 0 ? "var(--danger)" : "var(--success)"}`,
            }}
          >
            {asset.violation_count > 0 ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>

        {/* Hover overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center gap-2 transition-all"
          style={{
            background: "rgba(11,15,23,0.88)",
            backdropFilter: "blur(4px)",
            opacity: overlayVisible ? 1 : 0,
            pointerEvents: overlayVisible ? "auto" : "none",
          }}
        >
          {asset.violation_count > 0 && (
            <Link href={`/graph/${asset.id}`} title="View propagation graph">
              <button
                className="eg-btn eg-btn-secondary eg-btn-icon"
                aria-label="View propagation graph"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="5" cy="12" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="19" r="2" />
                  <line x1="7" y1="12" x2="17" y2="6" /><line x1="7" y1="12" x2="17" y2="18" />
                </svg>
              </button>
            </Link>
          )}
          <Link href={`/insights/${asset.id}`} title="View insights">
            <button className="eg-btn eg-btn-secondary eg-btn-icon" aria-label="View AI insights">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </button>
          </Link>
          <Link href={`/assets/${asset.id}`} title="Manage asset">
            <button className="eg-btn eg-btn-secondary eg-btn-icon" aria-label="Manage asset">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </button>
          </Link>
        </div>
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4">
        <Link href={`/assets/${asset.id}`} className="group">
          <p
            className="text-[14px] font-medium truncate mb-2 transition-colors"
            style={{ color: "var(--text-primary)" }}
            title={asset.name}
          >
            {asset.name}
          </p>
        </Link>

        <div className="flex items-center gap-2 mb-3">
          <Badge variant={asset.asset_type === "video" ? "info" : "neutral"}>
            {asset.asset_type ?? "image"}
          </Badge>
          {asset.violation_count > 0 && (
            <Badge variant="violation">{asset.violation_count} violation{asset.violation_count !== 1 ? "s" : ""}</Badge>
          )}
          <span
            className="ml-auto text-[11px] font-mono shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            {new Date(asset.created_at).toLocaleDateString()}
          </span>
        </div>

        {asset.description && (
          <p
            className="text-[12px] leading-relaxed line-clamp-2 mb-3"
            style={{ color: "var(--text-muted)" }}
          >
            {asset.description}
          </p>
        )}

        {asset.keywords && asset.keywords.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-1">
              {asset.keywords.slice(0, 4).map((k, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent-primary)",
                    border: "1px solid rgba(142,197,255,0.15)",
                  }}
                >
                  {k}
                </span>
              ))}
              {asset.keywords.length > 4 && (
                <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                  +{asset.keywords.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-auto pt-3 flex flex-col gap-2.5" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p
            className="text-[10px] font-mono truncate"
            style={{ color: "var(--text-muted)" }}
            title={`pHash: ${asset.phash}`}
          >
            pHash: {asset.phash}
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="w-full justify-center"
            disabled={deleting}
            loading={deleting}
            onClick={(e) => { e.preventDefault(); onDelete(asset); }}
            aria-label={`Delete ${asset.name}`}
          >
            {!deleting && "Delete asset"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 text-center"
      style={{
        border: "1px dashed var(--border-default)",
        borderRadius: 12,
        background: "var(--surface)",
      }}
    >
      <div className="mb-5" style={{ color: "var(--text-muted)" }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="m21 15-5-5L5 21"/>
        </svg>
      </div>
      <p className="text-[16px] font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>
        No assets registered
      </p>
      <p className="text-[13px] max-w-[280px]" style={{ color: "var(--text-muted)" }}>
        Upload your first image or video above to start protecting it with AI-powered monitoring.
      </p>
    </div>
  );
}

// ─── Assets Page ──────────────────────────────────────────────────────────────
export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  useEffect(() => { loadAssets(); }, []);

  async function loadAssets() {
    try {
      const data = await listAssets();
      setAssets(data);
    } catch (error) {
      console.error("Failed to load assets:", error);
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
      {/* ── Hero Header ──────────────────────────────────────────── */}
      <div
        className="relative px-8 py-10 eg-hero-glow"
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="max-w-[1200px] mx-auto relative z-10">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p
                className="text-[11px] font-medium uppercase tracking-[0.1em] mb-2"
                style={{ color: "var(--accent-primary)" }}
              >
                MediaShield
              </p>
              <h1
                className="font-semibold leading-none mb-2"
                style={{ fontSize: 32, color: "var(--text-primary)", letterSpacing: "-0.02em" }}
              >
                Assets
              </h1>
              <p className="text-[14px]" style={{ color: "var(--text-muted)" }}>
                Register and monitor protected media assets across platforms
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!loading && assets.length > 0 && (
                <span
                  className="text-[13px] font-mono px-3 py-1 rounded-full"
                  style={{
                    background: "var(--accent-soft)",
                    border: "1px solid var(--accent-border)",
                    color: "var(--accent-primary)",
                  }}
                >
                  {assets.length} asset{assets.length !== 1 ? "s" : ""}
                </span>
              )}
              <button
                className="eg-btn eg-btn-primary"
                onClick={() => {
                  setShowRegister((v) => !v);
                  if (!showRegister) setTimeout(() => document.getElementById("register-section")?.scrollIntoView({ behavior: "smooth" }), 50);
                }}
                aria-label="Register a new asset"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Register asset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">

        {/* Register section — collapsible */}
        <div
          style={{
            overflow: "hidden",
            maxHeight: showRegister ? "600px" : 0,
            opacity: showRegister ? 1 : 0,
            transition: "max-height 300ms ease, opacity 250ms ease",
            marginBottom: showRegister ? 32 : 0,
          }}
        >
          <RegisterSection onAssetRegistered={() => { loadAssets(); }} />
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2
              className="text-[16px] font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Registered assets
            </h2>
            {!loading && (
              <span className="text-[13px] font-mono" style={{ color: "var(--text-muted)" }}>
                {assets.length}
              </span>
            )}
          </div>
          {!showRegister && (
            <button
              className="eg-btn eg-btn-ghost eg-btn-sm"
              onClick={() => setShowRegister(true)}
              aria-label="Show register section"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add asset
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="eg-divider mb-6" />

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonAssetCard key={i} />)}
          </div>
        ) : assets.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
