import React from "react";
import { Character, ProjectCharacter, Project } from "@/types/studio";
import { Lock, Eye, Sparkles, Folder, CheckCircle, Clock, Archive } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CharacterListViewProps {
  characters: Character[];
  projectCharacters: ProjectCharacter[];
  projects: Project[];
  onSelectCharacter: (characterId: string) => void;
}

export const CharacterListView: React.FC<CharacterListViewProps> = ({
  characters,
  projectCharacters,
  projects,
  onSelectCharacter,
}) => {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-[#090e18]/80 shadow-xl">
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-[#0f1728]/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
          <tr>
            <th className="py-3.5 px-4">Nhân vật</th>
            <th className="py-3.5 px-4">Vai trò / Nhóm</th>
            <th className="py-3.5 px-4">Dự án</th>
            <th className="py-3.5 px-4">Giới tính / Tuổi</th>
            <th className="py-3.5 px-4">Trạng thái</th>
            <th className="py-3.5 px-4">Phiên bản</th>
            <th className="py-3.5 px-4">Xuất hiện</th>
            <th className="py-3.5 px-4 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {characters.map((character) => {
            const assignment = projectCharacters.find((pc) => pc.characterId === character.id);
            const project = projects.find((p) => String(p.id) === assignment?.projectId);
            const isLocked = character.latestVersion.status === "LOCKED";
            const status = character.status || (isLocked ? "IN_USE" : "DRAFT");

            return (
              <tr
                key={character.id}
                onClick={() => onSelectCharacter(character.id)}
                className="hover:bg-purple-950/20 transition-colors cursor-pointer group"
              >
                {/* Character Thumbnail & Name */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/60 shrink-0 group-hover:border-purple-500/50 transition-colors">
                      <img
                        src={character.avatarUrl}
                        alt={character.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-100 group-hover:text-purple-300 transition-colors flex items-center gap-1.5">
                        <span>{character.name}</span>
                        {isLocked && <Lock className="w-3 h-3 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {character.canonicalIdentity}
                      </p>
                    </div>
                  </div>
                </td>

                {/* Role / Group */}
                <td className="py-3 px-4">
                  <div className="space-y-1">
                    <span className="font-medium text-slate-200 block">
                      {assignment?.role || character.roleCategory || "Nhân vật"}
                    </span>
                    {character.group && (
                      <span className="inline-block px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/40 text-[10px] text-purple-300 font-medium">
                        {character.group}
                      </span>
                    )}
                  </div>
                </td>

                {/* Project */}
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Folder className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="truncate max-w-[140px]">
                      {project?.name || project?.title || "Chung / Toàn cục"}
                    </span>
                  </div>
                </td>

                {/* Gender / Age */}
                <td className="py-3 px-4 text-slate-300">
                  <span>{character.gender}</span>
                  <span className="text-slate-500 mx-1">·</span>
                  <span>{character.age} tuổi</span>
                </td>

                {/* Status */}
                <td className="py-3 px-4">
                  {status === "IN_USE" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Đang dùng
                    </span>
                  )}
                  {status === "DRAFT" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/30 text-amber-400 text-[11px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      Bản nháp
                    </span>
                  )}
                  {status === "ARCHIVED" && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700/50 text-slate-400 text-[11px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Lưu trữ
                    </span>
                  )}
                </td>

                {/* Version */}
                <td className="py-3 px-4">
                  <span className="font-mono text-purple-400 font-semibold bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/30 text-[11px]">
                    v{character.latestVersion.versionNumber}.0
                  </span>
                </td>

                {/* Appearances */}
                <td className="py-3 px-4 text-slate-400">
                  <span>{character.appearancesCount ?? "—"} cảnh</span>
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCharacter(character.id);
                    }}
                    className="text-purple-300 hover:text-white hover:bg-purple-900/40 text-xs"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    <span>Chi tiết</span>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
