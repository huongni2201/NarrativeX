import React from "react";
import { useStudioStore } from "@/store/useStudioStore";
import { useProductionStore } from "@/store/useProductionStore";
import { ProjectCard } from "./ProjectCard";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Plus, Search, FolderKanban } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Project } from "@/types/studio";

export const ProjectsDashboard: React.FC = () => {
  const {
    projects,
    projectFilterTab,
    setProjectFilterTab,
    projectSearchQuery,
    setProjectSearchQuery,
    toggleFavoriteProject,
    openWizard,
    setScreen,
  } = useStudioStore();

  const { setView } = useProductionStore();

  const filterTabs = [
    { id: "all", label: "Tất cả", count: projects.length },
    {
      id: "in_progress",
      label: "Đang xử lý",
      count: projects.filter((p) => p.progress < 100).length,
    },
    {
      id: "completed",
      label: "Hoàn thành",
      count: projects.filter((p) => p.progress === 100).length,
    },
    {
      id: "favorites",
      label: "Yêu thích",
      count: projects.filter((p) => p.isFavorite).length,
    },
  ];

  const filteredProjects = projects.filter((project) => {
    // Search query filter
    const matchesSearch =
      project.title.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
      project.description.toLowerCase().includes(projectSearchQuery.toLowerCase());

    // Tab filter
    if (projectFilterTab === "in_progress") {
      return matchesSearch && project.progress < 100;
    }
    if (projectFilterTab === "completed") {
      return matchesSearch && project.progress === 100;
    }
    if (projectFilterTab === "favorites") {
      return matchesSearch && project.isFavorite;
    }
    return matchesSearch;
  });

  const handleCardClick = (project: Project) => {
    // Navigate directly into Production Workspace for this project
    setScreen("project-workspace");
    setView("overview");
  };

  return (
    <div className="space-y-6">
      {/* Top Filter and Action Bar matching Mockup */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-3">
          <Tabs
            tabs={filterTabs}
            activeTab={projectFilterTab}
            onChange={(tab) => setProjectFilterTab(tab as any)}
            variant="pills"
          />
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <div className="w-60 hidden md:block">
            <Input
              placeholder="Tìm kiếm dự án..."
              value={projectSearchQuery}
              onChange={(e) => setProjectSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4" />}
            />
          </div>
          <Button
            onClick={() => openWizard(1)}
            variant="primary"
            className="flex items-center gap-2 shadow-[0_0_20px_rgba(124,58,237,0.4)] font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Dự án mới</span>
          </Button>
        </div>
      </div>

      {/* Projects Grid matching Mockup (4 cols on large screens, 8 cards) */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onFavoriteToggle={(e, id) => {
                e.stopPropagation();
                toggleFavoriteProject(id);
              }}
              onClick={handleCardClick}
            />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center bg-[#0d1420]/50 rounded-2xl border border-slate-800/80 p-8 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400">
            <FolderKanban className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200">
              Không tìm thấy dự án phù hợp
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Hãy thử thay đổi bộ lọc tìm kiếm hoặc tạo một dự án mới để bắt đầu.
            </p>
          </div>
          <Button onClick={() => openWizard(1)} variant="primary" size="sm">
            <Plus className="w-3.5 h-3.5" /> Tạo dự án mới
          </Button>
        </div>
      )}
    </div>
  );
};
