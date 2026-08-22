import React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number; // 0 - 100
  className?: string;
  color?: "orange" | "blue" | "green";
  showGlow?: boolean;
}

export const Progress: React.FC<ProgressProps> = ({
  value,
  className,
  color = "orange",
  showGlow = true,
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const colorStyles = {
    orange: "bg-primary",
    blue: "bg-badge-blue",
    green: "bg-badge-green",
  };

  return (
    <div
      className={cn(
        "relative w-full h-1.5 bg-surface-dark rounded-full overflow-hidden border border-border-dark",
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
