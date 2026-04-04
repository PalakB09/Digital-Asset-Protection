"use client";

import { useState, useEffect } from "react";

interface InsightData {
  topLeakedAsset: string;
  topLeakedAssetCount: number;
  mostActivePlatform: string;
  mostActivePlatformCount: number;
  fastestSpreading: string;
  fastestSpreadingRate: number; // e.g., violations per hour
  totalAlerts: number;
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock analytics data fetch
    const timer = setTimeout(() => {
      setData({
        topLeakedAsset: "Official IPL 2026 Promo",
        topLeakedAssetCount: 142,
        mostActivePlatform: "Telegram",
        mostActivePlatformCount: 89,
        fastestSpreading: "Episode 3 Leaked Clip",
        fastestSpreadingRate: 15,
        totalAlerts: 342,
      });
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Insights & Analytics</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          High-level reporting on threat vectors and asset propagation
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" style={{ width: 40, height: 40 }}></div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Card 1 */}
            <div className="card p-6" style={{ borderTop: "4px solid var(--danger)" }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🔥</span>
                <h3 className="text-sm font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Top Leaked Asset</h3>
              </div>
              <p className="text-xl font-bold mb-1 truncate">{data?.topLeakedAsset}</p>
              <p className="text-sm font-mono" style={{ color: "var(--danger)" }}>
                {data?.topLeakedAssetCount} detected violations
              </p>
            </div>

            {/* Card 2 */}
            <div className="card p-6" style={{ borderTop: "4px solid #3b82f6" }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🌐</span>
                <h3 className="text-sm font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Most Active Platform</h3>
              </div>
              <p className="text-xl font-bold mb-1 capitalize">{data?.mostActivePlatform}</p>
              <p className="text-sm font-mono" style={{ color: "#3b82f6" }}>
                {data?.mostActivePlatformCount} recent incidents
              </p>
            </div>

            {/* Card 3 */}
            <div className="card p-6" style={{ borderTop: "4px solid #f59e0b" }}>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🚀</span>
                <h3 className="text-sm font-semibold uppercase" style={{ color: "var(--text-muted)" }}>Fastest Spreading</h3>
              </div>
              <p className="text-xl font-bold mb-1 truncate">{data?.fastestSpreading}</p>
              <p className="text-sm font-mono" style={{ color: "#f59e0b" }}>
                +{data?.fastestSpreadingRate} / hour
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <span className="text-xl">📈</span> Incidents Over Time
              </h3>
              <div className="h-64 w-full flex items-end justify-between gap-2 border-b border-gray-700/50 pb-4">
                {/* Mock Bar Chart */}
                {[12, 18, 5, 25, 42, 38, 55].map((val, idx) => (
                  <div key={idx} className="w-full bg-gradient-to-t from-indigo-500/20 to-indigo-500 rounded-t-sm transition-all" style={{ height: `${val}%`, minHeight: '10%' }}></div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <span className="text-xl">📊</span> Platform Breakdown
              </h3>
              <div className="space-y-4">
                {/* Mock Progress Bars */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">Telegram</span>
                    <span className="font-mono">45%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: "45%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">Twitter / X</span>
                    <span className="font-mono">30%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-sky-400 h-2 rounded-full" style={{ width: "30%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">Instagram</span>
                    <span className="font-mono">15%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-pink-500 h-2 rounded-full" style={{ width: "15%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize">Pirate Sites</span>
                    <span className="font-mono">10%</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: "10%" }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
