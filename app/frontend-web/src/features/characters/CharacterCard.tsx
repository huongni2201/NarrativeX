import React from "react";
import { Character, ProjectCharacter } from "@/types/studio";
import { Lock, Folder } from "lucide-react";

interface CharacterCardProps {
  character: Character;
  projectCharacter?: ProjectCharacter;
  projectName?: string;
  onClick: (character: Character) => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  projectCharacter,
  projectName,
  onClick,
}) => {
  const isLocked = character.latestVersion.status === "LOCKED";
  const status = character.status || (isLocked ? "IN_USE" : "DRAFT");

  return (
    <button
      type="button"
      onClick={() => onClick(character)}
      className="group relative w-full text-left bg-[#0b101b] hover:bg-[#0f1726] border border-slate-800/80 hover:border-purple-500/60 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_rgba(124,58,237,0.22)] flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-slate-950 relative">
        <img
          src={character.avatarUrl}
          alt={character.name}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b101b] via-[#0b101b]/20 to-black/40 pointer-events-none" />

        <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 z-10">
          {isLocked && (
            <span
              className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-amber-300 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1 shadow-sm"
              title="Phiên bản đã khóa"
            >
              <Lock className="w-2.5 h-2.5" />
              <span>Đã khóa</span>
            </span>
          )}

          {status === "IN_USE" && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Đang dùng
            </span>
          )}

          {status === "DRAFT" && (
            <span className="px-2 py-0.5 rounded-md bg-amber-950/80 backdrop-blur-md text-amber-400 border border-amber-500/30 text-[10px] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Bản nháp
            </span>
          )}

          {status === "ARCHIVED" && (
            <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-slate-400 border border-slate-700/50 text-[10px] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Lưu trữ
            </span>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10">
          {character.group && (
            <span className="px-2 py-0.5 rounded-md bg-purple-950/80 backdrop-blur-md text-purple-300 border border-purple-700/40 text-[10px] font-medium">
              {character.group}
            </span>
          )}
        </div>

        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300 z-10">
          {projectName && (
            <span className="flex items-center gap-1 text-slate-300 font-medium truncate max-w-[150px] bg-black/50 px-2 py-0.5 rounded-md backdrop-blur-sm">
              <Folder className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="truncate">{projectName}</span>
            </span>
          )}
          {character.appearancesCount !== undefined && (
            <span className="text-[10px] text-slate-400 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm ml-auto">
              {character.appearancesCount} cảnh
            </span>
          )}
        </div>
      </div>

      <div className="p-3.5 space-y-1.5 bg-[#0b101b] border-t border-slate-800/60 w-full">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm text-slate-100 group-hover:text-purple-300 transition-colors truncate">
            {character.name}
          </h3>
          <span className="text-[11px] font-mono text-purple-400 font-medium shrink-0 bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-800/30">
            v{character.latestVersion.versionNumber}.0
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400">
          <p className="truncate">
            {projectCharacter?.role ?? character.description?.slice(0, 30) ?? "Nhân vật"}
          </p>
          <span className="text-[10px] text-slate-500 shrink-0 ml-1">
            {character.gender} · {character.age} tuổi
          </span>
        </div>
      </div>
    </button>
  );
};
