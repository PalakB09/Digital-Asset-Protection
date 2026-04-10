type BadgeVariant = "verified" | "violation" | "pending" | "info" | "neutral";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  verified: "neu-badge-success",
  violation: "neu-badge-danger",
  pending: "neu-badge-warning",
  info: "neu-badge-info",
  neutral: "",
};

export function Badge({ variant, children, className = "" }: BadgeProps) {
  return (
    <span className={`neu-badge ${variantStyles[variant]} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 shrink-0" />
      {children}
    </span>
  );
}
