import React from "react";
import { StylePreset } from "@/types/presets";
import { cn } from "@/lib/utils";
import { Check, MoreVertical, Sparkles, Layers } from "lucide-react";

interface PresetCardProps {
  preset: StylePreset;
  isSelected?: boolean;
  onClick?: () => void;
  onDuplicate?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
}

export const PresetCard: React.FC<PresetCardProps> = ({
  preset,
  isSelected = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-[#0d1420] hover:bg-[#111a29] border rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 shadow-md flex flex-col justify-between select-none",
        isSelected
          ? "border-purple-500 ring-2 ring-purple-500/50 shadow-[0_0_20px_rgba(124,58,237,0.35)]"
          : "border-slate-800/90 hover:border-slate-700"
      )}
    >
      {/* Cover Image */}
      <div className="aspect-[16/10] w-full overflow-hidden bg-slate-950 relative">
        <img
          src={preset.coverImage}
          alt={preset.name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1420] via-transparent to-black/30" />

        {/* Selected Checkmark in Top-Right matching Mockup */}
        {isSelected && (
          <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-purple-600 border border-purple-400 text-white flex items-center justify-center shadow-[0_0_12px_rgba(124,58,237,0.8)]">
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
        )}

        {/* Default Tag */}
        {preset.isDefault && (
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-purple-950/90 text-purple-300 border border-purple-700/60 text-[10px] font-semibold">
            Phong cách mặc định
          </div>
        )}
      </div>

      {/* Preset Details matching Mockup */}
      <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
            {preset.name}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
            {preset.description}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {preset.tags.map((tag, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider bg-[#090e18] text-slate-400 border border-slate-800"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Footer: Used In Count & Context Menu */}
        <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80 text-xs text-slate-500 font-medium">
          <span>Được dùng {preset.usedInProjectsCount} dự án</span>
          <button
            type="button"
            className="p-1 hover:text-slate-200 transition-colors rounded hover:bg-slate-800"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
