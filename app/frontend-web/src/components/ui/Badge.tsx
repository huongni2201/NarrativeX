import React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "success" | "warning" | "danger" | "neutral" | "locked" | "outline";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}) => {
  const variantStyles = {
    primary: "bg-purple-950/80 text-purple-300 border border-purple-800/60 shadow-[0_0_10px_rgba(124,58,237,0.15)]",
    success: "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60",
    warning: "bg-amber-950/80 text-amber-300 border border-amber-800/60",
    danger: "bg-rose-950/80 text-rose-300 border border-rose-800/60",
    neutral: "bg-slate-800/80 text-slate-300 border border-slate-700/60",
    locked: "bg-slate-900/90 text-slate-400 border border-slate-700/80 font-mono tracking-wider",
    outline: "bg-transparent text-slate-300 border border-slate-700/80",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs rounded-md font-medium",
    md: "px-2.5 py-1 text-xs rounded-md font-medium",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium transition-colors",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
