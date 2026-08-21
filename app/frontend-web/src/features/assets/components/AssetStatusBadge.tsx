import React from "react";
import type { AssetStatus } from "@/types/assets";
import { AlertTriangle, Check, CheckCircle2, Clock, Loader2, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetStatusBadgeProps { status: AssetStatus; progressPercent?: number; className?: string }

export const AssetStatusBadge: React.FC<AssetStatusBadgeProps> = ({ status, progressPercent, className }) => {
  const configs: Record<AssetStatus, { label: string; icon: React.ElementType; className: string }> = {
    APPROVED: { label: "APPROVED", icon: Check, className: "bg-badge-green-bg text-badge-green border-badge-green-border" },
    LOCKED: { label: "LOCKED", icon: Lock, className: "bg-badge-blue-bg text-badge-blue border-badge-blue-border" },
    NEEDS_REVIEW: { label: "NEEDS REVIEW", icon: Clock, className: "bg-badge-amber-bg text-badge-amber border-badge-amber-border" },
    GENERATED: { label: "GENERATED", icon: Sparkles, className: "bg-badge-blue-bg text-badge-blue border-badge-blue-border" },
    READY: { label: "READY", icon: Check, className: "bg-badge-green-bg text-badge-green border-badge-green-border" },
    PROCESSING: { label: progressPercent ? `${progressPercent}%` : "PROCESSING", icon: Loader2, className: "bg-badge-blue-bg text-badge-blue border-badge-blue-border" },
    UPLOADING: { label: "UPLOADING", icon: Loader2, className: "bg-badge-blue-bg text-badge-blue border-badge-blue-border" },
    FAILED: { label: "FAILED", icon: AlertTriangle, className: "bg-badge-red-bg text-badge-red border-badge-red-border" },
    REJECTED: { label: "REJECTED", icon: AlertTriangle, className: "bg-badge-red-bg text-badge-red border-badge-red-border" },
    COMPLETED: { label: "COMPLETED", icon: CheckCircle2, className: "bg-badge-green-bg text-badge-green border-badge-green-border" },
  };
  const item = configs[status];
  const Icon = item.icon;
  const moving = status === "PROCESSING" || status === "UPLOADING";
  return <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider", item.className, className)}><Icon className={cn("h-3 w-3", moving && "motion-safe:animate-spin")} /><span>{item.label}</span></span>;
};
