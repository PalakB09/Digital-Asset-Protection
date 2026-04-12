import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost" | "icon" | "accent";
type ButtonSize = "default" | "sm" | "icon" | "icon-sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:     "eg-btn-primary",
  secondary:   "eg-btn-secondary",
  destructive: "eg-btn-danger",
  ghost:       "eg-btn-ghost",
  icon:        "eg-btn-icon",
  accent:      "eg-btn-accent",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "",
  sm:      "eg-btn-sm",
  icon:    "eg-btn-icon",
  "icon-sm": "eg-btn-icon-sm",
};

export function Button({
  variant = "secondary",
  size = "default",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const isIconOnly = variant === "icon" || size === "icon" || size === "icon-sm";
  return (
    <button
      className={`eg-btn ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoadingDots /> : children}
    </button>
  );
}

function LoadingDots() {
  return (
    <span className="flex items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="rounded-full bg-current animate-pulse"
          style={{ width: 4, height: 4, opacity: 0.8, animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
