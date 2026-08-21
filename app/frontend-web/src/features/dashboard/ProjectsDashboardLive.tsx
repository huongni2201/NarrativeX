"use client";

import { useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BookOpen, Clock, Film, Loader2, Search, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiErrorMessage } from "@/shared/api/client";
import { projectDashboardApi } from "@/features/projects/api/project-dashboard.api";
import type {
  ApiProjectDashboardItem,
  ProjectDashboardSort,
  ProjectDashboardStatus,
} from "@/features/projects/api/project-dashboard.types";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

type Filter = "ALL" | ProjectDashboardStatus;

function duration(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function date(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(parsed);
}

function ProjectCard({ project }: Readonly<{ project: ApiProjectDashboardItem }>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const favoriteMutation = useMutation({
    mutationFn: () =>
      project.isStarred
        ? projectDashboardApi.unfavorite(project.id)
        : projectDashboardApi.favorite(project.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-dashboard"] }),
  });

  return (
    <article
      onClick={() => router.push(`/projects/${project.id}`)}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-800 bg-[#0b111c] transition hover:border-purple-500/60"
    >
      <div className="relative aspect-video bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-950">
        {project.coverImageUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(project.coverImageUrl).slice(1, -1)})` }}
          />
        ) : null}
        <div className="absolute left-3 top-3 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300">
          {project.status === "ACTIVE" ? "Đang hoạt động" : "Bản nháp"}
        </div>
        <button
          type="button"
          aria-label={project.isStarred ? "Bỏ yêu thích" : "Yêu thích dự án"}
          disabled={favoriteMutation.isPending}
          onClick={(event) => {
            event.stopPropagation();
            favoriteMutation.mutate();
          }}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/50 text-slate-300 hover:text-amber-400 disabled:opacity-50"
        >
          <Star className={`h-4 w-4 ${project.isStarred ? "fill-amber-400 text-amber-400" : ""}`} />
        </button>
      </div>

      <div className="p-4">
        <h3 className="truncate font-semibold text-slate-100">{project.name}</h3>
        <p className="mt-1 line-clamp-2 min-h-10 text-xs text-slate-400">
          {project.description || "Dự án chưa có mô tả."}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2 border-y border-slate-800 py-3 text-xs">
          <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-slate-500" /><span>{project.metrics.totalChapters}</span></div>
          <div className="flex items-center gap-2"><Film className="h-4 w-4 text-slate-500" /><span>{project.metrics.totalScenes}</span></div>
          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-slate-500" /><span>{duration(project.metrics.estimatedDurationSeconds)}</span></div>
        </div>

        <div className="mt-3 text-[11px] text-slate-500">Cập nhật {date(project.updatedAt)}</div>
      </div>
    </article>
  );
}

export function ProjectsDashboardLive() {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<ProjectDashboardSort>("NEWEST");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const dashboardQuery = useInfiniteQuery({
    queryKey: ["project-dashboard", filter, sort, query],
    queryFn: ({ pageParam }) =>
      projectDashboardApi.list({
        cursor: pageParam ?? undefined,
        limit: PAGE_SIZE,
        status: filter === "ALL" ? undefined : filter,
        q: query || undefined,
        sort,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => (page.hasNext ? page.nextCursor ?? undefined : undefined),
  });

  const projects = useMemo(
    () => dashboardQuery.data?.pages.flatMap((page) => page.content) ?? [],
    [dashboardQuery.data],
  );
  const counts = dashboardQuery.data?.pages[0]?.counts ?? { all: 0, active: 0, draft: 0 };

  if (dashboardQuery.isPending) {
    return <div className="flex min-h-72 items-center justify-center text-slate-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Đang tải dự án…</div>;
  }

  if (dashboardQuery.isError) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center text-rose-200">
        {apiErrorMessage(dashboardQuery.error, "Không tải được danh sách dự án.")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2">
          {(["ALL", "ACTIVE", "DRAFT"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-xl border px-3 py-2 text-xs ${filter === value ? "border-purple-500 bg-purple-950/50 text-purple-200" : "border-slate-800 text-slate-400"}`}
            >
              {value === "ALL" ? `Tất cả (${counts.all})` : value === "ACTIVE" ? `Đang hoạt động (${counts.active})` : `Bản nháp (${counts.draft})`}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="w-64"><Input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm kiếm dự án..." icon={<Search className="h-4 w-4" />} /></div>
          <select value={sort} onChange={(event) => setSort(event.target.value as ProjectDashboardSort)} className="rounded-xl border border-slate-800 bg-[#0d1420] px-3 text-xs text-slate-300">
            <option value="NEWEST">Mới nhất</option>
            <option value="OLDEST">Cũ nhất</option>
            <option value="NAME">Tên (A-Z)</option>
          </select>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 p-12 text-center text-sm text-slate-400">Không tìm thấy dự án phù hợp.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      )}

      {dashboardQuery.hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="secondary" size="sm" isLoading={dashboardQuery.isFetchingNextPage} onClick={() => dashboardQuery.fetchNextPage()}>Tải thêm dự án</Button>
        </div>
      ) : null}
    </div>
  );
}
