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

  if (status === "APPROVED") return <span className={cn(base, spacing, "text-badge-green bg-badge-green-bg border border-badge-green-border", className)}><Check className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />APPROVED</span>;
  if (status === "NEEDS_REVIEW") return <span className={cn(base, spacing, "text-badge-amber bg-badge-amber-bg border border-badge-amber-border", className)}><AlertCircle className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />NEEDS REVIEW</span>;
  if (status === "REJECTED") return <span className={cn(base, spacing, "text-badge-red bg-badge-red-bg border border-badge-red-border", className)}><X className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />REJECTED</span>;
  if (status === "PROCESSING") return <span className={cn(base, spacing, "text-badge-blue bg-badge-blue-bg border border-badge-blue-border", className)}><Loader2 className={cn("motion-safe:animate-spin", isSm ? "w-3 h-3" : "w-3.5 h-3.5")} />PROCESSING</span>;
  return <span className={cn(base, isSm ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs", "text-badge-slate bg-badge-slate-bg border border-badge-slate-border", className)}><Clock className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />PENDING</span>;
};
