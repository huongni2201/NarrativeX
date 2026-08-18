import React from "react";
import Image from "next/image";
import type { StylePreset } from "@/types/presets";
import { Check, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface PresetCardProps {
  preset: StylePreset;
  isSelected?: boolean;
  onClick?: () => void;
  onDuplicate?: (event: React.MouseEvent) => void;
  onDelete?: (event: React.MouseEvent) => void;
}

export const PresetCard: React.FC<PresetCardProps> = ({ preset, isSelected = false, onClick }) => (
  <article className={cn("group overflow-hidden rounded-2xl border bg-[#0d1420] shadow-md transition-all", isSelected ? "border-purple-500 ring-2 ring-purple-500/50" : "border-slate-800/90 hover:border-slate-700")}>
    <button type="button" onClick={onClick} className="block w-full text-left">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-950">
        <Image
          src={preset.coverImage}
          alt={preset.name}
          fill
          sizes="(min-width: 1280px) 20vw, (min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform motion-safe:group-hover:scale-105"
        />
        {isSelected && <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-purple-400 bg-purple-600 text-white"><Check className="h-3.5 w-3.5" /></span>}
        {preset.isDefault && <span className="absolute left-2.5 top-2.5 rounded-md border border-purple-700/60 bg-purple-950/90 px-2 py-0.5 text-[10px] font-semibold text-purple-300">Mặc định</span>}
      </div>
      <div className="space-y-3 p-4"><div><h3 className="text-sm font-bold text-white">{preset.name}</h3><p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-400">{preset.description}</p></div><div className="flex flex-wrap gap-1.5">{preset.tags.map((tag) => <span key={tag} className="rounded border border-slate-800 bg-[#090e18] px-2 py-0.5 font-mono text-[10px] font-bold text-slate-400">{tag}</span>)}</div></div>
    </button>
    <div className="flex items-center justify-between border-t border-slate-800/80 px-4 py-2.5 text-xs text-slate-500"><span>Được dùng {preset.usedInProjectsCount} dự án</span><span aria-hidden="true"><MoreVertical className="h-3.5 w-3.5" /></span></div>
  </article>
);
