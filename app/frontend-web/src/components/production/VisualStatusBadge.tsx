import React from "react";
import { VisualBeatStatus } from "@/types/domain";
import { Check, AlertCircle, X, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisualStatusBadgeProps {
  status: VisualBeatStatus;
  className?: string;
  size?: "sm" | "md";
}

export const VisualStatusBadge: React.FC<VisualStatusBadgeProps> = ({
  status,
  className,
  size = "md",
}) => {
  const isSm = size === "sm";

  switch (status) {
    case "APPROVED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-bold rounded uppercase tracking-wider text-emerald-400 bg-emerald-950/90 border border-emerald-500/50 shadow-[0_0_10px_rgba(34,197,94,0.35)]",
            isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
            className
          )}
        >
          <Check className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
          APPROVED
        </span>
      );
    case "NEEDS_REVIEW":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-bold rounded uppercase tracking-wider text-amber-400 bg-amber-950/90 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.35)]",
            isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
            className
          )}
        >
          <AlertCircle className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
          NEEDS REVIEW
        </span>
      );
    case "REJECTED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-bold rounded uppercase tracking-wider text-rose-400 bg-rose-950/90 border border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.35)]",
            isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
            className
          )}
        >
          <X className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
          REJECTED
        </span>
      );
    case "PROCESSING":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-bold rounded uppercase tracking-wider text-purple-300 bg-purple-950/90 border border-purple-500/50",
            isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
            className
          )}
        >
          <Loader2 className={cn("animate-spin", isSm ? "w-3 h-3" : "w-3.5 h-3.5")} />
          PROCESSING
        </span>
      );
    case "PENDING":
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-medium rounded uppercase tracking-wider text-slate-400 bg-slate-900/90 border border-slate-700/80",
            isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
            className
          )}
        >
          <Clock className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
          PENDING
        </span>
      );
  }
};
