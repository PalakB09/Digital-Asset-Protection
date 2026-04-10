"use client";

import { useState, useRef } from "react";
import { scanImage, scanVideoFile, scanFromUrl, getAssetImageUrl, type ScanResult } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

// ─── Platform selector options ─────────────────────────────────────────────────
const PLATFORMS = [
  { value: "unknown",     label: "Unknown" },
  { value: "twitter",     label: "Twitter / X" },
  { value: "instagram",   label: "Instagram" },
  { value: "youtube",     label: "YouTube" },
  { value: "telegram",    label: "Telegram" },
  { value: "facebook",    label: "Facebook" },
  { value: "tiktok",      label: "TikTok" },
  { value: "reddit",      label: "Reddit" },
  { value: "pirate_site", label: "Pirate Site" },
];

function isLikelyVideoUrl(url: string) {
  const l = url.toLowerCase();
  return (
    l.includes("youtube.com") || l.includes("youtu.be") ||
    l.includes("tiktok.com") || l.includes("twitter.com") ||
    l.includes("x.com") || l.includes("instagram.com/reel") ||
    l.includes("vimeo.com") ||
    [".mp4", ".mov", ".mkv", ".webm", ".avi"].some((e) => l.includes(e))
  );
}

// ─── Confidence color ──────────────────────────────────────────────────────────
function confidenceColor(conf: number) {
  if (conf >= 0.85) return "text-[var(--neu-danger)]";
  if (conf >= 0.5)  return "text-[var(--neu-warning)]";
  return "text-[var(--neu-success)]";
}

// ─── Upload Zone ───────────────────────────────────────────────────────────────
function UploadZone({
  onFile,
  loading,
}: {
  onFile: (f: File) => void;
  loading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => !loading && fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={`
        relative neu-inset rounded-xl p-12 text-center cursor-pointer
        transition-all duration-200 border-2
        ${loading ? "cursor-wait opacity-60" : ""}
        ${dragOver
          ? "border-[var(--neu-primary-lt)] ring-inset ring-2 ring-[var(--neu-primary-lt)]"
          : "border-transparent hover:shadow-[var(--neu-inset-sm)]"
        }
      `}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/mp4,video/mpeg,video/quicktime,video/webm,video/x-msvideo"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      {loading ? (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-2.5 h-2.5 rounded-full bg-[var(--neu-primary)] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
          <p className="text-[12px] font-bold text-[var(--neu-text-muted)] uppercase tracking-wide">Running pipeline…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${dragOver ? "neu-inset text-[var(--neu-primary)]" : "neu-raised text-[var(--neu-text-faint)]"}`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-[var(--neu-text)] mb-1">
              Drop image or video here
            </p>
            <p className="text-[12px] font-mono text-[var(--neu-text-muted)]">
              or click to browse · JPG, PNG, MP4, MOV
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scan Result Card ─────────────────────────────────────────────────────────
function ScanResultCard({
  result,
  previewUrl,
  fileType,
  onReset,
}: {
  result: ScanResult;
  previewUrl: string | null;
  fileType: "image" | "video" | null;
  onReset: () => void;
}) {
  const conf = result.confidence ?? 0;
  const confPct = (conf * 100).toFixed(1);

  return (
    <div className="neu-raised overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-[var(--neu-surface-dk)] opacity-90">
        <div className="flex items-center gap-4">
          {result.matched ? (
            <div className="w-10 h-10 rounded-full neu-inset flex items-center justify-center text-[var(--neu-danger)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full neu-inset flex items-center justify-center text-[var(--neu-success)]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <polyline points="9 12 11 14 15 10"/>
              </svg>
            </div>
          )}
          <div>
            <p className="text-[16px] font-bold text-[var(--neu-text)] uppercase tracking-wide">
              {result.status === "queued"
                ? "Scan queued"
                : result.matched
                ? "Match detected"
                : "No match found"}
            </p>
            <p className="text-[13px] font-sans font-medium text-[var(--neu-text-muted)] mt-1">
              {result.matched
                ? `This ${fileType} matches a registered asset`
                : `This ${fileType} appears to be original`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>Scan another</Button>
      </div>

      {result.matched && (
        <div className="p-6">
          <div className="grid grid-cols-2 gap-5 mb-6">
            <div>
              <p className="text-[11px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-3">
                Scanned {fileType}
              </p>
              <div className="aspect-video neu-inset rounded-lg overflow-hidden border-2 border-[var(--neu-danger)]">
                {previewUrl && fileType === "video" && !previewUrl.startsWith("http") ? (
                  <video src={previewUrl} className="w-full h-full object-cover" controls muted />
                ) : previewUrl ? (
                  <img src={previewUrl} alt="Scanned" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--neu-text-faint)] mt-4">
                    <p className="text-[12px] font-mono">No preview</p>
                  </div>
                )}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-3">
                Original asset
              </p>
              <div className="aspect-video neu-inset rounded-lg overflow-hidden border-2 border-[var(--neu-success)]">
                {result.asset_id ? (
                  <img src={getAssetImageUrl(result.asset_id)} alt="Original" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[var(--neu-text-faint)] mt-4">
                    <p className="text-[12px] font-mono">Not available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="neu-inset-sm p-4 rounded-lg">
              <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-2">Asset</p>
              <p className="text-[13px] font-bold text-[var(--neu-text)] truncate" title={result.asset_name}>
                {result.asset_name ?? "—"}
              </p>
            </div>
            <div className="neu-inset-sm p-4 rounded-lg">
              <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-2">Confidence</p>
              <p className={`text-[16px] font-mono font-bold ${confidenceColor(conf)}`}>
                {confPct}%
              </p>
            </div>
            <div className="neu-inset-sm p-4 rounded-lg">
              <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-2">Tier</p>
              <Badge variant={result.match_tier === "HIGH" ? "violation" : "pending"}>
                {result.match_tier ?? "—"}
              </Badge>
            </div>
            <div className="neu-inset-sm p-4 rounded-lg">
              <p className="text-[10px] font-bold text-[var(--neu-text-faint)] uppercase tracking-widest mb-2">Method</p>
              <p className="text-[13px] font-bold text-[var(--neu-text)] uppercase truncate">
                {result.match_type ?? "—"}
              </p>
            </div>
          </div>

          {result.leaked_by && (
            <div className="mt-5 p-4 neu-inset-sm rounded-lg border-l-4 border-[var(--neu-danger)]">
              <p className="text-[13px] font-bold text-[var(--neu-danger)]">
                Leak source identified: <span className="font-mono ml-2">{result.leaked_by}</span>
              </p>
            </div>
          )}

          {result.status === "queued" && result.job_id && (
            <p className="text-[11px] font-mono text-[var(--neu-text-muted)] mt-5">
              Job: {result.job_id}
            </p>
          )}
        </div>
      )}

      {!result.matched && result.details && (
        <div className="px-6 pb-6 pt-2">
          <p className="text-[12px] font-mono text-[var(--neu-text-muted)]">{result.details}</p>
        </div>
      )}
    </div>
  );
}

// ─── Recent Scan Row ───────────────────────────────────────────────────────────
function RecentScansTable({
  scans,
}: {
  scans: (ScanResult & { timestamp: number; type: string })[];
}) {
  if (scans.length === 0) return null;

  return (
    <div className="neu-raised overflow-hidden mt-6">
      <div className="px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-80">
        <h2 className="text-[15px] font-bold text-[var(--neu-text)] uppercase tracking-wide">Recent scans (this session)</h2>
      </div>
      <table className="neu-table">
        <thead>
          <tr>
            <th>Result</th>
            <th>Type</th>
            <th>Asset</th>
            <th className="text-right">Confidence</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((s, i) => (
            <tr key={i}>
              <td>
                <Badge variant={s.matched ? "violation" : "verified"}>
                  {s.matched ? "Match" : "Clean"}
                </Badge>
              </td>
              <td className="text-[13px] font-bold uppercase tracking-wide text-[var(--neu-text-muted)]">{s.type}</td>
              <td className="text-[13px] font-bold text-[var(--neu-text)] truncate max-w-[180px]">
                {s.asset_name ?? "—"}
              </td>
              <td className="text-right">
                {s.confidence != null ? (
                  <span className={`text-[13px] font-mono font-bold ${confidenceColor(s.confidence)}`}>
                    {(s.confidence * 100).toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-[13px] text-[var(--neu-text-faint)]">—</span>
                )}
              </td>
              <td className="text-[11px] font-mono text-[var(--neu-text-muted)]" title={new Date(s.timestamp).toLocaleString()}>
                {new Date(s.timestamp).toLocaleTimeString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Scan Page ─────────────────────────────────────────────────────────────────
export default function ScanPage() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"image" | "video" | null>(null);
  const [platform, setPlatform] = useState("unknown");
  const [sourceUrl, setSourceUrl] = useState("");
  const [recentScans, setRecentScans] = useState<(ScanResult & { timestamp: number; type: string })[]>([]);

  async function runScan(promise: Promise<ScanResult>, type: "image" | "video") {
    setScanning(true);
    setResult(null);
    setProgress(10);
    setProgressLabel("Initialising scan pipeline…");

    const steps = [
      [25, "Running pHash comparison…"],
      [45, "Running CLIP embedding match…"],
      [65, "Scanning platform sources…"],
      [80, "Verifying matches…"],
      [90, "Finalising results…"],
    ];
    let stepIdx = 0;
    const ticker = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgress(steps[stepIdx][0] as number);
        setProgressLabel(steps[stepIdx][1] as string);
        stepIdx++;
      }
    }, 500);

    try {
      const res = await promise;
      clearInterval(ticker);
      setProgress(100);
      setProgressLabel("Complete");
      setResult(res);
      setRecentScans((p) => [{ ...res, timestamp: Date.now(), type }, ...p].slice(0, 8));
    } catch {
      clearInterval(ticker);
      setResult({ matched: false, message: "Scan could not complete. Try again." });
    } finally {
      setScanning(false);
      setTimeout(() => { setProgress(0); setProgressLabel(""); }, 800);
    }
  }

  async function handleFile(file: File) {
    const isVideo = file.type.startsWith("video/");
    const type = isVideo ? "video" : "image";
    setPreviewUrl(URL.createObjectURL(file));
    setFileType(type);
    await runScan(
      isVideo ? scanVideoFile(file, undefined, platform) : scanImage(file, undefined, platform),
      type,
    );
  }

  async function handleUrlScan(e: React.FormEvent) {
    e.preventDefault();
    const u = sourceUrl.trim();
    if (!u) return;
    const type = isLikelyVideoUrl(u) ? "video" : "image";
    setPreviewUrl(u);
    setFileType(type);
    await runScan(scanFromUrl(u, platform, type), type);
    setSourceUrl("");
  }

  function reset() {
    setResult(null);
    setPreviewUrl(null);
    setFileType(null);
    setProgress(0);
    setProgressLabel("");
  }

  return (
    <>
      <PageHeader
        title="SCAN"
        subtitle="Upload or link a suspect image or video to check against registered assets"
      />

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <div className="lg:col-span-2 space-y-6">
            {/* Upload zone */}
            <div className="neu-raised p-6">
              <h2 className="text-[16px] font-bold text-[var(--neu-text)] mb-5 uppercase tracking-wide">Upload file to scan</h2>
              <UploadZone onFile={handleFile} loading={scanning} />

              {(scanning || progress > 0) && (
                <div className="mt-6">
                  <div className="neu-progress-track">
                    <div className="neu-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-[11px] font-bold tracking-wide uppercase text-[var(--neu-text-muted)] mt-3">{progressLabel}</p>
                </div>
              )}
            </div>

            {/* URL scan */}
            <div className="neu-raised p-6">
              <h2 className="text-[16px] font-bold text-[var(--neu-text)] mb-2 uppercase tracking-wide">Or scan from URL</h2>
              <p className="text-[12px] font-sans text-[var(--neu-text-muted)] mb-5">
                Paste a direct image URL or video page URL (YouTube, Twitter, etc.)
              </p>
              <form onSubmit={handleUrlScan} className="flex gap-3">
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--neu-text-faint)]">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                  </div>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="neu-input pl-10"
                  />
                </div>
                <Button variant="primary" type="submit" loading={scanning} disabled={!sourceUrl.trim()}>
                  {!scanning && "Scan URL"}
                </Button>
              </form>
            </div>

            {result && (
              <ScanResultCard
                result={result}
                previewUrl={previewUrl}
                fileType={fileType}
                onReset={reset}
              />
            )}

            <RecentScansTable scans={recentScans} />
          </div>

          <div className="space-y-6">
            <div className="neu-raised p-6">
              <h2 className="text-[16px] font-bold text-[var(--neu-text)] mb-5 uppercase tracking-wide">Scan options</h2>

              <div>
                <label htmlFor="scan-platform" className="block text-[11px] font-bold uppercase tracking-widest text-[var(--neu-text-muted)] mb-2">
                  Source platform
                </label>
                <div className="relative">
                  <select
                    id="scan-platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="neu-input appearance-none pr-8"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--neu-text-faint)]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
                <p className="text-[11px] font-sans text-[var(--neu-text-faint)] mt-3">
                  Tagging helps track violation origin in reports.
                </p>
              </div>
            </div>

            <div className="neu-raised p-6">
              <h2 className="text-[16px] font-bold text-[var(--neu-text)] mb-4 uppercase tracking-wide">How scan works</h2>
              <div className="space-y-5">
                {[
                  { step: "01", label: "pHash fingerprint", desc: "Near-instant exact match via perceptual hash" },
                  { step: "02", label: "CLIP embedding", desc: "Semantic similarity even with crops/edits" },
                  { step: "03", label: "Watermark check", desc: "Reads hidden watermark to ID the distributor" },
                ].map((s) => (
                  <div key={s.step} className="flex gap-4">
                    <span className="text-[14px] font-mono font-bold text-[var(--neu-primary)] shrink-0">{s.step}</span>
                    <div>
                      <p className="text-[13px] font-bold text-[var(--neu-text)] leading-tight">{s.label}</p>
                      <p className="text-[11px] font-sans text-[var(--neu-text-muted)] leading-relaxed mt-1">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
