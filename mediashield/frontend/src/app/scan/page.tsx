"use client";

import { useState, useRef } from "react";
import { scanImage, scanVideo, getAssetImageUrl, type ScanResult } from "@/lib/api";

export default function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "video" | null>(null);
  const [platform, setPlatform] = useState("unknown");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleScan(file: File) {
    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");
    if (!isImage && !isVideo) return;

    setPreviewUrl(URL.createObjectURL(file));
    setFileType(isVideo ? "video" : "image");
    setScanning(true);
    setResult(null);

    try {
      const res = isVideo ? await scanVideo(file, platform) : await scanImage(file, platform);
      setResult(res);
    } catch (e) {
      setResult({ matched: false, message: `Scan failed: ${e}` });
    } finally {
      setScanning(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleScan(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleScan(file);
    e.target.value = "";
  }

  function reset() {
    setResult(null);
    setPreviewUrl(null);
    setFileType(null);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Scan for Violations</h1>
        <p style={{ color: "var(--text-secondary)" }}>Upload a suspect image or video to check if it matches any registered asset</p>
      </div>

      {/* Platform selector */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Platform:</label>
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
          }}
        >
          <option value="unknown">Unknown</option>
          <option value="twitter">Twitter/X</option>
          <option value="instagram">Instagram</option>
          <option value="facebook">Facebook</option>
          <option value="tiktok">TikTok</option>
          <option value="telegram">Telegram</option>
          <option value="reddit">Reddit</option>
          <option value="pirate_site">Pirate Site</option>
        </select>
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
        {scanning ? (
          <div className="flex flex-col items-center gap-3">
            <div className="spinner" style={{ width: 32, height: 32 }}></div>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {fileType === "video"
                ? "Extracting frames and running video similarity search..."
                : "Running tiered matching pipeline (pHash → CLIP)..."}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold mb-1">Drop a suspect image or video here, or click to upload</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Images: JPG, PNG, WebP • Videos: MP4, MOV, WebM, AVI
            </p>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="animate-fade-in">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Scan Result</h2>
              <button onClick={reset} className="btn btn-outline text-xs">Scan Another</button>
            </div>

            {result.matched ? (
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🚨</span>
                  <div>
                    <p className="text-xl font-bold" style={{ color: "var(--danger)" }}>Match Detected!</p>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                      This {fileType === "video" ? "video" : "image"} matches a registered asset
                    </p>
                  </div>
                </div>

                {/* Side by side comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>SCANNED {fileType === "video" ? "VIDEO" : "IMAGE"}</p>
                    <div className="rounded-lg overflow-hidden" style={{ border: "2px solid var(--danger)" }}>
                      {previewUrl && fileType === "video" ? (
                        <video src={previewUrl} className="w-full h-48 object-cover" controls muted />
                      ) : previewUrl ? (
                        <img src={previewUrl} alt="Scanned" className="w-full h-48 object-cover" />
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>ORIGINAL ASSET</p>
                    <div className="rounded-lg overflow-hidden" style={{ border: "2px solid var(--success)" }}>
                      {result.asset_id && (
                        <img src={getAssetImageUrl(result.asset_id)} alt="Original" className="w-full h-48 object-cover" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Match details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg" style={{ background: "rgba(108, 99, 255, 0.08)" }}>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Asset Name</p>
                    <p className="font-semibold text-sm mt-1">{result.asset_name}</p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "rgba(108, 99, 255, 0.08)" }}>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Confidence</p>
                    <p className="font-semibold text-sm mt-1" style={{ color: "var(--accent-primary)" }}>
                      {((result.confidence ?? 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "rgba(108, 99, 255, 0.08)" }}>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Tier</p>
                    <p className="mt-1">
                      <span className={`badge ${result.match_tier === "HIGH" ? "badge-high" : "badge-medium"}`}>
                        {result.match_tier}
                      </span>
                    </p>
                  </div>
                  <div className="p-3 rounded-lg" style={{ background: "rgba(108, 99, 255, 0.08)" }}>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Match Type</p>
                    <p className="font-semibold text-sm mt-1 uppercase">{result.match_type}</p>
                  </div>
                </div>

                <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>{result.details}</p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-3xl">✅</span>
                <div>
                  <p className="text-xl font-bold" style={{ color: "var(--success)" }}>No Match Found</p>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    This {fileType === "video" ? "video" : "image"} does not match any registered asset
                  </p>
                  {result.details ? (
                    <p className="text-xs mt-2 font-mono" style={{ color: "var(--text-muted)" }}>
                      {result.details}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
