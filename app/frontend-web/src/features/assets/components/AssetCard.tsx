import React from "react";
import Image from "next/image";
import type { MediaAsset } from "@/types/assets";
import { Download, Play, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetStatusBadge } from "./AssetStatusBadge";
import { AssetTypeBadge } from "./AssetTypeBadge";

interface AssetCardProps {
  asset: MediaAsset;
  isSelected?: boolean;
  onClick?: () => void;
  onDownload?: (event: React.MouseEvent) => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({ asset, isSelected = false, onClick, onDownload }) => (
  <article className={cn("group overflow-hidden rounded-xl border bg-[#0d1420] shadow-md transition-all", isSelected ? "border-purple-500 ring-2 ring-purple-500/50" : "border-slate-800/90 hover:border-slate-700")}>
    <button type="button" onClick={onClick} className="block w-full text-left">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-950">
        {asset.type === "AUDIO" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#090e18] text-purple-300"><Volume2 className="h-8 w-8" /><span className="text-xs">{asset.duration ?? "Audio"}</span></div>
        ) : (
          <Image
            src={asset.thumbnailUrl}
            alt={asset.filename}
            fill
            unoptimized
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform motion-safe:group-hover:scale-105"
          />
        )}
        <div className="absolute left-2 right-2 top-2 flex items-center justify-between"><AssetTypeBadge type={asset.type} /><AssetStatusBadge status={asset.status} progressPercent={asset.progressPercent} /></div>
        {(asset.type === "VIDEO" || asset.type === "FINAL_OUTPUT" || asset.type === "MOTION") && <Play className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-white" aria-hidden="true" />}
      </div>
      <div className="space-y-1 p-3"><p className="truncate font-mono text-xs font-bold text-slate-200">{asset.filename}</p><p className="truncate text-[11px] text-slate-400">{asset.projectTitle}</p></div>
    </button>
    <div className="flex items-center justify-between border-t border-slate-800/80 px-3 py-2 text-[10px] text-slate-500"><span>{asset.fileSize}</span><button type="button" aria-label={`Tải xuống ${asset.filename}`} onClick={(event) => { event.stopPropagation(); onDownload?.(event); }} className="rounded p-1 hover:bg-slate-800 hover:text-slate-200"><Download className="h-3 w-3" /></button></div>
  </article>
);
