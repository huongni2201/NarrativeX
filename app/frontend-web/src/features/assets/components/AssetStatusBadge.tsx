import React from "react";
import type { AssetStatus } from "@/types/assets";
import { AlertTriangle, Check, CheckCircle2, Clock, Loader2, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetStatusBadgeProps { status: AssetStatus; progressPercent?: number; className?: string }

export const AssetStatusBadge: React.FC<AssetStatusBadgeProps> = ({ status, progressPercent, className }) => {
  const configs: Record<AssetStatus, { label: string; icon: React.ElementType; className: string }> = {
    APPROVED: { label: "APPROVED", icon: Check, className: "bg-emerald-950/80 text-emerald-300 border-emerald-700/60" },
    LOCKED: { label: "LOCKED", icon: Lock, className: "bg-blue-950/80 text-blue-300 border-blue-600/70" },
    NEEDS_REVIEW: { label: "NEEDS REVIEW", icon: Clock, className: "bg-amber-950/80 text-amber-300 border-amber-600/70" },
    GENERATED: { label: "GENERATED", icon: Sparkles, className: "bg-blue-950/80 text-blue-300 border-blue-700/60" },
    READY: { label: "READY", icon: Check, className: "bg-emerald-950/80 text-emerald-300 border-emerald-700/60" },
    PROCESSING: { label: progressPercent ? `${progressPercent}%` : "PROCESSING", icon: Loader2, className: "bg-purple-950/90 text-purple-300 border-purple-600" },
    UPLOADING: { label: "UPLOADING", icon: Loader2, className: "bg-purple-950/80 text-purple-300 border-purple-700/60" },
    FAILED: { label: "FAILED", icon: AlertTriangle, className: "bg-rose-950/90 text-rose-300 border-rose-700/80" },
    REJECTED: { label: "REJECTED", icon: AlertTriangle, className: "bg-rose-950/80 text-rose-300 border-rose-700/60" },
    COMPLETED: { label: "COMPLETED", icon: CheckCircle2, className: "bg-emerald-950/80 text-emerald-300 border-emerald-700/60" },
  };
  const item = configs[status];
  const Icon = item.icon;
  const moving = status === "PROCESSING" || status === "UPLOADING";
  return <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider", item.className, className)}><Icon className={cn("h-3 w-3", moving && "motion-safe:animate-spin")} /><span>{item.label}</span></span>;
};
