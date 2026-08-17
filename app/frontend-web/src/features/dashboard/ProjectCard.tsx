import React from "react";
import { Project } from "@/types/studio";
import { Star, Clock, Film } from "lucide-react";
import { Progress } from "@/components/ui/Progress";
import { cn } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
  onFavoriteToggle: (e: React.MouseEvent, id: string) => void;
  onClick: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onFavoriteToggle,
  onClick,
}) => {
  return (
    <div
      onClick={() => onClick(project)}
      className="group relative bg-[#0d1420] hover:bg-[#111a29] border border-slate-800/90 hover:border-purple-500/50 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-[0_0_25px_rgba(124,58,237,0.2)] flex flex-col"
    >
      {/* Thumbnail Aspect Box */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
        <img
          src={project.coverImage}
          alt={project.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1420] via-transparent to-black/40" />

        {/* Favorite Button */}
        <button
          onClick={(e) => onFavoriteToggle(e, project.id)}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-md text-slate-300 hover:text-amber-400 transition-colors z-10"
        >
          <Star
            className={cn(
              "w-4 h-4 transition-colors",
              project.isFavorite
                ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                : "text-slate-400"
            )}
          />
        </button>

        {/* Genre Pill */}
        <div className="absolute top-2.5 left-2.5">
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-black/60 backdrop-blur-md text-purple-300 border border-purple-500/30">
            {project.genre}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5 flex flex-col justify-between flex-1 gap-3">
        <div>
          <h3 className="font-semibold text-sm text-slate-100 group-hover:text-purple-300 transition-colors truncate">
            {project.title}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Cập nhật: {project.updatedAt}</span>
          </div>
        </div>

        {/* Progress Bar with percentage */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-mono text-[11px]">Tiến độ</span>
            <span className="font-semibold font-mono text-purple-300 text-[11px]">
              {project.progress}%
            </span>
          </div>
          <Progress
            value={project.progress}
            color={project.progress === 100 ? "green" : "purple"}
          />
        </div>
      </div>
    </div>
  );
};
