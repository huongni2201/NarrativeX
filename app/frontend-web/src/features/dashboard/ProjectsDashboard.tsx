"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useStudioStore } from "@/store/useStudioStore";
import { ProjectCard } from "./ProjectCard";
import { Tabs } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Plus, Search, FolderKanban, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { apiErrorMessage } from "@/shared/api/client";
import { projectsApi } from "@/features/projects/api/projects.api";
import { queryKeys } from "@/lib/query-keys";
import type { ApiProject } from "@/types/api";

const completedStatuses = new Set(["COMPLETED", "ARCHIVED"]);
const PROJECT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
type ProjectFilterTab = "all" | "in_progress" | "completed";

function projectFilterFrom(value: string | null): ProjectFilterTab {
  return value === "in_progress" || value === "completed" ? value : "all";
}

export const ProjectsDashboard: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openWizard = useStudioStore((state) => state.openWizard);
  const projectFilterTab = projectFilterFrom(searchParams.get("status"));
  const projectSearchQuery = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(projectSearchQuery);

  useEffect(() => {
    setSearchInput(projectSearchQuery);
  }, [projectSearchQuery]);

  const updateSearchParams = useCallback((updates: { status?: ProjectFilterTab; q?: string }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (updates.status !== undefined) {
      if (updates.status === "all") params.delete("status");
      else params.set("status", updates.status);
    }
    if (updates.q !== undefined) {
      const query = updates.q.trimStart();
      if (query) params.set("q", query);
      else params.delete("q");
    }
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (searchInput === projectSearchQuery) return;
    const timeoutId = window.setTimeout(() => {
      updateSearchParams({ q: searchInput });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [projectSearchQuery, searchInput, updateSearchParams]);

  const projectsQuery = useInfiniteQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ pageParam }) => projectsApi.list({ cursor: pageParam ?? undefined, limit: PROJECT_PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.hasNext ? (lastPage.nextCursor ?? undefined) : undefined,
  });

  const projects = useMemo(
    () => projectsQuery.data?.pages.flatMap((page) => page.content) ?? [],
    [projectsQuery.data],
  );

  const filterTabs = useMemo(
    () => [
      { id: "all", label: "Tất cả", count: projects.length },
      { id: "in_progress", label: "Đang xử lý", count: projects.filter((project) => !completedStatuses.has(project.status)).length },
      { id: "completed", label: "Hoàn thành", count: projects.filter((project) => completedStatuses.has(project.status)).length },
    ],
    [projects],
  );

  const normalizedSearch = searchInput.trim().toLocaleLowerCase("vi");
  const filteredProjects = useMemo(
    () => projects.filter((project) => {
      const matchesSearch = !normalizedSearch || project.name.toLocaleLowerCase("vi").includes(normalizedSearch);
      if (projectFilterTab === "in_progress") return matchesSearch && !completedStatuses.has(project.status);
      if (projectFilterTab === "completed") return matchesSearch && completedStatuses.has(project.status);
      return matchesSearch;
    }),
    [normalizedSearch, projectFilterTab, projects],
  );

  const handleCardClick = (project: ApiProject) => router.push(`/projects/${project.id}`);

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={filterTabs}
          activeTab={projectFilterTab}
          onChange={(tab) => updateSearchParams({ status: projectFilterFrom(tab) })}
          variant="pills"
          ariaLabel="Lọc dự án theo trạng thái"
        />

        <div className="flex items-center gap-3">
          <div className="hidden w-60 md:block">
            <Input
              aria-label="Tìm kiếm dự án đã tải"
              placeholder="Tìm kiếm dự án đã tải..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              icon={<Search className="h-4 w-4" />}
            />
          </div>
          <Button onClick={() => openWizard(1)} variant="primary" className="flex items-center gap-2 font-semibold">
            <Plus className="h-4 w-4" /><span>Dự án mới</span>
          </Button>
        </div>
      </div>

      <div className="md:hidden">
        <Input
          aria-label="Tìm kiếm dự án đã tải"
          placeholder="Tìm kiếm dự án đã tải..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
      </div>

      {filteredProjects.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {filteredProjects.map((project) => <ProjectCard key={project.id} project={project} onClick={handleCardClick} />)}
          </div>
          {projectsQuery.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="secondary" size="sm" isLoading={projectsQuery.isFetchingNextPage} onClick={() => projectsQuery.fetchNextPage()}>Tải thêm dự án</Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 py-20 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-800/60 bg-purple-950/60 text-purple-400"><FolderKanban className="h-7 w-7" /></div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200">Không tìm thấy dự án phù hợp</h3>
            <p className="mx-auto max-w-sm text-xs text-slate-400">Hãy thử thay đổi bộ lọc/tìm kiếm hoặc tải thêm dự án.</p>
          </div>
          {projectsQuery.hasNextPage ? (
            <Button onClick={() => projectsQuery.fetchNextPage()} variant="secondary" size="sm" isLoading={projectsQuery.isFetchingNextPage}>Tải thêm dự án để tìm tiếp</Button>
          ) : (
            <Button onClick={() => openWizard(1)} variant="primary" size="sm"><Plus className="h-3.5 w-3.5" /> Tạo dự án mới</Button>
          )}
        </div>
      )}
    </div>
  );
};
