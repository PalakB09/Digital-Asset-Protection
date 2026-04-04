const API_BASE = "http://localhost:8000/api";

export interface Asset {
  id: string;
  name: string;
  original_path: string;
  phash: string;
  embedding_id: string;
  created_at: string;
  violation_count: number;
  asset_type?: string;
  frame_count?: number;
  /** Gemini-generated discovery phrases stored on the asset */
  keywords?: string[];
  description?: string | null;
}

export interface AssetDistribution {
  recipient_id: string;
  recipient_name: string;
  recipient_identifier: string;
  watermark_id: string;
  generated: boolean;
  distribution_url?: string;
  created_at: string;
}

export interface Violation {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_type?: string;
  source_url: string;
  platform: string;
  confidence: number;
  match_tier: string;
  match_type: string;
  image_path: string;
  created_at: string;
  leaked_by?: string | null;
}

export interface ScanResult {
  matched: boolean;
  status?: string;
  job_id?: string;
  violation_id?: string;
  asset_id?: string;
  asset_name?: string;
  confidence?: number;
  match_tier?: string;
  match_type?: string;
  details?: string;
  message?: string;
  leaked_by?: string | null;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: "original" | "violation";
  platform: string;
  confidence?: number;
  match_tier?: string;
  match_type?: string;
  source_url?: string;
  created_at?: string;
  leaked_by?: string | null;
}

export interface GraphLink {
  source: string;
  target: string;
  confidence: number;
  match_type: string;
  discovered_at: string;
}

export interface Stats {
  total_assets: number;
  total_violations: number;
  high_confidence_matches: number;
  platforms_monitored: number;
}

// ─── Assets ────────────────────────────────────────────────────

export async function registerAsset(file: File, description?: string): Promise<Asset> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("description", (description ?? "").trim());
  const res = await fetch(`${API_BASE}/assets`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listAssets(): Promise<Asset[]> {
  const res = await fetch(`${API_BASE}/assets`);
  if (!res.ok) throw new Error("Failed to fetch assets");
  return res.json();
}

export async function getAsset(id: string): Promise<Asset> {
  const res = await fetch(`${API_BASE}/assets/${id}`);
  if (!res.ok) throw new Error("Asset not found");
  return res.json();
}

/** Permanently delete an asset (file, embeddings, violations). */
export async function deleteAsset(id: string): Promise<{ deleted: boolean; id: string }> {
  const res = await fetch(`${API_BASE}/assets/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function getAssetImageUrl(id: string): string {
  return `${API_BASE}/assets/${id}/image`;
}

export async function registerVideoAsset(file: File, description?: string): Promise<Asset> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("description", (description ?? "").trim());
  const res = await fetch(`${API_BASE}/assets/video`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** Register original asset from URL (image or video page / direct file). */
export async function registerAssetFromUrl(
  sourceUrl: string,
  mediaType: "auto" | "image" | "video" = "auto",
  description?: string
): Promise<Asset & { source_url?: string; message?: string }> {
  const res = await fetch(`${API_BASE}/assets/from-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_url: sourceUrl.trim(),
      media_type: mediaType,
      description: (description ?? "").trim(),
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function addAssetRecipients(assetId: string, recipients: { name: string; identifier: string }[]): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/assets/${assetId}/recipients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipients }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to add recipients");
  }
  return res.json();
}

export async function getAssetDistributions(assetId: string): Promise<AssetDistribution[]> {
  const res = await fetch(`${API_BASE}/assets/${assetId}/distributions`);
  if (!res.ok) throw new Error("Failed to load distributions");
  return res.json();
}

export async function generateProtectedCopies(assetId: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/assets/${assetId}/generate-protected`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to generate distributions");
  }
  return res.json();
}

// ─── Scan ──────────────────────────────────────────────────────

export async function scanImage(file: File, platform?: string): Promise<ScanResult> {
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams();
  if (platform) params.append("platform", platform);
  const url = `${API_BASE}/scan${params.toString() ? "?" + params.toString() : ""}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function scanVideo(file: File, platform?: string): Promise<ScanResult> {
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams();
  if (platform) params.append("platform", platform);
  const url = `${API_BASE}/scan/video${params.toString() ? "?" + params.toString() : ""}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function scanByUrl(sourceUrl: string, platform?: string, mediaType?: string): Promise<ScanResult> {
  const params = new URLSearchParams();
  params.append("source_url", sourceUrl);
  if (platform) params.append("platform", platform);
  if (mediaType) params.append("media_type", mediaType);
  const url = `${API_BASE}/scan/url?${params.toString()}`;
  const res = await fetch(url, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Violations ────────────────────────────────────────────────

export async function listViolations(): Promise<Violation[]> {
  const res = await fetch(`${API_BASE}/violations`);
  if (!res.ok) throw new Error("Failed to fetch violations");
  return res.json();
}

export async function getViolation(id: string): Promise<Violation> {
  const res = await fetch(`${API_BASE}/violations/${id}`);
  if (!res.ok) throw new Error("Violation not found");
  return res.json();
}

export function getViolationImageUrl(id: string): string {
  return `${API_BASE}/violations/${id}/image`;
}

export async function generateDMCA(violationId: string): Promise<{ message: string; pdf_filename: string }> {
  const res = await fetch(`${API_BASE}/violations/${violationId}/dmca`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to generate DMCA");
  return res.json();
}

export function getDMCADownloadUrl(violationId: string): string {
  return `${API_BASE}/violations/${violationId}/dmca`;
}

// ─── Graph ─────────────────────────────────────────────────────

export async function getGraphData(assetId: string): Promise<GraphData> {
  const res = await fetch(`${API_BASE}/graph/${assetId}`);
  if (!res.ok) throw new Error("Graph data not found");
  return res.json();
}

export async function listGraphAssets(): Promise<Asset[]> {
  const res = await fetch(`${API_BASE}/graph`);
  if (!res.ok) throw new Error("Failed to fetch graph assets");
  return res.json();
}

// ─── Stats ─────────────────────────────────────────────────────

export async function getStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

// ─── Jobs (Background Processing) ──────────────────────────────

export interface JobStatus {
  job_id: string;
  status: "pending" | "processing" | "done" | "failed";
  job_type: string;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  result?: ScanResult;
  error?: string;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!res.ok) throw new Error("Job not found");
  return res.json();
}

export async function listJobs(limit: number = 50): Promise<JobStatus[]> {
  const res = await fetch(`${API_BASE}/jobs?limit=${limit}`);
  if (!res.ok) throw new Error("Failed to fetch jobs");
  return res.json();
}

export async function scanByUrlAsync(sourceUrl: string, platform?: string, mediaType?: string): Promise<{ status: string; job_id?: string }> {
  const params = new URLSearchParams();
  params.append("source_url", sourceUrl);
  params.append("async_mode", "true");
  if (platform) params.append("platform", platform);
  if (mediaType) params.append("media_type", mediaType);
  const url = `${API_BASE}/scan/url?${params.toString()}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
