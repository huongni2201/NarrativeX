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

  const colorStyles = {
    purple: "bg-primary",
    blue: "bg-blue-500",
    green: "bg-emerald-500",
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
          colorStyles[color],
          showGlow && "shadow-sm"
        )}
        style={{ width: `${clampedValue}%` }}
      />
    </div>
  );
};
