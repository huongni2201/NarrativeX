import React from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { CharacterCard } from "./CharacterCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Search, Plus, Users, Filter } from "lucide-react";
import { Character } from "@/types/studio";

export const CharacterLibrary: React.FC = () => {
  const {
    characters,
    projectCharacters,
    projects,
    characterFilterProject,
    setCharacterFilterProject,
    characterFilterStatus,
    setCharacterFilterStatus,
    characterSearchQuery,
    setCharacterSearchQuery,
    openCharacterBible,
  } = useStudioStore();

  const filteredCharacters = characters.filter((c) => {
    const matchesSearch =
      c.canonicalIdentity.toLowerCase().includes(characterSearchQuery.toLowerCase()) ||
      c.name.toLowerCase().includes(characterSearchQuery.toLowerCase()) ||
      (c.aliases ?? []).some((alias) => alias.toLowerCase().includes(characterSearchQuery.toLowerCase())) ||
      projects.some(
        (project) =>
          projectCharacters.some(
            (assignment) => assignment.characterId === c.id && assignment.projectId === project.id
          ) && project.title.toLowerCase().includes(characterSearchQuery.toLowerCase())
      ) ||
      projectCharacters.some(
        (assignment) =>
          assignment.characterId === c.id &&
          (assignment.role.toLowerCase().includes(characterSearchQuery.toLowerCase()) ||
            assignment.projectAliases.some((alias) => alias.toLowerCase().includes(characterSearchQuery.toLowerCase())))
      );

    const matchesProject =
      characterFilterProject === "all" ||
      projectCharacters.some(
        (assignment) => assignment.characterId === c.id && assignment.projectId === characterFilterProject
      );

    const matchesStatus =
      characterFilterStatus === "all" ||
      (characterFilterStatus === "locked" && c.latestVersion.status === "LOCKED") ||
      (characterFilterStatus === "unlocked" && c.latestVersion.status !== "LOCKED");

    return matchesSearch && matchesProject && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Filter & Action Bar matching Mockup */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search & Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="w-full sm:w-64">
            <Input
              placeholder="Tìm kiếm nhân vật..."
              value={characterSearchQuery}
              onChange={(e) => setCharacterSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Project Filter */}
          <div className="relative">
            <select
              value={characterFilterProject}
              onChange={(e) => setCharacterFilterProject(e.target.value)}
              className="bg-[#0d1420] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer"
            >
              <option value="all">Tất cả dự án</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={characterFilterStatus}
              onChange={(e) => setCharacterFilterStatus(e.target.value)}
              className="bg-[#0d1420] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="locked">Đã khóa (Locked)</option>
              <option value="unlocked">Bản nháp</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <Button
            onClick={() => openCharacterBible("char-1")}
            variant="primary"
            className="flex items-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.4)]"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo nhân vật</span>
          </Button>
        </div>
      </div>

      {/* Characters Grid matching Mockup (4 cols, 8 character cards) */}
      {filteredCharacters.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filteredCharacters.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              projectCharacter={projectCharacters.find(
                (assignment) =>
                  assignment.characterId === character.id &&
                  (characterFilterProject === "all" || assignment.projectId === characterFilterProject)
              )}
              onClick={() => openCharacterBible(character.id)}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-[#0d1420]/50 rounded-2xl border border-slate-800/80 p-8 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200">
              Không tìm thấy nhân vật nào
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Hãy thử tìm kiếm với từ khóa khác hoặc tạo nhân vật mới cho dự án của bạn.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
