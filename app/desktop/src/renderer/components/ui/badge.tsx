import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends ComponentProps<"div"> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "bg-primary text-primary-foreground hover:bg-primary-hover",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
    outline: "border border-border text-foreground",
  }[variant];

  return (
    <div
      data-slot="badge"
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden",
        variantStyles,
        className
      )}
      {...props}
    />
  );
}
