import React from "react";
import { AssetStatus } from "@/types/assets";
import { cn } from "@/lib/utils";
import {
  Check,
  Clock,
  Lock,
  AlertTriangle,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

interface AssetStatusBadgeProps {
  status: AssetStatus;
  progressPercent?: number;
  className?: string;
}

export const AssetStatusBadge: React.FC<AssetStatusBadgeProps> = ({
  status,
  progressPercent,
  className,
}) => {
  const configs: Record<
    AssetStatus,
    { label: string; icon: React.ElementType; className: string }
  > = {
    APPROVED: {
      label: "APPROVED",
      icon: Check,
      className: "bg-emerald-950/80 text-emerald-300 border-emerald-700/60 shadow-[0_0_8px_rgba(34,197,94,0.2)]",
    },
    LOCKED: {
      label: "LOCKED",
      icon: Lock,
      className: "bg-blue-950/80 text-blue-300 border-blue-600/70 shadow-[0_0_8px_rgba(59,130,246,0.25)]",
    },
    NEEDS_REVIEW: {
      label: "NEEDS REVIEW",
      icon: Clock,
      className: "bg-amber-950/80 text-amber-300 border-amber-600/70 shadow-[0_0_8px_rgba(245,158,11,0.25)]",
    },
    GENERATED: {
      label: "GENERATED",
      icon: Sparkles,
      className: "bg-blue-950/80 text-blue-300 border-blue-700/60",
    },
    READY: {
      label: "READY",
      icon: Check,
      className: "bg-emerald-950/80 text-emerald-300 border-emerald-700/60",
    },
    PROCESSING: {
      label: progressPercent ? `${progressPercent}%` : "PROCESSING",
      icon: Loader2,
      className: "bg-purple-950/90 text-purple-300 border-purple-600 shadow-[0_0_12px_rgba(124,58,237,0.3)] animate-pulse",
    },
    UPLOADING: {
      label: "UPLOADING",
      icon: Loader2,
      className: "bg-purple-950/80 text-purple-300 border-purple-700/60",
    },
    FAILED: {
      label: "FAILED",
      icon: AlertTriangle,
      className: "bg-rose-950/90 text-rose-300 border-rose-700/80 shadow-[0_0_8px_rgba(244,63,94,0.3)]",
    },
    REJECTED: {
      label: "REJECTED",
      icon: AlertTriangle,
      className: "bg-rose-950/80 text-rose-300 border-rose-700/60",
    },
    COMPLETED: {
      label: "COMPLETED",
      icon: CheckCircle2,
      className: "bg-emerald-950/80 text-emerald-300 border-emerald-700/60 shadow-[0_0_8px_rgba(34,197,94,0.2)]",
    },
  };

  const config = configs[status] || configs.APPROVED;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider border backdrop-blur-md shadow-sm",
        config.className,
        className
      )}
    >
      <Icon
        className={cn(
          "w-3 h-3",
          (status === "PROCESSING" || status === "UPLOADING") && "animate-spin"
        )}
      />
      <span>{config.label}</span>
    </span>
  );
};
