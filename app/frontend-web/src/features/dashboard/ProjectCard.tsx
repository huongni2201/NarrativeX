import React from "react";
import type { ApiProject } from "@/types/api";
import { FolderKanban, Server } from "lucide-react";

interface ProjectCardProps {
  project: ApiProject;
  onClick: (project: ApiProject) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onClick,
}) => {
  const isDraft = project.status === "DRAFT";

  return (
    <button
      type="button"
      onClick={() => onClick(project)}
      className="group relative w-full bg-[#0d1420] hover:bg-[#111a29] border border-slate-800/90 hover:border-purple-500/50 rounded-xl overflow-hidden cursor-pointer text-left transition-all duration-200 hover:shadow-[0_0_25px_rgba(124,58,237,0.2)] flex flex-col"
    >
      <div className="relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#171434] via-[#10172b] to-[#09111d]">
        {project.coverImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${JSON.stringify(project.coverImageUrl).slice(1, -1)})` }}
            role="img"
            aria-label={project.name}
          />
        ) : (
          <FolderKanban className="h-12 w-12 text-purple-300/50 transition-transform duration-300 group-hover:scale-110" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1420] via-transparent to-transparent opacity-60" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-purple-200 backdrop-blur-md">
          <Server className="h-3 w-3" /> API
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-3 p-3.5">
        <div>
          <h3 className="truncate text-sm font-semibold text-slate-100 transition-colors group-hover:text-purple-300">
            {project.name}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs text-slate-400">
            {project.description || `Project #${project.id} · row ${project.rowVersion}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className={`rounded border px-2 py-0.5 font-medium ${isDraft ? "border-slate-500/30 text-slate-300" : "border-emerald-500/30 text-emerald-300"}`}>
            {project.status}
          </span>
          <span>{project.imageAspectRatio}</span>
          <span>{project.imageQualityTier}</span>
        </div>
      </div>
    </button>
  );
};
