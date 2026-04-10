import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "destructive" | "ghost" | "icon";
type ButtonSize = "default" | "sm" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "neu-btn-primary",
  secondary: "", // default neu-btn is secondary-like
  destructive: "neu-btn-danger",
  ghost: "neu-btn-ghost",
  icon: "w-8 h-8 p-0 justify-center rounded-lg",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-9 px-4 text-[12px] gap-2",
  sm: "h-7 px-3 text-[10px] gap-1.5",
  icon: "w-8 h-8 p-0 justify-center",
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
  return (
    <button
      className={`neu-btn ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
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
          className="w-1.5 h-1.5 rounded-full bg-current animate-pulse opacity-80"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </span>
  );
}
