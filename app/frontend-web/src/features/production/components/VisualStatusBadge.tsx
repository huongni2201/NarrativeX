import React from "react";
import { VisualBeatStatus } from "@/types/domain";
import { Check, AlertCircle, X, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisualStatusBadgeProps {
  status: VisualBeatStatus;
  className?: string;
  size?: "sm" | "md";
}

export const VisualStatusBadge: React.FC<VisualStatusBadgeProps> = ({ status, className, size = "md" }) => {
  const isSm = size === "sm";
  const base = "inline-flex items-center gap-1 font-bold rounded uppercase tracking-wider";
  const spacing = isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  if (status === "APPROVED") return <span className={cn(base, spacing, "text-emerald-400 bg-emerald-950/90 border border-emerald-500/50", className)}><Check className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />APPROVED</span>;
  if (status === "NEEDS_REVIEW") return <span className={cn(base, spacing, "text-amber-400 bg-amber-950/90 border border-amber-500/50", className)}><AlertCircle className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />NEEDS REVIEW</span>;
  if (status === "REJECTED") return <span className={cn(base, spacing, "text-rose-400 bg-rose-950/90 border border-rose-500/50", className)}><X className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />REJECTED</span>;
  if (status === "PROCESSING") return <span className={cn(base, spacing, "text-purple-300 bg-purple-950/90 border border-purple-500/50", className)}><Loader2 className={cn("animate-spin", isSm ? "w-3 h-3" : "w-3.5 h-3.5")} />PROCESSING</span>;
  return <span className={cn(base, isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs", "text-slate-400 bg-slate-900/90 border border-slate-700/80", className)}><Clock className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />PENDING</span>;
};
