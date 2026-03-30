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
}

export interface Violation {
  id: string;
  asset_id: string;
  asset_name: string;
  source_url: string;
  platform: string;
  confidence: number;
  match_tier: string;
  match_type: string;
  image_path: string;
  created_at: string;
}

export interface ScanResult {
  matched: boolean;
  violation_id?: string;
  asset_id?: string;
  asset_name?: string;
  confidence?: number;
  match_tier?: string;
  match_type?: string;
  details?: string;
  message?: string;
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

export async function registerAsset(file: File): Promise<Asset> {
  const formData = new FormData();
  formData.append("file", file);
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

export function getAssetImageUrl(id: string): string {
  return `${API_BASE}/assets/${id}/image`;
}

export async function registerVideoAsset(file: File): Promise<Asset> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/assets/video`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
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
