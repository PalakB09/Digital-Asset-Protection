const API_BASE = "http://127.0.0.1:8000/api";

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
  keywords?: string[];
  description?: string | null;
}

export interface AssetRegistrationResponse extends Asset {
  message?: string;
  scan_jobs?: Record<string, string>;
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

export interface MonitoringEvent {
  id: string;
  platform: string;
  url: string;
  timestamp: string;
  status: "processed" | "pending";
  image_url?: string;
}

export interface PipelineStatus {
  twitter: { running: number; completed: number; failed: number; total_violations: number };
  youtube: { running: number; completed: number; failed: number; total_violations: number };
  google: { running: number; completed: number; failed: number; total_violations: number };
  telegram: { running: number; completed: number; failed: number; total_violations: number; channels: number };
}

export interface TriggerScanResponse {
  status: string;
  asset_id: string;
  asset_name: string;
  platforms_queued: string[];
  job_ids: Record<string, string>;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: "original" | "recipient" | "violation";
  platform?: string;
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
  label?: string;
  confidence?: number;
  match_type?: string;
  discovered_at?: string;
}

export interface Stats {
  total_assets: number;
  total_violations: number;
  high_confidence_matches: number;
  platforms_monitored: number;
}

export interface TwitterScrapeJobResponse {
  status: string;
  job_id: string;
  asset_id: string;
  asset_name: string;
}

export interface InsightsData {
  asset_id: string;
  asset_name: string;
  asset_type: string | null;
  asset_keywords: string[];
  registered_recipients: number;
  total_distributions: number;
  total_violations: number;
  propagation_channels: number;
 
  /** Weighted composite 0–10 (Gemini 40% + exposure 30% + confidence 30%) */
  composite_threat_score: number;
 
  /** Temporal spread metrics */
  velocity: {
    first_seen: string | null;
    last_seen: string | null;
    days_active: number;
    violations_per_day: number;
    last_7d_count: number;
    last_30d_count: number;
    acceleration: "ACCELERATING" | "STABLE" | "DECLINING" | "UNKNOWN";
  };
 
  /** Engagement / exposure metrics */
  engagement_risk: {
    total_estimated_views: number;
    total_estimated_likes: number;
    max_single_violation_views: number;
    max_single_violation_likes: number;
    avg_views_per_violation: number;
    exposure_tier: "VIRAL" | "HIGH" | "MODERATE" | "LOW" | "UNKNOWN";
    top_violation_id: string | null;
    top_violation_url: string | null;
    top_violation_platform: string | null;
  };
 
  /** Per-platform stats, sorted by total_views descending */
  platform_breakdown: Array<{
    platform: string;
    violation_count: number;
    total_views: number;
    total_likes: number;
    avg_confidence: number;
    watermark_verified_count: number;
    high_tier_count: number;
    dominant_match_type: string;
  }>;
 
  /** Highest-view platform name */
  highest_threat_platform: string;
 
  /** Aggregated signal quality */
  match_quality: {
    overall_confidence_avg: number;
    reranked_confidence_avg: number;
    watermark_verified_count: number;
    watermark_verified_pct: number;
    match_tier_counts: Record<string, number>;
    match_type_counts: Record<string, number>;
    phash: {
      available: number;
      avg_distance: number;
      identical_count: number;
      very_similar_count: number;
      similar_count: number;
    };
    clip_similarity: {
      available: number;
      avg: number;
      above_0_92_count: number;
    };
    ssim_alteration: {
      available: number;
      avg_ssim: number;
      heavily_altered_count: number;
      mildly_altered_count: number;
      near_identical_count: number;
    };
  };
 
  /** Which detection pipeline stages fired */
  detection_stages: {
    violations_with_stage_data: number;
    stage_hit_counts: Record<string, number>;
  };
 
  /** Watermark attribution forensics */
  watermark_forensics: {
    attributed_violation_count: number;
    traced_to_recipient_count: number;
    attribution_rate_pct: number;
    traced_recipients: Array<{
      violation_id: string;
      watermark_id: string;
      recipient_name: string;
      recipient_identifier: string | null;
      platform: string;
      source_url: string;
      detected_at: string | null;
    }>;
  };
 
  /** Leaker profiling */
  leaker_profile: {
    top_leaker: string | null;
    top_leaker_count: number;
    unique_leaker_count: number;
    leaker_risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
    is_registered_recipient: boolean;
    all_leakers: Array<{ leaker: string; count: number }>;
  };
 
  /** Media type and processing health */
  media_info: {
    media_type_counts: Record<string, number>;
    processing_status_counts: Record<string, number>;
    failed_count: number;
    pending_count: number;
  };
 
  /** Gemini AI analysis */
  ai_analysis: {
    primary_intent: "COMMERCIAL_PIRACY" | "PARODY_MEME" | "NEWS_REVIEW" | "UNKNOWN";
    risk_score: number;
    ai_summary: string;
  };
 
  // Optional: present only when total_violations === 0
  message?: string;
}
// ─── Assets ────────────────────────────────────────────────────

export async function registerAsset(file: File, description?: string): Promise<AssetRegistrationResponse> {
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

export async function deleteAsset(id: string): Promise<{ deleted: boolean; id: string }> {
  const res = await fetch(`${API_BASE}/assets/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function getAssetImageUrl(id: string): string {
  return `${API_BASE}/assets/${id}/image`;
}

export async function registerVideoAsset(file: File, description?: string): Promise<AssetRegistrationResponse> {
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
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Scanning ──────────────────────────────────────────────────

export async function scanImage(file: File, source?: string, platform?: string): Promise<ScanResult> {
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams();
  if (source) params.append("source_url", source);
  if (platform) params.append("platform", platform);
  const url = `${API_BASE}/scan?${params.toString()}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function scanVideoFile(file: File, source?: string, platform?: string): Promise<ScanResult> {
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams();
  if (source) params.append("source_url", source);
  if (platform) params.append("platform", platform);
  const url = `${API_BASE}/scan/video?${params.toString()}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function scanFromUrl(sourceUrl: string, platform?: string, mediaType?: string): Promise<ScanResult> {
  const params = new URLSearchParams();
  params.append("source_url", sourceUrl.trim());
  if (platform) params.append("platform", platform);
  if (mediaType) params.append("media_type", mediaType);
  const url = `${API_BASE}/scan/url?${params.toString()}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Per-Asset Trigger ─────────────────────────────────────────

export async function triggerAssetScan(
  assetId: string,
  platform: string,
  maxKeywords: number = 10,
  resultsPerKeyword: number = 20,
): Promise<TriggerScanResponse> {
  const res = await fetch(`${API_BASE}/scan/trigger/${assetId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      platform,
      max_keywords: maxKeywords,
      results_per_keyword: resultsPerKeyword,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Violations ────────────────────────────────────────────────

export async function getViolations(): Promise<Violation[]> {
  const res = await fetch(`${API_BASE}/violations`);
  if (!res.ok) throw new Error("Failed to fetch violations");
  return res.json();
}

export async function getDmca(violationId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/violations/${violationId}/dmca`);
  if (!res.ok) throw new Error("Failed to generate DMCA notice");
  return res.text();
}

export function getViolationImageUrl(id: string): string {
  return `${API_BASE}/violations/${id}/image`;
}

// ─── Graph ─────────────────────────────────────────────────────

export async function getGraphData(assetId?: string): Promise<GraphData> {
  const url = assetId ? `${API_BASE}/graph/${assetId}` : `${API_BASE}/graph`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch graph data");
  return res.json();
}

// ─── Stats ─────────────────────────────────────────────────────

export async function getStats(): Promise<Stats> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
}

// ─── Insights ──────────────────────────────────────────────────

export async function getAssetInsights(assetId: string): Promise<InsightsData> {
  const res = await fetch(`${API_BASE}/assets/${assetId}/insights`);
  if (!res.ok) throw new Error("Failed to load insights");
  return res.json();
}

// ─── Jobs ──────────────────────────────────────────────────────

export async function getJobStatus(jobId: string): Promise<{
  job_id: string;
  status: string;
  job_type: string;
  result?: Record<string, unknown>;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  if (!res.ok) throw new Error("Job not found");
  return res.json();
}

export async function queueTwitterScrape(
  assetId: string,
  maxKeywords?: number,
  postsPerKeyword?: number,
  mediaPerPost?: number,
  forcePostUrls?: string[],
): Promise<TwitterScrapeJobResponse> {
  const res = await fetch(`${API_BASE}/twitter/scrape/${assetId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      max_keywords: maxKeywords ?? 5,
      posts_per_keyword: postsPerKeyword ?? 20,
      media_per_post: mediaPerPost ?? 3,
      force_post_urls: forcePostUrls ?? [],
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Telegram Real-Time Monitoring ─────────────────────────────

export interface MonitoredChannel {
  id: string;
  channel_username: string;
  added_via_keyword: string | null;
  is_active: boolean;
  last_checked_at: string;
  created_at: string;
}

export async function getMonitoredChannels(): Promise<MonitoredChannel[]> {
  const res = await fetch(`${API_BASE}/telegram/channels`);
  if (!res.ok) throw new Error("Failed to load monitored channels");
  return res.json();
}

export async function addMonitoredChannel(channel_username: string): Promise<MonitoredChannel> {
  const res = await fetch(`${API_BASE}/telegram/channels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel_username }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Failed to add channel");
  }
  return res.json();
}

export async function toggleMonitoredChannel(id: string): Promise<MonitoredChannel> {
  const res = await fetch(`${API_BASE}/telegram/channels/${id}/toggle`, {
    method: "PUT",
  });
  if (!res.ok) throw new Error("Failed to toggle channel");
  return res.json();
}

// ─── Monitoring Feed & Pipeline Status ─────────────────────────

export async function getMonitoringFeed(limit: number = 50, offset: number = 0): Promise<MonitoringEvent[]> {
  const res = await fetch(`${API_BASE}/monitoring/feed?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error("Failed to fetch monitoring feed");
  return res.json();
}

export async function getPipelineStatus(): Promise<PipelineStatus> {
  const res = await fetch(`${API_BASE}/monitoring/pipeline-status`);
  if (!res.ok) throw new Error("Failed to fetch pipeline status");
  return res.json();
}

// ─── Backward-compatible aliases ───────────────────────────────
export const listViolations = getViolations;
export const scanByUrl = scanFromUrl;
export const scanVideo = scanVideoFile;

/** Generate DMCA notice for a violation (triggers backend PDF generation). */
export async function generateDMCA(violationId: string): Promise<string> {
  const res = await fetch(`${API_BASE}/violations/${violationId}/dmca`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to generate DMCA");
  return res.text();
}

/** Get the DMCA PDF download URL for a violation. */
export function getDMCADownloadUrl(violationId: string): string {
  return `${API_BASE}/violations/${violationId}/dmca/pdf`;
}

/** Get the download URL for a protected asset distribution copy. */
export function getDistributionDownloadUrl(distributionUrl: string): string {
  // distributionUrl is expected to be "/api/assets/download/{id}"
  // we want to ensure it uses the current API_BASE
  if (distributionUrl.startsWith("/api")) {
    return `${API_BASE.replace("/api", "")}${distributionUrl}`;
  }
  return `${API_BASE}${distributionUrl}`;
}

/** Get the image URL for a monitoring event or violation. */
export function getMonitoringImageUrl(imageUrl: string): string {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http")) return imageUrl;
  // If it's a relative path from the backend
  return `${API_BASE.replace("/api", "")}${imageUrl}`;
}



