import React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number; // 0 - 100
  className?: string;
  color?: "purple" | "blue" | "green";
  showGlow?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  className,
  color = "purple",
  showGlow = true,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const colorGradients = {
    purple: "bg-gradient-to-r from-indigo-500 via-purple-500 to-purple-400",
    blue: "bg-gradient-to-r from-cyan-500 to-blue-500",
    green: "bg-gradient-to-r from-emerald-500 to-teal-400",
  };

  return (
    <div
      className={cn(
        "relative w-full h-1.5 bg-slate-900/90 rounded-full overflow-hidden border border-slate-800/60",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out relative",
          colorGradients[color],
          showGlow && "shadow-[0_0_12px_rgba(124,58,237,0.7)]"
        )}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
};
