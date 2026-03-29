"use client";

import { useState, useEffect, useRef } from "react";
import { registerAsset, registerVideoAsset, listAssets, getAssetImageUrl, type Asset } from "@/lib/api";

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
        setMessage({ type: "success", text: `"${file.name}" registered — ${res.frame_count} frames extracted and embedded.` });
      } else {
        await registerAsset(file);
        setMessage({ type: "success", text: `"${file.name}" registered successfully! Fingerprints generated.` });
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

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Asset Registry</h1>
        <p style={{ color: "var(--text-secondary)" }}>Upload original images to protect. Each asset gets a pHash + CLIP fingerprint.</p>
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
              Processing... (extracting frames + generating embeddings)
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
          {message.text}
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
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-4xl">🎬</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{asset.frame_count} frames</p>
                  </div>
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
