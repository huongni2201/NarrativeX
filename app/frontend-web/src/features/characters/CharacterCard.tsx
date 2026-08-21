/* eslint-disable @next/next/no-img-element -- Character media URLs are backend/CDN-owned runtime values. */
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
      className="group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-surface-card text-left transition-colors duration-200 hover:border-primary/60 hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-slate-950 relative">
        <img
          src={character.avatarUrl}
          alt={character.name}
          width={300}
          height={400}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
          loading="lazy"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-card via-surface-card/20 to-black/40" />

        <div className="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1.5 z-10">
          {isLocked && (
            <span
              className="flex items-center gap-1 rounded-md border border-warning/40 bg-warning-bg px-2 py-0.5 text-[10px] font-semibold text-warning"
              title="Phiên bản đã khóa"
            >
              <Lock className="w-2.5 h-2.5" />
              <span>Đã khóa</span>
            </span>
          )}

          {status === "IN_USE" && (
            <span className="flex items-center gap-1 rounded-md border border-success/40 bg-success-bg px-2 py-0.5 text-[10px] font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Đang dùng
            </span>
          )}

          {status === "DRAFT" && (
            <span className="flex items-center gap-1 rounded-md border border-warning/40 bg-warning-bg px-2 py-0.5 text-[10px] font-semibold text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              Bản nháp
            </span>
          )}

          {status === "ARCHIVED" && (
            <span className="flex items-center gap-1 rounded-md border border-border bg-surface-card px-2 py-0.5 text-[10px] font-semibold text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Lưu trữ
            </span>
          )}
        </div>

        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10">
          {character.group && (
            <span className="rounded-md border border-primary/40 bg-primary-muted px-2 py-0.5 text-[10px] font-medium text-primary-light">
              {character.group}
            </span>
          )}
        </div>

        <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300 z-10">
          {projectName && (
            <span className="flex max-w-[150px] items-center gap-1 truncate rounded-md border border-border bg-surface-card px-2 py-0.5 font-medium text-text-secondary">
              <Folder className="h-3 w-3 shrink-0 text-primary" />
              <span className="truncate">{projectName}</span>
            </span>
          )}
          {character.appearancesCount !== undefined && (
            <span className="ml-auto rounded border border-border bg-surface-card px-1.5 py-0.5 text-[10px] text-text-muted">
              {character.appearancesCount} cảnh
            </span>
          )}
        </div>
      </div>

      <div className="w-full space-y-1.5 border-t border-border bg-surface-card p-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-text-primary transition-colors group-hover:text-primary-light">
            {character.name}
          </h3>
          <span className="shrink-0 rounded border border-primary/40 bg-primary-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-primary-light">
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
