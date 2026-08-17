import React from "react";
import { MediaAsset } from "@/types/assets";
import { AssetTypeBadge } from "./AssetTypeBadge";
import { AssetStatusBadge } from "./AssetStatusBadge";
import { cn } from "@/lib/utils";
import {
  Play,
  Volume2,
  Download,
  MoreVertical,
  AlertTriangle,
  Loader2,
  Lock,
} from "lucide-react";

interface AssetCardProps {
  asset: MediaAsset;
  isSelected?: boolean;
  onClick?: () => void;
  onDownload?: (e: React.MouseEvent) => void;
}

export const AssetCard: React.FC<AssetCardProps> = ({
  asset,
  isSelected = false,
  onClick,
  onDownload,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-[#0d1420] hover:bg-[#111a29] border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 shadow-md flex flex-col justify-between select-none",
        isSelected
          ? "border-purple-500 ring-2 ring-purple-500/50 shadow-[0_0_20px_rgba(124,58,237,0.35)]"
          : "border-slate-800/90 hover:border-slate-700"
      )}
    >
      {/* Media Thumbnail Box */}
      <div className="aspect-[16/10] w-full overflow-hidden bg-slate-950 relative">
        {/* Audio Waveform Graphic */}
        {asset.type === "AUDIO" ? (
          <div className="w-full h-full bg-gradient-to-br from-[#0e1626] to-[#090e18] p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between z-10">
              <AssetTypeBadge type={asset.type} />
              <AssetStatusBadge
                status={asset.status}
                progressPercent={asset.progressPercent}
              />
            </div>

            {/* Simulated Waveform Bars */}
            <div className="flex items-center justify-center gap-1 h-14 px-2 my-auto">
              {(asset.audioWaveform || [20, 40, 60, 80, 50, 70, 90, 60, 40, 60, 80, 50, 70, 90, 40, 30]).map(
                (height, i) => (
                  <div
                    key={i}
                    style={{ height: `${height}%` }}
                    className={cn(
                      "w-1 rounded-full transition-all",
                      asset.status === "PROCESSING"
                        ? "bg-purple-500/60 animate-pulse"
                        : "bg-purple-400 group-hover:bg-purple-300"
                    )}
                  />
                )
              )}
            </div>

            {/* Audio Duration Bar */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>00:24</span>
              <span>{asset.duration || "07:36"}</span>
            </div>
          </div>
        ) : (
          <>
            {/* Standard Image/Video Thumbnail */}
            <img
              src={asset.thumbnailUrl}
              alt={asset.filename}
              className={cn(
                "w-full h-full object-cover transition-transform duration-300 group-hover:scale-105",
                asset.status === "FAILED" && "opacity-40 grayscale"
              )}
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

            {/* Top Badges */}
            <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
              <AssetTypeBadge type={asset.type} />
              <AssetStatusBadge
                status={asset.status}
                progressPercent={asset.progressPercent}
              />
            </div>

            {/* Video Play Icon Overlay */}
            {(asset.type === "VIDEO" || asset.type === "FINAL_OUTPUT" || asset.type === "MOTION") && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                </div>
              </div>
            )}

            {/* Failure State Overlay */}
            {asset.status === "FAILED" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-rose-950/60 backdrop-blur-[2px] text-rose-300 p-2 text-center pointer-events-none">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
                <span className="text-[11px] font-bold">Thất bại</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Card Info Details matching Mockup */}
      <div className="p-3 space-y-2">
        <div className="space-y-0.5">
          <p className="text-xs font-bold text-slate-200 truncate group-hover:text-purple-300 transition-colors font-mono">
            {asset.filename}
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>{asset.dimensions || asset.audioSampleRate || "1920 × 1080"}</span>
            {asset.duration && <span className="text-purple-300">{asset.duration}</span>}
          </div>
        </div>

        {/* Context metadata (Chapter / Scene / Character / Location) */}
        <p className="text-[11px] text-slate-400 truncate">
          {asset.characterName
            ? `Character — ${asset.characterName}`
            : asset.locationName
            ? `Location — ${asset.locationName}`
            : asset.chapterTitle
            ? `${asset.chapterTitle.split("—")[0]} • ${asset.sceneTitle ? asset.sceneTitle.split("—")[0] : ""}`
            : asset.projectTitle}
        </p>

        {/* Footer: Date, Size and Download Icon */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono">
          <span>{asset.createdAt.split(" ")[0]}</span>
          <div className="flex items-center gap-2">
            <span>{asset.fileSize}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onDownload) onDownload(e);
              }}
              className="p-1 hover:text-slate-200 transition-colors rounded hover:bg-slate-800"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
