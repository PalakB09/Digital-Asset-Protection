"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BarChart3, 
  Search, 
  Layers, 
  Activity, 
  AlertTriangle, 
  Network, 
  Gavel, 
  TrendingUp,
  ShieldCheck
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: BarChart3 },
  { href: "/scan", label: "Scan", icon: Search },
  { href: "/assets", label: "Assets", icon: Layers },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/violations", label: "Violations", icon: AlertTriangle },
  { href: "/graph", label: "Propagation", icon: Network },
  { href: "/actions", label: "Actions", icon: Gavel },
  { href: "/insights", label: "Insights", icon: TrendingUp },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar flex flex-col">
      <div className="p-6 flex-1">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-600 text-white shadow-sm">
            <ShieldCheck size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-gray-900">MediaShield</h1>
            <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400">PRO PROTECTION</p>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link ${isActive ? "active" : ""}`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-6 mt-auto">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">System Live</p>
          </div>
          <p className="text-xs font-semibold text-slate-900">MediaShield v1.0</p>
        </div>
      </div>
    </aside>
  );
}
