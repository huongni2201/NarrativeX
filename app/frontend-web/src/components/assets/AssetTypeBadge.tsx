import React from "react";
import { AssetType } from "@/types/assets";
import { cn } from "@/lib/utils";
import {
  Image as ImageIcon,
  Video,
  Volume2,
  Bookmark,
  Activity,
  Film,
} from "lucide-react";

interface AssetTypeBadgeProps {
  type: AssetType;
  className?: string;
  showIcon?: boolean;
}

export const AssetTypeBadge: React.FC<AssetTypeBadgeProps> = ({
  type,
  className,
  showIcon = false,
}) => {
  const configs: Record<
    AssetType,
    { label: string; icon: React.ElementType; className: string }
  > = {
    IMAGE: {
      label: "IMAGE",
      icon: ImageIcon,
      className: "bg-slate-900/80 text-slate-300 border-slate-700/80",
    },
    VIDEO: {
      label: "VIDEO",
      icon: Video,
      className: "bg-blue-950/80 text-blue-300 border-blue-700/60",
    },
    AUDIO: {
      label: "AUDIO",
      icon: Volume2,
      className: "bg-purple-950/80 text-purple-300 border-purple-700/60",
    },
    REFERENCE: {
      label: "REFERENCE",
      icon: Bookmark,
      className: "bg-indigo-950/80 text-indigo-300 border-indigo-700/60",
    },
    MOTION: {
      label: "MOTION",
      icon: Activity,
      className: "bg-cyan-950/80 text-cyan-300 border-cyan-700/60",
    },
    FINAL_OUTPUT: {
      label: "FINAL OUTPUT",
      icon: Film,
      className: "bg-emerald-950/80 text-emerald-300 border-emerald-700/60",
    },
  };

  const config = configs[type] || configs.IMAGE;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border backdrop-blur-sm shadow-sm",
        config.className,
        className
      )}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      <span>{config.label}</span>
    </span>
  );
};
