type BadgeVariant = "verified" | "violation" | "pending" | "info" | "neutral" | "accent";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  verified: "eg-badge-success",
  violation: "eg-badge-danger",
  pending:   "eg-badge-warning",
  info:      "eg-badge-accent",
  neutral:   "eg-badge-neutral",
  accent:    "eg-badge-accent",
};

const dotColors: Record<BadgeVariant, string> = {
  verified:  "var(--success)",
  violation: "var(--danger)",
  pending:   "var(--warning)",
  info:      "var(--accent-primary)",
  neutral:   "var(--text-muted)",
  accent:    "var(--accent-primary)",
};

export function Badge({ variant, children, className = "" }: BadgeProps) {
  return (
    <span className={`eg-badge ${variantStyles[variant]} ${className}`}>
      <span
        className="shrink-0 rounded-full"
        style={{ width: 5, height: 5, background: dotColors[variant] }}
      />
      {children}
    </span>
  );
}
