"use client";

import { useState, useEffect } from "react";
import { getMonitoredChannels, toggleMonitoredChannel, addMonitoredChannel, type MonitoredChannel } from "@/lib/api";

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
  const [channels, setChannels] = useState<MonitoredChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [newChannel, setNewChannel] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      setEvents(mockEvents); // keep mock events for generic feed
      const chans = await getMonitoredChannels();
      setChannels(chans);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
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
    } catch(e) {
      alert("Failed to add channel");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(id: string) {
    try {
      await toggleMonitoredChannel(id);
      const chans = await getMonitoredChannels();
      setChannels(chans);
    } catch(e) {
      console.error(e);
    }
  }

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
        <div className="flex flex-col gap-8">
          
          {/* Telegram Real-Time Targets */}
          <div className="card p-0 overflow-hidden animate-fade-in shadow-lg" style={{ border: "1px solid rgba(108, 99, 255, 0.3)" }}>
            <div className="p-5 flex justify-between items-center" style={{ background: "rgba(108, 99, 255, 0.05)", borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="text-xl">✈️</span> Telegram Real-Time Targets
                </h2>
                <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
                  Channels actively piped into background workers for real-time memory scanning.
                </p>
              </div>
              <form onSubmit={handleAddChannel} className="flex gap-2">
                <input
                  type="text"
                  placeholder="@channel_username"
                  value={newChannel}
                  onChange={(e) => setNewChannel(e.target.value)}
                  disabled={adding}
                  className="px-3 py-1.5 rounded border border-transparent bg-black/20 text-sm focus:outline-none focus:border-indigo-500 min-w-[200px]"
                />
                <button type="submit" disabled={adding || !newChannel} className="btn py-1.5 px-4 text-xs font-semibold" style={{ background: "rgba(108, 99, 255, 0.2)", color: "var(--accent-primary)"}}>
                  {adding ? "Adding..." : "+ Monitor"}
                </button>
              </form>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                    <th className="p-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>USERNAME</th>
                    <th className="p-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>DISCOVERY SOURCE</th>
                    <th className="p-4 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>STATUS</th>
                    <th className="p-4 text-xs font-semibold text-right" style={{ color: "var(--text-muted)" }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {channels.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                        No channels are actively monitored in real time. Add one or wait for discovery workers.
                      </td>
                    </tr>
                  )}
                  {channels.map((chan) => (
                    <tr key={chan.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td className="p-4 font-semibold text-sm">
                        <a href={`https://t.me/${chan.channel_username}`} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1" style={{ color: "var(--text-primary)" }}>
                          @{chan.channel_username} ↗
                        </a>
                      </td>
                      <td className="p-4 text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                        {chan.added_via_keyword === "manual_ui" ? (
                          <span style={{ color: "var(--accent-secondary)" }}>Manual Entry</span>
                        ) : (
                          `Keyword: "${chan.added_via_keyword}"`
                        )}
                      </td>
                      <td className="p-4">
                        {chan.is_active ? (
                          <span className="badge badge-success text-[10px] animate-pulse">● LISTENING</span>
                        ) : (
                          <span className="badge text-[10px]" style={{ background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                            PAUSED
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleToggle(chan.id)}
                          className="text-xs hover:underline"
                          style={{ color: chan.is_active ? "#f87171" : "var(--success)" }}
                        >
                          {chan.is_active ? "Pause" : "Resume"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Event Stream */}
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
        </div>
      )}
    </div>
  );
}
