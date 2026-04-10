"use client";

import { useState, useEffect } from "react";
import { listViolations, generateDMCA, getDMCADownloadUrl, type Violation } from "@/lib/api";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

// ─── Mock Job Queue Data ───────────────────────────────────────────────────────
interface JobEntry {
  id: string;
  type: string;
  status: "pending" | "running" | "completed" | "failed";
  asset: string;
  started: string;
  duration: string;
}

const MOCK_JOBS: JobEntry[] = [
  { id: "job_8af3c2e1", type: "Platform Scan",          status: "running",   asset: "IPL 2026 Promo.jpg",    started: "2 min ago",  duration: "—"     },
  { id: "job_1be9d74f", type: "CLIP Embedding",          status: "completed", asset: "Episode 3 Clip.mp4",    started: "14 min ago", duration: "32s"   },
  { id: "job_2ca5f08d", type: "Twitter Scrape",          status: "completed", asset: "Grand Finale.jpg",      started: "28 min ago", duration: "1m 14s" },
  { id: "job_4df6a13b", type: "Fingerprint Generation",  status: "failed",    asset: "Hero Promo.png",        started: "1h ago",     duration: "5s"    },
  { id: "job_6ee2b990", type: "Platform Scan",           status: "pending",   asset: "Behind Scenes.mp4",     started: "Queued",     duration: "—"     },
];

// ─── Platform Connection Data ──────────────────────────────────────────────────
interface PlatformConn {
  id: string;
  label: string;
  connected: boolean;
}

const PLATFORM_CONNECTIONS: PlatformConn[] = [
  { id: "twitter",  label: "Twitter / X",   connected: true  },
  { id: "youtube",  label: "YouTube",        connected: true  },
  { id: "telegram", label: "Telegram",       connected: true  },
  { id: "google",   label: "Google Search",  connected: true  },
  { id: "instagram",label: "Instagram",      connected: false },
  { id: "tiktok",   label: "TikTok",         connected: false },
];

// ─── Job Status Badge ──────────────────────────────────────────────────────────
function JobBadge({ status }: { status: JobEntry["status"] }) {
  const map: Record<JobEntry["status"], { variant: "pending" | "info" | "verified" | "violation"; label: string }> = {
    pending:   { variant: "pending",   label: "Pending"   },
    running:   { variant: "info",      label: "Running"   },
    completed: { variant: "verified",  label: "Completed" },
    failed:    { variant: "violation", label: "Failed"    },
  };
  const { variant, label } = map[status];
  return (
    <span className={status === "running" ? "inline-flex items-center gap-2" : ""}>
      <Badge variant={variant}>{label}</Badge>
      {status === "running" && (
        <span className="flex gap-1.5 opacity-80">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-[var(--neu-info)] neu-raised shadow-[0_0_5px_var(--neu-info)] animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </span>
      )}
    </span>
  );
}

// ─── Bulk Operations Section ───────────────────────────────────────────────────
function BulkOpsSection({ violations }: { violations: Violation[] }) {
  const [processing, setProcessing] = useState<string | null>(null);

  async function handleBulkGenerateDMCA() {
    if (violations.length === 0) return;
    setProcessing("dmca");
    try {
      const v = violations[0];
      await generateDMCA(v.id);
      window.open(getDMCADownloadUrl(v.id), "_blank");
    } catch { alert("DMCA generation failed."); }
    finally { setProcessing(null); }
  }

  const bulkActions = [
    {
      id: "scan",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
        </svg>
      ),
      label: "Bulk Scan All Assets",
      desc:  "Queue a full scan sweep across all platforms for every registered asset.",
      action: async () => {
        setProcessing("scan");
        await new Promise((r) => setTimeout(r, 1200));
        setProcessing(null);
      },
    },
    {
      id: "fingerprint",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
      label: "Regenerate All Fingerprints",
      desc:  "Re-compute pHash and CLIP embeddings for all assets using the latest models.",
      action: async () => {
        setProcessing("fingerprint");
        await new Promise((r) => setTimeout(r, 1200));
        setProcessing(null);
      },
    },
    {
      id: "export",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      ),
      label: "Export Violation Report",
      desc:  "Download a formatted PDF with all known violations, confidence scores, and sources.",
      action: handleBulkGenerateDMCA,
    },
  ];

  return (
    <div className="neu-raised overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-90">
        <h2 className="text-[15px] font-bold text-[var(--neu-text)] uppercase tracking-wide">Bulk Operations</h2>
      </div>
      <div>
        {bulkActions.map((action, i) => (
          <div
            key={action.id}
            className={`flex items-start gap-5 px-6 py-5 ${i < bulkActions.length - 1 ? "border-b border-[var(--neu-surface-dk)]" : ""}`}
          >
            <div className="w-10 h-10 rounded-[10px] neu-inset flex items-center justify-center shrink-0 text-[var(--neu-primary)]">
              {action.icon}
            </div>
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[14px] font-bold text-[var(--neu-text)] mb-1">{action.label}</p>
              <p className="text-[13px] font-sans text-[var(--neu-text-muted)] leading-relaxed">{action.desc}</p>
            </div>
            <Button
              variant="secondary"
              loading={processing === action.id}
              onClick={action.action}
            >
              {processing !== action.id && "Run task"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Job Queue Section ─────────────────────────────────────────────────────────
function JobQueueSection() {
  return (
    <div className="neu-raised overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-90">
        <h2 className="text-[15px] font-bold text-[var(--neu-text)] uppercase tracking-wide">Background Job Queue</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="neu-table">
          <thead>
            <tr>
              <th>Job ID</th>
              <th>Task Type</th>
              <th>Status</th>
              <th>Target Asset</th>
              <th>Started</th>
              <th className="text-right">Duration</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_JOBS.map((job) => (
              <tr key={job.id}>
                <td className="text-[12px] font-mono text-[var(--neu-text-muted)]">{job.id}</td>
                <td className="text-[13px] font-bold text-[var(--neu-text)] uppercase tracking-wide">{job.type}</td>
                <td><JobBadge status={job.status} /></td>
                <td className="text-[13px] font-sans text-[var(--neu-text)] truncate max-w-[160px]" title={job.asset}>{job.asset}</td>
                <td className="text-[12px] font-mono text-[var(--neu-text-muted)]">{job.started}</td>
                <td className="text-right text-[12px] font-mono text-[var(--neu-text-muted)]">{job.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Platform Connections Section ──────────────────────────────────────────────
function PlatformConnectionsSection() {
  const icons: Record<string, JSX.Element> = {
    twitter: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m4 4 16 16m0-16L4 20"/>
      </svg>
    ),
    youtube: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-1.96C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 1.96A29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.54C5.12 20 12 20 12 20s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
        <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
      </svg>
    ),
    telegram: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    ),
    google: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
      </svg>
    ),
    instagram: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
      </svg>
    ),
    tiktok: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>
      </svg>
    ),
  };

  return (
    <div className="neu-raised overflow-hidden">
      <div className="px-6 py-5 border-b border-[var(--neu-surface-dk)] opacity-90">
        <h2 className="text-[15px] font-bold text-[var(--neu-text)] uppercase tracking-wide">Platform Integrations</h2>
      </div>
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PLATFORM_CONNECTIONS.map((p) => (
          <div key={p.id} className="flex flex-col gap-4 p-5 neu-inset-sm rounded-[16px] group hover:bg-[var(--neu-surface-lt)] transition-colors">
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 rounded-[12px] neu-raised flex items-center justify-center shrink-0 ${p.connected ? "text-[var(--neu-primary)] shadow-[var(--neu-shadow-primary)] opacity-100" : "text-[var(--neu-text-faint)] opacity-60"}`}>
                {icons[p.id] ?? null}
              </div>
              <Badge variant={p.connected ? "verified" : "neutral"}>
                {p.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            
            <div className="flex items-end justify-between mt-2">
              <div>
                <p className="text-[14px] font-bold text-[var(--neu-text)]">{p.label}</p>
                <p className="text-[11px] font-mono text-[var(--neu-text-muted)] mt-1">{p.connected ? "Active sync" : "Requires config"}</p>
              </div>
              <Button variant="ghost" size="sm">Config</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Danger Zone Section ───────────────────────────────────────────────────────
function DangerZoneSection() {
  const dangerItems = [
    {
      id: "clear-history",
      label: "Clear All Scan History",
      desc:  "Removes all recorded scan events and job history permanently.",
    },
    {
      id: "reset-monitoring",
      label: "Reset Monitoring",
      desc:  "Stops all active monitoring feeds and clears configured channels.",
    },
  ];

  return (
    <div className="neu-raised p-6 border-l-4 border-l-[var(--neu-danger)]">
      <p className="text-[12px] font-bold text-[var(--neu-danger)] uppercase tracking-widest mb-5">Danger Zone</p>
      <div className="space-y-6">
        {dangerItems.map((item, i) => (
          <div key={item.id} className={`flex items-start gap-4 ${i < dangerItems.length - 1 ? "pb-6 border-b border-[var(--neu-surface-dk)] opacity-90" : ""}`}>
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[14px] font-bold text-[var(--neu-text)]">{item.label}</p>
              <p className="text-[13px] font-sans text-[var(--neu-text-muted)] mt-1 leading-relaxed">{item.desc}</p>
            </div>
            <Button
              variant="destructive"
              onClick={() => {
                if (window.confirm(`Confirm: ${item.label}? This cannot be undone.`)) {
                  alert(`${item.label} — simulated (mock).`);
                }
              }}
            >
              {item.label.split(" ").slice(0, 1).join(" ")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Action Center Page ────────────────────────────────────────────────────────
export default function ActionsPage() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listViolations()
      .then((v) => setViolations(v.sort((a, b) => b.confidence - a.confidence)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="SYSTEM ACTIONS" subtitle="Bulk operations, job queue management, and platform connections" />

      <div className="flex-1 px-8 py-8 max-w-[1200px] mx-auto w-full space-y-8">
        <div>
          <BulkOpsSection violations={violations} />
        </div>

        <div>
          {loading ? (
            <div className="neu-raised p-6 space-y-4">
              <Skeleton className="h-12 w-full" repeat={5} />
            </div>
          ) : (
            <JobQueueSection />
          )}
        </div>

        <div>
          <PlatformConnectionsSection />
        </div>

        <div>
          <DangerZoneSection />
        </div>
      </div>
    </>
  );
}
