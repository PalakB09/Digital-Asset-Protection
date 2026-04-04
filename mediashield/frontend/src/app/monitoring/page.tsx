"use client";

import { useState, useEffect } from "react";

interface MonitoringEvent {
  id: string;
  platform: string;
  url: string;
  timestamp: string;
  status: "processed" | "pending";
}

const mockEvents: MonitoringEvent[] = [
  {
    id: "evt_1",
    platform: "twitter",
    url: "https://x.com/user/status/123456789",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    status: "processed",
  },
  {
    id: "evt_2",
    platform: "instagram",
    url: "https://www.instagram.com/p/C123456789/",
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    status: "processed",
  },
  {
    id: "evt_3",
    platform: "telegram",
    url: "https://t.me/movies_channel/452",
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    status: "pending",
  },
  {
    id: "evt_4",
    platform: "tiktok",
    url: "https://www.tiktok.com/@user/video/987654321",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: "pending",
  },
  {
    id: "evt_5",
    platform: "reddit",
    url: "https://reddit.com/r/leaks/comments/xyz123/",
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    status: "processed",
  },
];

export default function MonitoringPage() {
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate network request
    const timer = setTimeout(() => {
      setEvents(mockEvents);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Monitoring</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Near real-time feed of ingested media events from monitored platforms
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden animate-fade-in">
          <div className="p-5" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="text-xl">📡</span> Event Stream
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
              Data is automatically sourced by discovery workers and webhooks.
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                  <th className="p-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>PLATFORM</th>
                  <th className="p-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>POST URL</th>
                  <th className="p-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>TIMESTAMP</th>
                  <th className="p-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => (
                  <tr key={evt.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td className="p-4">
                      <span className="capitalize font-medium text-sm">{evt.platform}</span>
                    </td>
                    <td className="p-4">
                      <a href={evt.url} target="_blank" rel="noopener noreferrer" className="text-sm font-mono truncate max-w-xs block hover:underline" style={{ color: "var(--accent-primary)" }}>
                        {evt.url}
                      </a>
                    </td>
                    <td className="p-4 text-sm" style={{ color: "var(--text-secondary)" }}>
                      {new Date(evt.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4">
                      {evt.status === "processed" ? (
                        <span className="badge badge-success text-[10px]">PROCESSED</span>
                      ) : (
                        <span className="badge text-[10px]" style={{
                          background: "transparent",
                          color: "#f59e0b",
                          border: "1px solid #f59e0b"
                        }}>
                          PENDING Queue
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 flex justify-center" style={{ background: "var(--bg-secondary)" }}>
            <button className="btn btn-outline text-xs" disabled>
              Load More Events
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
