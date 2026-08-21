"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useStudioStore } from "@/store/useStudioStore";
import { ProjectCard } from "./ProjectCard";
import { Button } from "@/components/ui/Button";
import {
  ChevronDown,
  FolderKanban,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { apiErrorMessage } from "@/shared/api/client";
import { projectsApi } from "@/features/projects/api/projects.api";
import { queryKeys } from "@/lib/query-keys";
import type { ApiProject } from "@/types/api";

const PROJECT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
type ProjectFilterTab = "all" | "draft" | "active";
type ProjectSortOption = "newest" | "oldest" | "name";

function projectFilterFrom(value: string | null): ProjectFilterTab {
  return value === "draft" || value === "active" ? value : "all";
}

export const ProjectsDashboard: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openWizard = useStudioStore((state) => state.openWizard);

  const projectFilterTab = projectFilterFrom(searchParams.get("status"));
  const projectSearchQuery = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(projectSearchQuery);
  const [sortOption, setSortOption] = useState<ProjectSortOption>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    setSearchInput(projectSearchQuery);
  }, [projectSearchQuery]);

  const updateSearchParams = useCallback(
    (updates: { status?: ProjectFilterTab; q?: string }) => {
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
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (searchInput === projectSearchQuery) return;
    const timeoutId = window.setTimeout(() => {
      updateSearchParams({ q: searchInput });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [projectSearchQuery, searchInput, updateSearchParams]);

  // Real backend API call using TanStack Query
  const projectsQuery = useInfiniteQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ pageParam }) =>
      projectsApi.list({ cursor: pageParam ?? undefined, limit: PROJECT_PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasNext ? (lastPage.nextCursor ?? undefined) : undefined,
  });

  const projects = useMemo(
    () => projectsQuery.data?.pages.flatMap((page) => page.content) ?? [],
    [projectsQuery.data],
  );

  const totalCount = projects.length;
  const activeCount = projects.filter((project) => project.status === "ACTIVE").length;
  const draftCount = projects.filter((project) => project.status === "DRAFT").length;

  const normalizedSearch = searchInput.trim().toLocaleLowerCase("vi");
  const filteredProjects = useMemo(() => {
    let result = projects.filter((project) => {
      const matchesSearch =
        !normalizedSearch || project.name.toLocaleLowerCase("vi").includes(normalizedSearch);
      if (projectFilterTab === "active") return matchesSearch && project.status === "ACTIVE";
      if (projectFilterTab === "draft") return matchesSearch && project.status === "DRAFT";
      return matchesSearch;
    });

    // Sorting
    result = [...result].sort((a, b) => {
      if (sortOption === "name") return a.name.localeCompare(b.name, "vi");
      if (sortOption === "oldest") return a.id - b.id;
      return b.id - a.id; // newest default
    });

    return result;
  }, [normalizedSearch, projectFilterTab, projects, sortOption]);

  const handleCardClick = (project: ApiProject) => router.push(`/projects/${project.id}`);

  if (projectsQuery.isPending) {
    return (
      <div className="flex min-h-72 items-center justify-center text-sm text-slate-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-purple-400" />
        Đang tải dự án từ backend…
      </div>
    );
  }

  if (projectsQuery.isError) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center">
        <h3 className="text-base font-semibold text-rose-200">Không tải được danh sách dự án</h3>
        <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-rose-200/70">
          {apiErrorMessage(projectsQuery.error, "Backend API chưa phản hồi.")}
        </p>
        <Button
          onClick={() => projectsQuery.refetch()}
          variant="secondary"
          size="sm"
          className="mt-5"
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Custom Filter Pill Tabs */}
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Lọc dự án">
          <button
            type="button"
            role="tab"
            aria-selected={projectFilterTab === "all"}
            onClick={() => updateSearchParams({ status: "all" })}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              projectFilterTab === "all"
                ? "border border-purple-600/70 bg-purple-950/40 text-purple-200 shadow-md shadow-purple-950/50"
                : "border border-slate-800/80 bg-[#0d1420]/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <span>Tất cả</span>
            <span className="text-slate-500">|</span>
            <span className="rounded-md bg-purple-500/10 px-1.5 py-0.2 text-[11px] text-purple-300">
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={projectFilterTab === "active"}
            onClick={() => updateSearchParams({ status: "active" })}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              projectFilterTab === "active"
                ? "border border-purple-600/70 bg-purple-950/40 text-purple-200 shadow-md shadow-purple-950/50"
                : "border border-slate-800/80 bg-[#0d1420]/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <span>Đang hoạt động</span>
            <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.2 text-[11px] text-emerald-400">
              {activeCount}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={projectFilterTab === "draft"}
            onClick={() => updateSearchParams({ status: "draft" })}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
              projectFilterTab === "draft"
                ? "border border-purple-600/70 bg-purple-950/40 text-purple-200 shadow-md shadow-purple-950/50"
                : "border border-slate-800/80 bg-[#0d1420]/60 text-slate-400 hover:border-slate-700 hover:text-slate-200"
            }`}
          >
            <span>Bản nháp</span>
            <span className="rounded-md bg-slate-800 px-1.5 py-0.2 text-[11px] text-slate-400">
              {draftCount}
            </span>
          </button>
        </div>

        {/* Right: Search, Sort Dropdown & View Mode Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden w-56 lg:block">
            <Input
              aria-label="Tìm kiếm dự án"
              placeholder="Tìm kiếm dự án..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              icon={<Search className="h-4 w-4 text-slate-500" />}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              aria-label="Sắp xếp danh sách dự án"
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as ProjectSortOption)}
              className="appearance-none cursor-pointer rounded-xl border border-slate-800 bg-[#0d1420] px-3.5 py-2 pr-8 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="name">Tên (A-Z)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>

          {/* View Mode Toggle (Grid / List) */}
          <div
            className="flex items-center rounded-xl border border-slate-800 bg-[#090e18] p-0.5"
            aria-label="Chế độ xem"
          >
            <button
              type="button"
              aria-label="Xem dạng lưới"
              aria-pressed={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === "grid"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Xem dạng danh sách"
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
              className={`rounded-lg p-1.5 transition-colors ${
                viewMode === "list"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search */}
      <div className="lg:hidden">
        <Input
          aria-label="Tìm kiếm dự án"
          placeholder="Tìm kiếm dự án..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          icon={<Search className="h-4 w-4 text-slate-500" />}
        />
      </div>

      {/* Project Cards Grid / List */}
      {filteredProjects.length > 0 ? (
        <>
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                : "flex flex-col gap-3"
            }
          >
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={handleCardClick}
                viewMode={viewMode}
              />
            ))}
          </div>

          {projectsQuery.hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="secondary"
                size="sm"
                isLoading={projectsQuery.isFetchingNextPage}
                onClick={() => projectsQuery.fetchNextPage()}
              >
                Tải thêm dự án
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4 rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 py-20 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-purple-800/60 bg-purple-950/60 text-purple-400">
            <FolderKanban className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-200">Không tìm thấy dự án phù hợp</h3>
            <p className="mx-auto max-w-sm text-xs text-slate-400">
              Hãy thử thay đổi bộ lọc/tìm kiếm hoặc tạo thêm dự án mới.
            </p>
          </div>
          {projectsQuery.hasNextPage ? (
            <Button
              onClick={() => projectsQuery.fetchNextPage()}
              variant="secondary"
              size="sm"
              isLoading={projectsQuery.isFetchingNextPage}
            >
              Tải thêm dự án để tìm tiếp
            </Button>
          ) : (
            <Button onClick={() => openWizard(1)} variant="primary" size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Tạo dự án mới
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
