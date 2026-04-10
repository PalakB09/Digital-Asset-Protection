import { Skeleton } from "./Skeleton";

interface MetricCardProps {
  label: string;
  value: number | string;
  accentColor: "blue" | "red" | "green" | "amber";
  trend?: { direction: "up" | "down" | "neutral"; label: string; };
  loading?: boolean;
}

const accentColors: Record<MetricCardProps["accentColor"], string> = {
  blue:  "var(--neu-primary)",
  red:   "var(--neu-danger)",
  green: "var(--neu-success)",
  amber: "var(--neu-warning)",
};

const trendColors = {
  up:      "var(--neu-success)",
  down:    "var(--neu-danger)",
  neutral: "var(--neu-text-faint)",
};

export function MetricCard({ label, value, accentColor, trend, loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className="neu-raised p-5 space-y-3 animate-pulse border-l-4 border-[var(--neu-surface-dk)]">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
    );
  }

  return (
    <div
      className="neu-raised p-5 transition-shadow duration-200 hover:shadow-[var(--neu-shadow-lg)]"
      style={{ borderLeft: `6px solid ${accentColors[accentColor]}` }}
    >
      <p className="font-mono text-[11px] font-bold text-[var(--neu-text-muted)] uppercase tracking-widest mb-3">
        {label}
      </p>
      <p className="font-sans text-[26px] font-bold text-[var(--neu-text)] leading-none select-none">
        {value}
      </p>
      {trend && (
        <p
          className="text-[11px] font-bold uppercase tracking-wide mt-3 flex items-center gap-1"
          style={{ color: trendColors[trend.direction] }}
        >
          <span>{trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}</span>
          {trend.label}
        </p>
      )}
    </div>
  );
}
