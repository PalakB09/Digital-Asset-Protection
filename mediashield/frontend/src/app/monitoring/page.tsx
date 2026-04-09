"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getMonitoredChannels,
  toggleMonitoredChannel,
  addMonitoredChannel,
  type MonitoredChannel,
  getMonitoringFeed,
  type MonitoringEvent,
  getPipelineStatus,
  type PipelineStatus,
  triggerAssetScan,
  type TriggerScanResponse,
  listAssets,
  type Asset,
} from "@/lib/api";

const API_BASE = "http://localhost:8000/api";
const LIMIT = 50;

const PLATFORM_META: Record<string, { icon: string; color: string; label: string }> = {
  telegram: { icon: "✈️", color: "#229ED9", label: "Telegram" },
  twitter:  { icon: "𝕏",  color: "#1DA1F2", label: "Twitter / X" },
  youtube:  { icon: "▶️", color: "#FF0000", label: "YouTube" },
  google:   { icon: "🔍", color: "#4285F4", label: "Google Web+Images" },
};

interface TriggerEntry {
  id: string;
  assetName: string;
  platforms: string[];
  jobIds: Record<string, string>;
  timestamp: Date;
  status: "queued" | "running" | "done";
}

export default function MonitoringPage() {
  // Data
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [channels, setChannels] = useState<MonitoredChannel[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);

  // UI
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [newChannel, setNewChannel] = useState("");
  const [adding, setAdding] = useState(false);
  const [platformFilter, setPlatformFilter] = useState("all");

  // Trigger panel
  const [triggerAssetId, setTriggerAssetId] = useState("");
  const [triggerPlatform, setTriggerPlatform] = useState("all");
  const [triggerMaxKw, setTriggerMaxKw] = useState(10);
  const [triggerResultsPer, setTriggerResultsPer] = useState(20);
  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerHistory, setTriggerHistory] = useState<TriggerEntry[]>([]);

  // Media viewer
  const [activeMediaUrl, setActiveMediaUrl] = useState<string | null>(null);

  // Smart polling: track previous running count to detect transitions
  const prevRunningRef = useRef(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [chans, feed, status, assetList] = await Promise.all([
        getMonitoredChannels().catch(() => []),
        getMonitoringFeed(LIMIT, 0),
        getPipelineStatus(),
        listAssets(),
      ]);
      setChannels(chans);
      setEvents(feed);
      setPipelineStatus(status);
      setAssets(assetList);
      setOffset(LIMIT);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Smart status polling: auto-refresh feed when jobs finish
  useEffect(() => {
    loadData();
    const interval = setInterval(async () => {
      try {
        const status = await getPipelineStatus();
        setPipelineStatus(status);

        // Count total running jobs
        const totalRunning = Object.values(status).reduce((sum, s) => {
          if (typeof s === "object" && s !== null && "running" in s) {
            return sum + ((s as Record<string, number>).running ?? 0);
          }
          return sum;
        }, 0);

        // If was running → now idle, auto-refresh the feed
        if (prevRunningRef.current > 0 && totalRunning === 0) {
          const feed = await getMonitoringFeed(LIMIT, 0);
          setEvents(feed);
          setOffset(LIMIT);

          // Mark trigger history as done
          setTriggerHistory((prev) =>
            prev.map((t) => (t.status !== "done" ? { ...t, status: "done" as const } : t))
          );
        } else if (totalRunning > 0) {
          // Mark running
          setTriggerHistory((prev) =>
            prev.map((t) => (t.status === "queued" ? { ...t, status: "running" as const } : t))
          );
        }

        prevRunningRef.current = totalRunning;
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  async function loadMoreEvents() {
    setLoadingMore(true);
    try {
      const more = await getMonitoringFeed(LIMIT, offset);
      setEvents((prev) => [...prev, ...more]);
      setOffset(offset + LIMIT);
    } catch (e) { console.error(e); }
    finally { setLoadingMore(false); }
  }

  async function handleAddChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!newChannel.trim()) return;
    setAdding(true);
    try {
      await addMonitoredChannel(newChannel);
      setNewChannel("");
      const chans = await getMonitoredChannels();
      setChannels(chans);
    } catch { alert("Failed to add channel"); }
    finally { setAdding(false); }
  }

  async function handleToggle(id: string) {
    try {
      await toggleMonitoredChannel(id);
      const chans = await getMonitoredChannels();
      setChannels(chans);
    } catch (e) { console.error(e); }
  }

  async function handleTriggerScan(e: React.FormEvent) {
    e.preventDefault();
    if (!triggerAssetId) return;
    setTriggerLoading(true);
    try {
      const res = await triggerAssetScan(triggerAssetId, triggerPlatform, triggerMaxKw, triggerResultsPer);

      // Add to trigger history (stackable — doesn't replace previous)
      const entry: TriggerEntry = {
        id: Date.now().toString(),
        assetName: res.asset_name,
        platforms: res.platforms_queued,
        jobIds: res.job_ids,
        timestamp: new Date(),
        status: "queued",
      };
      setTriggerHistory((prev) => [entry, ...prev].slice(0, 20));

      // Reset form for next trigger
      setTriggerAssetId("");
    } catch (e) {
      console.error(e);
      alert("Failed to trigger scan");
    } finally {
      setTriggerLoading(false);
    }
  }

  const filteredEvents = platformFilter === "all"
    ? events
    : events.filter((e) => {
        if (platformFilter === "google") return e.platform === "web" || e.platform === "google";
        return e.platform === platformFilter;
      });

  function renderPlatformCard(key: string) {
    const meta = PLATFORM_META[key];
    const s = pipelineStatus?.[key as keyof PipelineStatus] as Record<string, number> | undefined;
    if (!s) return null;
    const isActive = (s.running ?? 0) > 0;
    return (
      <div
        key={key}
        className="card p-4 animate-fade-in relative overflow-hidden"
        style={{ borderLeft: `3px solid ${meta.color}` }}
      >
        {isActive && (
          <div className="absolute top-3 right-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: meta.color }}></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: meta.color }}></span>
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">{meta.icon}</span>
          <span className="font-bold text-sm">{meta.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span style={{ color: "var(--text-muted)" }}>Running</span>
            <p className="font-bold text-base" style={{ color: isActive ? meta.color : "var(--text-primary)" }}>
              {s.running ?? 0}
            </p>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Done</span>
            <p className="font-bold text-base">{s.completed ?? 0}</p>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Violations</span>
            <p className="font-bold text-base" style={{ color: (s.total_violations ?? 0) > 0 ? "#f87171" : "var(--text-primary)" }}>
              {s.total_violations ?? 0}
            </p>
          </div>
          {key === "telegram" && (
            <div>
              <span style={{ color: "var(--text-muted)" }}>Channels</span>
              <p className="font-bold text-base">{(s as Record<string, number>).channels ?? 0}</p>
            </div>
          )}
          {key !== "telegram" && (
            <div>
              <span style={{ color: "var(--text-muted)" }}>Failed</span>
              <p className="font-bold text-base">{s.failed ?? 0}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  function triggerStatusBadge(status: TriggerEntry["status"]) {
    if (status === "queued") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-500/30">QUEUED</span>;
    if (status === "running") return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-300 border border-blue-500/30 animate-pulse">RUNNING</span>;
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-500/30">✓ DONE</span>;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Monitoring Command Center</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          4-pipeline unified control: auto-triggered on upload, manually controllable per-asset per-platform.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">

          {/* ─── Platform Status Cards ──────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {["telegram", "twitter", "youtube", "google"].map(renderPlatformCard)}
          </div>

          {/* ─── Per-Asset Trigger Panel ────────────────────────── */}
          <div className="card p-0 overflow-hidden animate-fade-in" style={{ border: "1px solid rgba(108,99,255,0.25)" }}>
            <div className="p-5" style={{ background: "rgba(108,99,255,0.05)", borderBottom: "1px solid var(--border-color)" }}>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>⚡</span> Manual Scan Trigger
              </h2>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                Select an asset and platform, configure depth, and dispatch background workers. You can stack multiple scans.
              </p>
            </div>
            <form onSubmit={handleTriggerScan} className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold mb-1.5 text-gray-300">Asset</label>
                <select
                  className="w-full bg-black/30 border border-white/15 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none"
                  value={triggerAssetId}
                  onChange={(e) => setTriggerAssetId(e.target.value)}
                >
                  <option value="">— Select an asset —</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.keywords?.length ?? 0} keywords)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-300">Platform</label>
                <select
                  className="w-full bg-black/30 border border-white/15 rounded-lg p-2.5 text-sm focus:border-indigo-500 outline-none"
                  value={triggerPlatform}
                  onChange={(e) => setTriggerPlatform(e.target.value)}
                >
                  <option value="all">ALL Platforms</option>
                  <option value="youtube">YouTube</option>
                  <option value="google">Google Web+Images</option>
                  <option value="twitter">Twitter / X</option>
                  <option value="telegram">Telegram Discovery</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-300">
                  Keywords: <span className="text-indigo-400">{triggerMaxKw}</span>
                </label>
                <input
                  type="range" min={1} max={30} value={triggerMaxKw}
                  onChange={(e) => setTriggerMaxKw(parseInt(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <button
                  type="submit"
                  disabled={triggerLoading || !triggerAssetId}
                  className="btn w-full h-10 font-bold justify-center text-sm"
                  style={{ background: triggerLoading ? undefined : "linear-gradient(135deg, #6c63ff 0%, #4f46e5 100%)" }}
                >
                  {triggerLoading ? "Dispatching..." : "🚀 Start Scan"}
                </button>
              </div>
            </form>

            {/* Trigger history */}
            {triggerHistory.length > 0 && (
              <div className="px-5 pb-4 flex flex-col gap-2">
                <p className="text-[10px] uppercase font-bold tracking-wider" style={{ color: "var(--text-muted)" }}>Recent Triggers</p>
                {triggerHistory.slice(0, 5).map((t) => (
                  <div key={t.id} className="flex items-center gap-3 text-xs p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)" }}>
                    {triggerStatusBadge(t.status)}
                    <span className="font-semibold">{t.assetName}</span>
                    <span style={{ color: "var(--text-muted)" }}>→</span>
                    <span className="text-indigo-300">{t.platforms.join(", ")}</span>
                    <span className="ml-auto text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {t.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─── Telegram Channels ─────────────────────────────── */}
          <div className="card p-0 overflow-hidden animate-fade-in" style={{ borderLeft: "3px solid #229ED9" }}>
            <div className="p-4 flex justify-between items-center" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <h2 className="font-semibold flex items-center gap-2 text-sm">
                <span>✈️</span> Telegram Monitored Channels
              </h2>
              <form onSubmit={handleAddChannel} className="flex gap-2">
                <input
                  type="text" placeholder="@channel"
                  value={newChannel} onChange={(e) => setNewChannel(e.target.value)}
                  disabled={adding}
                  className="px-3 py-1.5 rounded border border-transparent bg-black/20 text-sm focus:outline-none focus:border-indigo-500 min-w-[180px]"
                />
                <button type="submit" disabled={adding || !newChannel}
                  className="btn py-1.5 px-4 text-xs font-semibold"
                  style={{ background: "rgba(34,158,217,0.2)", color: "#229ED9" }}>
                  {adding ? "..." : "+ Add"}
                </button>
              </form>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                    <th className="p-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>CHANNEL</th>
                    <th className="p-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>SOURCE</th>
                    <th className="p-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>STATUS</th>
                    <th className="p-3 text-xs font-semibold text-right" style={{ color: "var(--text-muted)" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>No channels monitored. Add one or upload an asset to auto-discover.</td></tr>
                  )}
                  {channels.map((ch) => (
                    <tr key={ch.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td className="p-3 font-semibold">
                        <a href={`https://t.me/${ch.channel_username}`} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: "var(--text-primary)" }}>@{ch.channel_username} ↗</a>
                      </td>
                      <td className="p-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                        {ch.added_via_keyword === "manual_ui" ? <span style={{ color: "#229ED9" }}>Manual</span> : `kw: "${ch.added_via_keyword}"`}
                      </td>
                      <td className="p-3">
                        {ch.is_active
                          ? <span className="badge badge-success text-[10px] animate-pulse">● LIVE</span>
                          : <span className="badge text-[10px] text-gray-400 border border-gray-600">PAUSED</span>}
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleToggle(ch.id)} className="text-xs hover:underline"
                          style={{ color: ch.is_active ? "#f87171" : "var(--success)" }}>
                          {ch.is_active ? "Pause" : "Resume"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Event Stream ──────────────────────────────────── */}
          <div className="card p-0 overflow-hidden animate-fade-in">
            <div className="p-4 flex justify-between items-center" style={{ borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.15)" }}>
              <h2 className="font-semibold flex items-center gap-2 text-sm">
                <span>📡</span> Violation Event Stream
                {events.length > 0 && <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>({events.length} events)</span>}
              </h2>
              <div className="flex gap-2 items-center">
                <select
                  className="bg-black/30 border border-white/15 rounded p-1.5 text-xs outline-none focus:border-indigo-500"
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                >
                  <option value="all">All Platforms</option>
                  <option value="telegram">Telegram</option>
                  <option value="twitter">Twitter</option>
                  <option value="youtube">YouTube</option>
                  <option value="google">Google</option>
                </select>
                <button className="btn btn-outline text-xs h-8 px-3" onClick={() => loadData()}>
                  🔄 Refresh
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                    <th className="p-3 text-xs font-semibold" style={{ color: "var(--text-muted)", width: 64 }}>MEDIA</th>
                    <th className="p-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>PLATFORM</th>
                    <th className="p-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>SOURCE</th>
                    <th className="p-3 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>TIME</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length === 0 && (
                    <tr><td colSpan={4} className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                      No violation events yet. Upload an asset to auto-scan or trigger manually above.
                    </td></tr>
                  )}
                  {filteredEvents.map((evt) => {
                    const pKey = evt.platform === "web" ? "google" : evt.platform;
                    const meta = PLATFORM_META[pKey] || PLATFORM_META.google;
                    return (
                      <tr key={evt.id} style={{ borderBottom: "1px solid var(--border-color)" }} className="hover:bg-white/5 transition-colors">
                        <td className="p-3">
                          {evt.image_url ? (
                            <div
                              className="w-10 h-10 rounded bg-black/40 border border-white/10 overflow-hidden cursor-pointer hover:border-indigo-500 transition-colors"
                              onClick={() => setActiveMediaUrl(API_BASE.replace("/api", "") + evt.image_url)}
                            >
                              <img src={API_BASE.replace("/api", "") + evt.image_url} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded bg-black/40 border border-white/10 flex items-center justify-center text-[9px] text-gray-500">—</div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td className="p-3">
                          <a href={evt.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs font-mono truncate max-w-[280px] block hover:underline" style={{ color: "var(--accent-primary)" }}>
                            {evt.url}
                          </a>
                        </td>
                        <td className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                          {evt.timestamp ? new Date(evt.timestamp).toLocaleString() : "just now"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredEvents.length > 0 && filteredEvents.length % LIMIT === 0 && (
              <div className="p-3 flex justify-center border-t border-white/5" style={{ background: "var(--bg-secondary)" }}>
                <button className="btn btn-outline text-xs" onClick={loadMoreEvents} disabled={loadingMore}>
                  {loadingMore ? "Loading..." : "Load More"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Media Viewer ───────────────────────────────────── */}
      {activeMediaUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md" onClick={() => setActiveMediaUrl(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <button className="absolute -top-10 right-0 text-white hover:text-indigo-400 font-bold text-lg">✕ Close</button>
            <img src={activeMediaUrl} alt="expanded" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-white/10" />
          </div>
        </div>
      )}
    </div>
  );
}
