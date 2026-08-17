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
    surface: "bg-[#0d1420] border border-slate-800/80",
    "surface-2": "bg-[#111a29] border border-slate-800/80",
    glass: "bg-[#0d1420]/80 backdrop-blur-md border border-white/5",
    interactive:
      "bg-[#0d1420] border border-slate-800/80 hover:border-purple-500/50 hover:bg-[#111a29] transition-all duration-200 cursor-pointer",
  };

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden text-slate-100",
        variantStyles[variant],
        glowing && "shadow-[0_0_30px_rgba(124,58,237,0.25)] border-purple-500/50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
