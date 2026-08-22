/* eslint-disable @next/next/no-img-element -- Asset URLs may use environment-specific Cloudflare R2/CDN hosts. */
import React from "react";
import type { MediaAsset } from "@/types/assets";
import { Download, Image as ImageIcon, Play, Volume2 } from "lucide-react";
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
  <article className={cn("group overflow-hidden rounded-xl border bg-surface shadow-md transition-colors", isSelected ? "border-orange-500 ring-2 ring-orange-500/50" : "border-slate-800/90 hover:border-slate-700")}>
    <button type="button" onClick={onClick} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-950">
        {asset.type === "AUDIO" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 bg-surface-panel text-orange-300"><Volume2 className="h-8 w-8" /><span className="text-xs">{asset.duration ?? "Audio"}</span></div>
        ) : asset.thumbnailUrl ? (
          // Backend media may come from environment-specific Cloudflare R2/CDN hosts. Keep native image loading until the storage contract exposes a stable trusted hostname for next/image remotePatterns.
          <img
            src={asset.thumbnailUrl}
            alt={asset.filename}
            width={320}
            height={200}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform motion-safe:group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-surface-panel text-text-muted"><ImageIcon className="h-8 w-8" aria-hidden="true" /><span className="sr-only">Chưa có thumbnail</span></div>
        )}
        <div className="absolute left-2 right-2 top-2 flex items-center justify-between"><AssetTypeBadge type={asset.type} /><AssetStatusBadge status={asset.status} progressPercent={asset.progressPercent} /></div>
        {(asset.type === "VIDEO" || asset.type === "FINAL_OUTPUT" || asset.type === "MOTION") && <Play className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-white" aria-hidden="true" />}
      </div>
      <div className="space-y-1 p-3"><p className="truncate font-mono text-xs font-bold text-slate-200">{asset.filename}</p><p className="truncate text-[11px] text-slate-400">{asset.projectTitle}</p></div>
    </button>
    <div className="flex items-center justify-between border-t border-slate-800/80 px-3 py-2 text-[10px] text-slate-500"><span>{asset.fileSize}</span>{onDownload && <button type="button" aria-label={`Tải xuống ${asset.filename}`} onClick={(event) => { event.stopPropagation(); onDownload(event); }} className="rounded p-1 transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"><Download className="h-3 w-3" /></button>}</div>
  </article>
);
