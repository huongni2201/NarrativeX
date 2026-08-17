"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useStudioStore } from "@/store/useStudioStore";
import { useProductionStore } from "@/store/useProductionStore";
import { ProjectCard } from "./ProjectCard";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Plus, Search, FolderKanban, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { api, apiErrorMessage } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import type { ApiProject } from "@/types/api";

const completedStatuses = new Set(["COMPLETED", "ARCHIVED"]);
const PROJECT_PAGE = 0;
const PROJECT_PAGE_SIZE = 100;
type ProjectFilterTab = "all" | "in_progress" | "completed";

export const ProjectsDashboard: React.FC = () => {
  const router = useRouter();
  const projectFilterTab = useStudioStore((state) => state.projectFilterTab);
  const setProjectFilterTab = useStudioStore((state) => state.setProjectFilterTab);
  const projectSearchQuery = useStudioStore((state) => state.projectSearchQuery);
  const setProjectSearchQuery = useStudioStore((state) => state.setProjectSearchQuery);
  const openWizard = useStudioStore((state) => state.openWizard);
  const setView = useProductionStore((state) => state.setView);

  const projectsQuery = useQuery({
    queryKey: queryKeys.projectsPage(PROJECT_PAGE, PROJECT_PAGE_SIZE),
    queryFn: () => api.listProjects({ limit: PROJECT_PAGE_SIZE }),
  });
  const projects = projectsQuery.data?.content ?? [];

  const filterTabs = useMemo(
    () => [
      { id: "all", label: "Tất cả", count: projects.length },
      {
        id: "in_progress",
        label: "Đang xử lý",
        count: projects.filter((project) => !completedStatuses.has(project.status)).length,
      },
      {
        id: "completed",
        label: "Hoàn thành",
        count: projects.filter((project) => completedStatuses.has(project.status)).length,
      },
    ],
    [projects],
  );

  const normalizedSearch = projectSearchQuery.trim().toLocaleLowerCase("vi");
  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const matchesSearch = !normalizedSearch || project.name.toLocaleLowerCase("vi").includes(normalizedSearch);

        if (projectFilterTab === "in_progress") {
          return matchesSearch && !completedStatuses.has(project.status);
        }
        if (projectFilterTab === "completed") {
          return matchesSearch && completedStatuses.has(project.status);
        }
        return matchesSearch;
      }),
    [normalizedSearch, projectFilterTab, projects],
  );

  const handleCardClick = (project: ApiProject) => {
    setView("overview");
    router.push(`/projects/${project.id}`);
  };

  if (projectsQuery.isPending) {
    return <div className="flex min-h-72 items-center justify-center text-sm text-slate-400"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Đang tải dự án từ backend…</div>;
  }

  if (projectsQuery.isError) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center">
        <h3 className="text-base font-semibold text-rose-200">Không tải được danh sách dự án</h3>
        <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-rose-200/70">{apiErrorMessage(projectsQuery.error, "Backend API chưa phản hồi.")}</p>
        <Button onClick={() => projectsQuery.refetch()} variant="secondary" size="sm" className="mt-5"><RefreshCw className="mr-2 h-3.5 w-3.5" />Thử lại</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Tabs
            tabs={filterTabs}
            activeTab={projectFilterTab}
            onChange={(tab) => setProjectFilterTab(tab as ProjectFilterTab)}
            variant="pills"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="w-60 hidden md:block">
            <Input
              placeholder="Tìm kiếm dự án..."
              value={projectSearchQuery}
              onChange={(event) => setProjectSearchQuery(event.target.value)}
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

      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
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
