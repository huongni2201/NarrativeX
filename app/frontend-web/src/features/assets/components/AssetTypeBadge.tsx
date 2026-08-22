import React from "react";
import type { AssetType } from "@/types/assets";
import { Activity, Bookmark, Film, Image as ImageIcon, Video, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetTypeBadgeProps { type: AssetType; className?: string; showIcon?: boolean }

const config: Record<AssetType, { label: string; icon: React.ElementType; className: string }> = {
  IMAGE: { label: "IMAGE", icon: ImageIcon, className: "bg-slate-900/80 text-slate-300 border-slate-700/80" },
  VIDEO: { label: "VIDEO", icon: Video, className: "bg-blue-950/80 text-blue-300 border-blue-700/60" },
  AUDIO: { label: "AUDIO", icon: Volume2, className: "bg-orange-950/80 text-orange-300 border-orange-700/60" },
  REFERENCE: { label: "REFERENCE", icon: Bookmark, className: "bg-orange-950/80 text-orange-300 border-orange-700/60" },
  MOTION: { label: "MOTION", icon: Activity, className: "bg-cyan-950/80 text-cyan-300 border-cyan-700/60" },
  FINAL_OUTPUT: { label: "FINAL OUTPUT", icon: Film, className: "bg-emerald-950/80 text-emerald-300 border-emerald-700/60" },
};

export const AssetTypeBadge: React.FC<AssetTypeBadgeProps> = ({ type, className, showIcon = false }) => {
  const item = config[type];
  const Icon = item.icon;
  return <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider", item.className, className)}>{showIcon && <Icon className="h-3 w-3" />}<span>{item.label}</span></span>;
};
