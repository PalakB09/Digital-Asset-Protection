"use client";

import { useState, useEffect, useRef } from "react";
import {
  registerAsset,
  registerVideoAsset,
  registerAssetFromUrl,
  listAssets,
  getAssetImageUrl,
  type Asset,
} from "@/lib/api";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{
    type: string;
    text: string;
    keywords?: string[];
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [assetUrl, setAssetUrl] = useState("");
  const [urlMediaType, setUrlMediaType] = useState<"auto" | "image" | "video">("auto");

  useEffect(() => {
    loadAssets();
  }, []);

  async function loadAssets() {
    try {
      const data = await listAssets();
      setAssets(data);
    } catch {
      setMessage({ type: "error", text: "Failed to load assets" });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(file: File) {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isImage && !isVideo) {
      setMessage({ type: "error", text: "Please upload an image or video file" });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      if (isVideo) {
        const res = await registerVideoAsset(file);
        setMessage({
          type: "success",
          text: `"${file.name}" registered — ${res.frame_count} frames extracted and embedded. Asset is trackable.`,
          keywords: res.keywords,
        });
      } else {
        const res = await registerAsset(file);
        setMessage({
          type: "success",
          text: `"${file.name}" registered successfully! Fingerprints generated. Asset is trackable.`,
          keywords: res.keywords,
        });
      }
      await loadAssets();
    } catch (e) {
      setMessage({ type: "error", text: `Upload failed: ${e}` });
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  }

  async function handleRegisterFromUrl() {
    const u = assetUrl.trim();
    if (!u) return;
    setUploading(true);
    setMessage(null);
    try {
      const res = await registerAssetFromUrl(u, urlMediaType);
      setMessage({
        type: "success",
        text: res.message ?? "Asset registered from URL.",
        keywords: res.keywords,
      });
      setAssetUrl("");
      await loadAssets();
    } catch (e) {
      setMessage({ type: "error", text: `URL registration failed: ${e}` });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Asset Registry</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Register originals (file or URL). Each asset gets pHash, CLIP, watermark (images), and Gemini keywords for discovery.
        </p>
      </div>

      {/* Register from URL */}
      <div className="card p-4 mb-8">
        <p className="font-semibold mb-2">Register from link</p>
        <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>
          Direct image URL, or a video page URL (YouTube, etc.) — same processing as file upload, including AI keywords.
        </p>
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          <input
            type="url"
            placeholder="https://..."
            value={assetUrl}
            onChange={(e) => setAssetUrl(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
            }}
          />
          <select
            value={urlMediaType}
            onChange={(e) => setUrlMediaType(e.target.value as "auto" | "image" | "video")}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              color: "var(--text-primary)",
            }}
          >
            <option value="auto">Auto detect</option>
            <option value="image">Force image</option>
            <option value="video">Force video</option>
          </select>
          <button
            type="button"
            className="btn btn-primary"
            disabled={uploading || !assetUrl.trim()}
            onClick={handleRegisterFromUrl}
          >
            Register URL
          </button>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className={`upload-zone mb-8 ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept="image/*,video/mp4,video/mpeg,video/quicktime,video/webm,video/x-msvideo" className="hidden" onChange={handleFileChange} />
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="spinner" style={{ width: 32, height: 32 }}></div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Processing… fingerprints, embeddings, AI keywords
            </p>
          </div>
        ) : (
          <div>
            <p className="text-4xl mb-3">📤</p>
            <p className="font-semibold mb-1">Drop an image or video here, or click to upload</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Images: JPG, PNG, WebP • Videos: MP4, MOV, WebM, AVI
            </p>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg animate-fade-in ${message.type === "success" ? "badge-success" : "badge-high"}`}
             style={{ fontSize: 14 }}>
          <p className="mb-0">{message.text}</p>
          {message.type === "success" && message.keywords && message.keywords.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                AI keywords
              </p>
              <div className="flex flex-wrap gap-1.5">
                {message.keywords.map((k, idx) => (
                  <span
                    key={`msg-kw-${idx}-${k}`}
                    className="text-xs px-2 py-0.5 rounded-md"
                    style={{
                      background: "rgba(108, 99, 255, 0.15)",
                      color: "var(--accent-primary)",
                      border: "1px solid rgba(108, 99, 255, 0.35)",
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

      {/* Assets Grid */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="spinner" style={{ width: 32, height: 32 }}></div>
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🖼️</p>
          <p className="text-lg font-medium mb-2">No assets registered yet</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Upload your first image or video to start protecting it</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assets.map((asset, i) => (
            <div key={asset.id} className="card overflow-hidden animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="aspect-video relative overflow-hidden flex items-center justify-center" style={{ background: "var(--bg-secondary)" }}>
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
              </div>
              <div className="p-4">
                <p className="font-semibold text-sm mb-1 truncate">{asset.name}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {new Date(asset.created_at).toLocaleDateString()}
                  </span>
                  <div className="flex items-center gap-2">
                    {asset.violation_count > 0 && (
                      <span className="badge badge-high">{asset.violation_count} violations</span>
                    )}
                    <span className="badge badge-success">Protected</span>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                    AI keywords
                  </p>
                  {asset.keywords && asset.keywords.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {asset.keywords.map((k, idx) => (
                        <span
                          key={`asset-kw-${asset.id}-${idx}`}
                          className="text-xs px-2 py-0.5 rounded-md"
                          style={{
                            background: "rgba(108, 99, 255, 0.12)",
                            color: "var(--accent-primary)",
                            border: "1px solid rgba(108, 99, 255, 0.25)",
                          }}
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                      None (check GEMINI_API_KEY in backend/.env and server logs)
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                  <p className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>
                    pHash: {asset.phash}
                  </p>
                </div>
                {asset.violation_count > 0 && (
                  <a href={`/graph/${asset.id}`} className="btn btn-outline w-full justify-center mt-3 text-xs">
                    🕸️ View Propagation Graph
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
