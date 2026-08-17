import React from "react";
import { Character, ProjectCharacter } from "@/types/studio";
import { Badge } from "@/components/ui/Badge";
import { MoreVertical, Lock, Sparkles, Trash2 } from "lucide-react";

interface CharacterCardProps {
  character: Character;
  projectCharacter?: ProjectCharacter;
  onClick: (character: Character) => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  projectCharacter,
  onClick,
}) => {
  return (
    <div
      onClick={() => onClick(character)}
      className="group relative bg-[#0d1420] hover:bg-[#111a29] border border-slate-800/90 hover:border-purple-500/50 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-[0_0_25px_rgba(124,58,237,0.2)] flex flex-col"
    >
      {/* Card Image Area */}
      <div className="aspect-[3/4] w-full overflow-hidden bg-slate-950 relative">
        <img
          src={character.avatarUrl}
          alt={character.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1420] via-transparent to-black/30" />

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          {character.latestVersion.status === "LOCKED" && (
            <span className="p-1 rounded bg-black/60 backdrop-blur-md text-slate-300 border border-white/10" title="Phiên bản đã khóa">
              <Lock className="w-3 h-3 text-slate-300" />
            </span>
          )}
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className="absolute top-2.5 right-2.5 p-1 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-slate-400 hover:text-slate-200 transition-colors"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Info Area matching Mockup */}
      <div className="p-3.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-slate-100 group-hover:text-purple-300 transition-colors truncate">
            {character.name}
          </h3>
          <span className="text-[11px] font-mono text-purple-400 font-medium">
            Version {character.latestVersion.versionNumber}
          </span>
        </div>

        <p className="text-xs text-slate-400 truncate">
          {projectCharacter?.role ?? "Reusable identity"}
        </p>
      </div>
    </div>
  );
};
