"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getMonitoredChannels,
  toggleMonitoredChannel,
  addMonitoredChannel,
  getMonitoringFeed,
  getPipelineStatus,
  triggerAssetScan,
  listAssets,
  getMonitoringImageUrl,
  type MonitoringEvent,
  type MonitoredChannel,
  type PipelineStatus,
  type Asset,
} from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

const LIMIT = 50;

// ─── Platform metadata ─────────────────────────────────────────────────────────
const PLATFORM_META: Record<string, { label: string; color: string }> = {
  telegram: { label: "Telegram",         color: "var(--neu-info)" },
  twitter:  { label: "Twitter / X",      color: "var(--neu-primary)" },
  youtube:  { label: "YouTube",          color: "var(--neu-danger)" },
  google:   { label: "Google",           color: "var(--neu-primary-lt)" },
  web:      { label: "Google",           color: "var(--neu-primary-lt)" },
};

function PlatformTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-5 py-2 text-[12px] font-bold uppercase tracking-wide rounded-[8px] transition-all duration-200
        ${active
          ? "neu-raised text-[var(--neu-primary)]"
          : "text-[var(--neu-text-muted)] hover:text-[var(--neu-text)] hover:shadow-[var(--neu-shadow-xs)]"
        }
      `}
    >
      {label}
    </button>
  );
}

// ─── Pipeline Status Cards ─────────────────────────────────────────────────────
function PipelineStatusRow({ status }: { status: PipelineStatus | null }) {
  const platforms = ["telegram", "twitter", "youtube", "google"] as const;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {platforms.map((key) => {
        const s = status?.[key];
        const meta = PLATFORM_META[key];
        const isActive = (s?.running ?? 0) > 0;

        return (
          <div key={key} className="neu-raised p-5 border-l-4" style={{ borderLeftColor: meta?.color ?? "var(--neu-surface-dk)" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-bold uppercase tracking-wide text-[var(--neu-text)]">{meta?.label}</p>
              {isActive && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: meta?.color }} />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: meta?.color }} />
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="neu-inset-sm p-2.5 rounded-lg text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--neu-text-faint)] mb-1">Running</p>
                <p className={`font-mono text-[16px] font-bold ${isActive ? "text-[var(--neu-primary)]" : "text-[var(--neu-text)]"}`}>{s?.running ?? 0}</p>
              </div>
              <div className="neu-inset-sm p-2.5 rounded-lg text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--neu-text-faint)] mb-1">Done</p>
                <p className="font-mono text-[16px] font-bold text-[var(--neu-text)]">{s?.completed ?? 0}</p>
              </div>
              <div className="neu-inset-sm p-2.5 rounded-lg text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--neu-text-faint)] mb-1">Violations</p>
                <p className={`font-mono text-[16px] font-bold ${(s?.total_violations ?? 0) > 0 ? "text-[var(--neu-danger)]" : "text-[var(--neu-text)]"}`}>{s?.total_violations ?? 0}</p>
              </div>
              <div className="neu-inset-sm p-2.5 rounded-lg text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--neu-text-faint)] mb-1">Failed</p>
                <p className="font-mono text-[16px] font-bold text-[var(--neu-text)]">{s?.failed ?? 0}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Trigger Panel ─────────────────────────────────────────────────────────────
function TriggerPanel({ assets }: { assets: Asset[] }) {
  const [assetId, setAssetId] = useState("");
  const [platform, setPlatform] = useState("all");
  const [maxKw, setMaxKw] = useState(10);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!assetId) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await triggerAssetScan(assetId, platform, maxKw);
      setMsg(`Scan queued for "${res.asset_name}" on ${res.platforms_queued.join(", ")}`);
      setAssetId("");
    } catch { setMsg("Failed to start scan."); }
    finally { setLoading(false); }
  }

  return (
    <div className="neu-raised overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-80">
        <h2 className="text-[15px] font-bold text-[var(--neu-text)] uppercase tracking-wide">Manual scan trigger</h2>
        <p className="text-[12px] font-sans font-bold text-[var(--neu-text-muted)] mt-1">Select an asset and dispatch background workers</p>
      </div>
      <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--neu-text-muted)] mb-2">Asset</label>
          <div className="relative">
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="neu-input appearance-none pr-8"
            >
              <option value="">— Select asset —</option>
              {assets.map((a) => (
               <option key={a.id} value={a.id}>{a.name} ({a.keywords?.length ?? 0} kw)</option>
              ))}
           </select>
           <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--neu-text-faint)]">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
               <polyline points="6 9 12 15 18 9" />
             </svg>
           </div>
         </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--neu-text-muted)] mb-2">Platform</label>
          <div className="relative">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="neu-input appearance-none pr-8"
            >
              <option value="all">All platforms</option>
              <option value="youtube">YouTube</option>
              <option value="google">Google Web</option>
              <option value="twitter">Twitter / X</option>
              <option value="telegram">Telegram</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--neu-text-faint)]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-[var(--neu-text-muted)]">Max keywords: <span className="font-mono text-[var(--neu-text)]">{maxKw}</span></label>
          <div className="neu-progress-track h-2 mb-3 mt-1">
             <input type="range" min={1} max={30} value={maxKw} onChange={(e) => setMaxKw(+e.target.value)} className="w-full absolute inset-0 opacity-0 cursor-pointer" />
             <div className="neu-progress-fill h-full rounded-full" style={{ width: `${(maxKw/30)*100}%` }} />
          </div>
        </div>
        <div className="md:col-span-4 flex justify-end mt-2">
          <Button variant="primary" type="submit" loading={loading} disabled={!assetId}>
            {!loading && (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Start scan
              </>
            )}
          </Button>
        </div>
      </form>
      {msg && (
        <div className="px-6 pb-5 pt-2">
          <div className="p-4 neu-inset-sm rounded-lg border-l-4 border-[var(--neu-info)]">
            <p className="text-[13px] font-bold text-[var(--neu-text)]">{msg}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Telegram Channels ─────────────────────────────────────────────────────────
function TelegramChannelsCard({ channels, onRefresh }: { channels: MonitoredChannel[]; onRefresh: () => void }) {
  const [newChannel, setNewChannel] = useState("");
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newChannel.trim()) return;
    setAdding(true);
    try {
      await addMonitoredChannel(newChannel.trim());
      setNewChannel("");
      onRefresh();
    } catch { alert("Failed to add channel"); }
    finally { setAdding(false); }
  }

  async function handleToggle(id: string) {
    try { await toggleMonitoredChannel(id); onRefresh(); } catch {}
  }

  return (
    <div className="neu-raised overflow-hidden border-l-4 border-[var(--neu-info)]">
      <div className="flex flex-wrap items-center justify-between px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-90 gap-4">
        <h2 className="text-[15px] font-bold text-[var(--neu-text)] uppercase tracking-wide">Telegram channels</h2>
        <form onSubmit={handleAdd} className="flex gap-3 w-full sm:w-auto">
          <input
            type="text"
            placeholder="@channel"
            value={newChannel}
            onChange={(e) => setNewChannel(e.target.value)}
            className="neu-input w-full sm:w-48"
          />
          <Button variant="secondary" type="submit" loading={adding} disabled={!newChannel}>
            {!adding && "Add"}
          </Button>
        </form>
      </div>
      {channels.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-[13px] font-bold text-[var(--neu-text-muted)] uppercase tracking-wide">No channels monitored. Add one above or upload an asset to auto-discover.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="neu-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Source</th>
                <th>Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id}>
                  <td>
                    <a href={`https://t.me/${ch.channel_username}`} target="_blank" rel="noopener noreferrer"
                      className="text-[13px] font-mono font-bold text-[var(--neu-primary)] hover:text-[var(--neu-primary-lt)] hover:underline">
                      @{ch.channel_username}
                    </a>
                  </td>
                  <td className="text-[12px] font-mono text-[var(--neu-text-muted)]">
                    {ch.added_via_keyword === "manual_ui" ? "Manual" : `kw: "${ch.added_via_keyword}"`}
                  </td>
                  <td>
                    <Badge variant={ch.is_active ? "verified" : "neutral"}>
                      {ch.is_active ? "Live" : "Paused"}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => handleToggle(ch.id)}
                      className={`text-[12px] font-bold uppercase tracking-wide transition-colors ${ch.is_active ? "text-[var(--neu-danger)] hover:text-[red]" : "text-[var(--neu-success)] hover:text-[#0f0]"}`}
                    >
                      {ch.is_active ? "Pause" : "Resume"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Event Feed ────────────────────────────────────────────────────────────────
function EventFeed({
  events,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onRefresh,
  filter,
  onFilterChange,
  autoRefresh,
  onAutoRefreshToggle,
}: {
  events: MonitoringEvent[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRefresh: () => void;
  filter: string;
  onFilterChange: (f: string) => void;
  autoRefresh: boolean;
  onAutoRefreshToggle: () => void;
}) {
  const platformFilters = ["all", "telegram", "twitter", "youtube", "google"];
  const [mediaViewer, setMediaViewer] = useState<string | null>(null);

  const filtered = filter === "all"
    ? events
    : events.filter((e) => {
        const p = e.platform === "web" ? "google" : e.platform;
        return p === filter;
      });

  return (
    <>
      <div className="neu-raised overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-90">
          <div className="flex items-center justify-between gap-5 flex-wrap">
            <div className="flex gap-2 neu-inset p-1.5 rounded-[12px] w-fit flex-wrap">
              {platformFilters.map((f) => (
                <PlatformTab
                  key={f}
                  label={f.charAt(0).toUpperCase() + f.slice(1)}
                  active={filter === f}
                  onClick={() => onFilterChange(f)}
                />
              ))}
            </div>
            
            <div className="flex items-center gap-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--neu-text-muted)]">Auto-refresh 30s</p>
              <button
                onClick={onAutoRefreshToggle}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 neu-inset border border-[var(--neu-surface-dk)]
                `}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-[var(--neu-primary)] neu-raised transition-transform duration-200 ${autoRefresh ? "translate-x-6 bg-[var(--neu-success)]" : "translate-x-1 opacity-50 bg-[var(--neu-text-faint)]"}`} />
              </button>
              <Button variant="secondary" size="sm" onClick={onRefresh}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
                </svg>
                Refresh
              </Button>
            </div>
          </div>

          <p className="text-[12px] font-mono text-[var(--neu-text-muted)] mt-5">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
            {filter !== "all" ? ` on ${filter}` : " across all platforms"}
          </p>
        </div>

        <div>
          {loading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-20 w-full" repeat={5} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-20 text-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-4 text-[var(--neu-text-faint)]">
                <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="3" x2="12" y2="8"/>
              </svg>
              <p className="text-[16px] font-bold text-[var(--neu-text)] uppercase tracking-wide">No activity detected</p>
              <p className="text-[13px] font-sans text-[var(--neu-text-muted)] mt-2">
                Monitoring is active across {Object.keys(PLATFORM_META).length} platforms
              </p>
            </div>
          ) : (
            filtered.map((evt) => {
              const pKey = evt.platform === "web" ? "google" : evt.platform;
              const meta = PLATFORM_META[pKey] || PLATFORM_META.google;
              const isNew = evt.status === "pending";

              return (
                <div
                  key={evt.id}
                  className="flex items-start gap-5 px-6 py-5 border-b border-[var(--neu-surface-dk)] hover:bg-[var(--neu-surface-lt)] transition-colors group"
                >
                  <div className={`w-1.5 self-stretch rounded-full shrink-0 ${isNew ? "bg-[var(--neu-primary)] neu-raised shadow-[0_0_8px_var(--neu-primary)]" : "bg-[var(--neu-surface-dk)] neu-inset"}`} />

                  {evt.image_url ? (
                    <div
                      className="w-10 h-10 neu-inset rounded-[10px] overflow-hidden shrink-0 cursor-pointer border border-transparent hover:border-[var(--neu-primary)] transition-colors"
                      onClick={() => setMediaViewer(getMonitoringImageUrl(evt.image_url!))}
                    >
                      <img src={getMonitoringImageUrl(evt.image_url)} alt="" className="w-full h-full object-cover opacity-90" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 neu-inset rounded-[10px] shrink-0 flex items-center justify-center text-[var(--neu-text-faint)]">
                      <span className="text-[12px] font-mono">—</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-[6px] neu-inset-sm"
                        style={{ color: meta.color }}
                      >
                        {meta.label}
                      </span>
                      <Badge variant={isNew ? "info" : "neutral"}>{isNew ? "New" : "Processed"}</Badge>
                    </div>
                    <a
                      href={evt.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-mono text-[var(--neu-primary)] hover:text-[var(--neu-primary-lt)] hover:underline truncate block"
                      title={evt.url}
                    >
                      {evt.url.length > 80 ? `${evt.url.slice(0, 80)}…` : evt.url}
                    </a>
                  </div>

                  <span
                    className="text-[11px] font-mono text-[var(--neu-text-muted)] shrink-0"
                    title={evt.timestamp ? new Date(evt.timestamp).toLocaleString() : ""}
                  >
                    {evt.timestamp ? new Date(evt.timestamp).toLocaleDateString() : "just now"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {hasMore && !loading && (
          <div className="px-6 py-4 flex justify-center">
            <Button variant="ghost" size="sm" loading={loadingMore} onClick={onLoadMore}>
              {!loadingMore && "Load more"}
            </Button>
          </div>
        )}
      </div>

      {mediaViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--neu-surface)]/90 backdrop-blur-sm" onClick={() => setMediaViewer(null)}>
          <div className="relative neu-raised p-2 rounded-[20px] max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="destructive"
              size="sm"
              className="absolute -top-12 right-0"
              onClick={() => setMediaViewer(null)}
            >
              Close
            </Button>
            <div className="neu-inset rounded-[16px] overflow-hidden">
              <img src={mediaViewer} alt="Expanded" className="max-w-full max-h-[85vh] object-contain" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Monitoring Page ───────────────────────────────────────────────────────────
export default function MonitoringPage() {
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [channels, setChannels] = useState<MonitoredChannel[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const prevRunningRef = useRef(0);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [chans, feed, status, assetList] = await Promise.all([
        getMonitoredChannels().catch(() => [] as MonitoredChannel[]),
        getMonitoringFeed(LIMIT, 0).catch(() => [] as MonitoringEvent[]),
        getPipelineStatus().catch(() => null),
        listAssets().catch(() => [] as Asset[]),
      ]);
      setChannels(chans);
      setEvents(feed);
      setPipelineStatus(status);
      setAssets(assetList);
      setOffset(LIMIT);
    } catch {} finally { setLoading(false); }
  }, []);

  async function refreshChannels() {
    const chans = await getMonitoredChannels().catch(() => [] as MonitoredChannel[]);
    setChannels(chans);
  }

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(async () => {
      const status = await getPipelineStatus().catch(() => null);
      if (!status) return;
      setPipelineStatus(status);

      const totalRunning = Object.values(status).reduce((s, v) => s + ((v as Record<string, number>).running ?? 0), 0);
      if (prevRunningRef.current > 0 && totalRunning === 0) {
        const feed = await getMonitoringFeed(LIMIT, 0).catch(() => [] as MonitoringEvent[]);
        setEvents(feed);
        setOffset(LIMIT);
      }
      prevRunningRef.current = totalRunning;
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const more = await getMonitoringFeed(LIMIT, offset);
      setEvents((prev) => [...prev, ...more]);
      setOffset(offset + LIMIT);
    } catch {} finally { setLoadingMore(false); }
  }

  const hasMore = events.length > 0 && events.length % LIMIT === 0;

  return (
    <>
      <PageHeader title="MONITORING" subtitle="Live discovery feed across all monitored platforms" />

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full space-y-8">
        <PipelineStatusRow status={pipelineStatus} />
        <TriggerPanel assets={assets} />
        <TelegramChannelsCard channels={channels} onRefresh={refreshChannels} />
        <EventFeed
          events={events}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onRefresh={loadAll}
          filter={platformFilter}
          onFilterChange={setPlatformFilter}
          autoRefresh={autoRefresh}
          onAutoRefreshToggle={() => setAutoRefresh((v) => !v)}
        />
      </div>
    </>
  );
}
