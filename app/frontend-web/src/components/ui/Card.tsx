import React from "react";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "surface-2" | "glass" | "interactive";
  glowing?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  variant = "surface",
  glowing = false,
  ...props
}) => {
  const variantStyles = {
    surface: "bg-surface border border-border",
    "surface-2": "bg-surface-2 border border-border",
    glass: "bg-surface border border-border-subtle",
    interactive:
      "bg-surface border border-border hover:border-primary hover:bg-surface-2 transition-colors duration-200 cursor-pointer",
  };

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden text-slate-100",
        variantStyles[variant],
        glowing && "border-primary",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
