"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Clapperboard,
  MapPin,
  MoreHorizontal,
  Plus,
  Scroll,
  Search,
  SlidersHorizontal,
  UserMinus,
  UserRound,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { charactersApi } from "@/features/characters/api/characters.api";
import { queryKeys } from "@/lib/query-keys";
import { apiErrorMessage } from "@/shared/api/client";
import type { ProjectId } from "@/types/api";

interface ProjectCharactersTabProps {
  projectId: ProjectId;
  onOpenLibrary: () => void;
}

type RoleFilter = "ALL" | "MAIN" | "SUPPORTING" | "ANTAGONIST" | "INCOMPLETE";

function normalizeRole(role: string): "MAIN" | "SUPPORTING" | "ANTAGONIST" | "OTHER" {
  const normalized = role.trim().toUpperCase();
  if (normalized === "MAIN" || normalized === "PROTAGONIST" || normalized === "CHÍNH") return "MAIN";
  if (normalized === "SUPPORTING" || normalized === "SECONDARY" || normalized === "PHỤ") return "SUPPORTING";
  if (normalized === "ANTAGONIST" || normalized === "VILLAIN" || normalized === "PHẢN DIỆN" || normalized === "ĐỐI TRỌNG") return "ANTAGONIST";
  return "OTHER";
}

function roleBadgeStyle(role: string): { label: string; className: string } {
  const norm = normalizeRole(role);
  if (norm === "MAIN") {
    return {
      label: "Chính",
      className: "border-badge-orange-border/50 bg-badge-orange-bg text-badge-orange",
    };
  }
  if (norm === "SUPPORTING") {
    return {
      label: "Phụ",
      className: "border-badge-blue-border/50 bg-badge-blue-bg text-badge-blue",
    };
  }
  if (norm === "ANTAGONIST") {
    return {
      label: "Phản diện",
      className: "border-badge-orange-border/50 bg-badge-orange-bg text-badge-orange",
    };
  }
  return {
    label: role || "Nhân vật",
    className: "border-badge-slate-border/50 bg-badge-slate-bg text-badge-slate",
  };
}

function statusBadgeStyle(character: { pinnedCharacterVersionId: string | null; status: string }): {
  label: string;
  className: string;
} {
  if (character.status === "ACTIVE" && character.pinnedCharacterVersionId) {
    return {
      label: "Hoàn thiện",
      className: "border-badge-green-border/50 bg-badge-green-bg text-badge-green",
    };
  }
  if (!character.pinnedCharacterVersionId) {
    return {
      label: "Đang viết",
      className: "border-badge-amber-border/50 bg-badge-amber-bg text-badge-amber",
    };
  }
  return {
    label: "Thiếu ảnh",
    className: "border-badge-slate-border/50 bg-badge-slate-bg text-badge-slate",
  };
}

export function ProjectCharactersTab({
  projectId,
  onOpenLibrary,
}: Readonly<ProjectCharactersTabProps>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<RoleFilter>("ALL");
  const [linkOpen, setLinkOpen] = useState(false);
  const queryClient = useQueryClient();

  const projectCharactersQuery = useQuery({
    queryKey: queryKeys.projectCharacters(projectId),
    queryFn: () => charactersApi.listProject(projectId, { limit: 100 }),
  });

  const globalCharacterCountQuery = useQuery({
    queryKey: ["characters", "count"],
    queryFn: () => charactersApi.count(),
  });
  const globalCharactersQuery = useQuery({
    queryKey: ["characters", "project-picker"],
    queryFn: () => charactersApi.list({ limit: 100 }),
    enabled: linkOpen,
  });
  const assignMutation = useMutation({
    mutationFn: (characterId: string) =>
      charactersApi.assignToProject(projectId, { characterId, role: "SUPPORTING" }),
    onSuccess: async () => {
      setLinkOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.projectCharacters(projectId) });
    },
  });

  const rawCharacters = useMemo(
    () => projectCharactersQuery.data?.content ?? [],
    [projectCharactersQuery.data?.content],
  );
  const globalCount = globalCharacterCountQuery.data ?? 0;

  // Real-time statistics from real API data
  const totalCount = rawCharacters.length;
  const inUseCount = rawCharacters.filter((c) => c.status === "ACTIVE").length;
  const incompleteCount = rawCharacters.filter((c) => !c.pinnedCharacterVersionId).length;
  const unlinkedCount = rawCharacters.filter((c) => !c.workspaceId).length;

  const inUsePercent = totalCount > 0 ? Math.round((inUseCount / totalCount) * 100) : 0;
  const incompletePercent = totalCount > 0 ? Math.round((incompleteCount / totalCount) * 100) : 0;
  const unlinkedPercent = totalCount > 0 ? Math.round((unlinkedCount / totalCount) * 100) : 0;

  const filteredCharacters = useMemo(() => {
    let result = rawCharacters;

    if (activeFilter === "MAIN") {
      result = result.filter((c) => normalizeRole(c.role) === "MAIN");
    } else if (activeFilter === "SUPPORTING") {
      result = result.filter((c) => normalizeRole(c.role) === "SUPPORTING");
    } else if (activeFilter === "ANTAGONIST") {
      result = result.filter((c) => normalizeRole(c.role) === "ANTAGONIST");
    } else if (activeFilter === "INCOMPLETE") {
      result = result.filter((c) => !c.pinnedCharacterVersionId || c.status !== "ACTIVE");
    }

    const query = searchQuery.trim().toLocaleLowerCase("vi");
    if (query) {
      result = result.filter((character) => {
        const searchable = [
          character.canonicalName,
          character.role,
          ...character.aliases,
          ...character.projectAliases,
          ...character.groups,
        ]
          .join(" ")
          .toLocaleLowerCase("vi");
        return searchable.includes(query);
      });
    }

    return result;
  }, [rawCharacters, activeFilter, searchQuery]);

  return (
    <section className="space-y-6" aria-labelledby="project-characters-heading">
      {/* Header Section */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 id="project-characters-heading" className="text-xl sm:text-2xl font-extrabold text-white">
              Nhân vật trong dự án
            </h2>
            <span className="rounded-md border border-slate-700/60 bg-slate-800/60 px-3 py-1 text-xs font-semibold text-slate-300">
              Phạm vi: Project
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-300">
            Các nhân vật được liên kết và sử dụng trong dự án này. Thư viện chung là nguồn chân lý duy nhất.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-primary/60 bg-primary-muted px-4 py-2.5 text-sm font-semibold text-primary-light hover:bg-primary-muted-strong hover:text-white transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm từ thư viện chung</span>
          </button>
          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors shadow-md shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo nhân vật mới</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Toolbar: grouped side-by-side */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64 md:w-72">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm nhân vật..."
            className="h-10 w-full rounded-xl border border-slate-800 bg-surface-card pl-10 pr-3 text-sm text-slate-200 placeholder:text-slate-500 outline-none transition focus:border-primary/80"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={`rounded-lg px-3.5 py-2 text-sm transition-colors ${
              activeFilter === "ALL"
                ? "border border-primary/80 bg-primary-muted text-primary-light font-semibold"
                : "border border-slate-800 bg-surface-card/80 text-slate-300 hover:text-white hover:border-slate-700"
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("MAIN")}
            className={`rounded-lg px-3.5 py-2 text-sm transition-colors ${
              activeFilter === "MAIN"
                ? "border border-primary/80 bg-primary-muted text-primary-light font-semibold"
                : "border border-slate-800 bg-surface-card/80 text-slate-300 hover:text-white hover:border-slate-700"
            }`}
          >
            Chính
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("SUPPORTING")}
            className={`rounded-lg px-3.5 py-2 text-sm transition-colors ${
              activeFilter === "SUPPORTING"
                ? "border border-primary/80 bg-primary-muted text-primary-light font-semibold"
                : "border border-slate-800 bg-surface-card/80 text-slate-300 hover:text-white hover:border-slate-700"
            }`}
          >
            Phụ
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("ANTAGONIST")}
            className={`rounded-lg px-3.5 py-2 text-sm transition-colors ${
              activeFilter === "ANTAGONIST"
                ? "border border-primary/80 bg-primary-muted text-primary-light font-semibold"
                : "border border-slate-800 bg-surface-card/80 text-slate-300 hover:text-white hover:border-slate-700"
            }`}
          >
            Phản diện
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("INCOMPLETE")}
            className={`rounded-lg px-3.5 py-2 text-sm transition-colors ${
              activeFilter === "INCOMPLETE"
                ? "border border-primary/80 bg-primary-muted text-primary-light font-semibold"
                : "border border-slate-800 bg-surface-card/80 text-slate-300 hover:text-white hover:border-slate-700"
            }`}
          >
            Chưa hoàn thiện
          </button>
          <button
            type="button"
            aria-label="Cài đặt bộ lọc"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-surface-card text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main 2-Column Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px] items-start">
        {/* Left Column: Character Cards Grid */}
        <div className="space-y-4">
          {projectCharactersQuery.isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Đang tải nhân vật">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-48 animate-pulse rounded-2xl border border-slate-800 bg-surface-card"
                />
              ))}
            </div>
          ) : projectCharactersQuery.isError ? (
            <div className="rounded-2xl border border-danger/40 bg-danger-bg p-6">
              <h3 className="font-semibold text-danger">Không tải được danh sách nhân vật</h3>
              <p className="mt-1 text-sm text-text-muted">
                Không thể kết nối đến máy chủ. Vui lòng thử lại.
              </p>
              <button
                type="button"
                onClick={() => projectCharactersQuery.refetch()}
                className="mt-3 rounded-lg border border-danger/50 px-3.5 py-2 text-xs font-semibold text-danger hover:bg-danger-bg"
              >
                Thử lại
              </button>
            </div>
          ) : rawCharacters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-surface-card p-12 text-center">
              <UserRound className="mx-auto h-12 w-12 text-slate-600" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-white">Dự án chưa có nhân vật</h3>
              <p className="mt-1 text-sm text-slate-400">
                Thêm hoặc liên kết nhân vật từ thư viện chung để bắt đầu xây dựng cốt truyện.
              </p>
              <button
                type="button"
                onClick={onOpenLibrary}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
              >
                <BookOpen className="h-4 w-4" />
                <span>Mở thư viện chung</span>
              </button>
            </div>
          ) : filteredCharacters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-surface-card p-10 text-center text-sm text-slate-400">
              Không tìm thấy nhân vật nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCharacters.map((character) => {
                const roleBadge = roleBadgeStyle(character.role);
                const statusBadge = statusBadgeStyle(character);
                const aliasText =
                  character.projectAliases.length > 0
                    ? character.projectAliases.join(", ")
                    : character.aliases.length > 0
                      ? character.aliases.join(", ")
                      : character.groups.length > 0
                        ? character.groups.join(", ")
                        : `Vai trò ${roleBadge.label} trong dự án.`;

                return (
                  <Link
                    key={character.assignmentId}
                    href={`/projects/${projectId}/characters/${character.id}`}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800/80 bg-surface-card p-4 transition-all duration-200 hover:border-slate-700 hover:bg-surface-2 shadow-lg"
                  >
                    <div className="flex items-start gap-3.5">
                      {/* Left: Avatar image / fallback */}
                      <div className="relative w-24 h-28 sm:w-28 sm:h-32 shrink-0 rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80 flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-slate-900 flex items-center justify-center">
                          <span className="text-2xl font-black text-slate-400 transition-colors group-hover:text-primary-light select-none">
                            {character.canonicalName.slice(0, 1).toLocaleUpperCase("vi")}
                          </span>
                        </div>
                      </div>

                      {/* Right: Character Info */}
                      <div className="min-w-0 flex-1 flex flex-col justify-between h-full py-0.5">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h3 className="truncate text-base font-bold text-slate-100 transition-colors group-hover:text-primary-light">
                              {character.canonicalName}
                            </h3>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              className="p-1 -mr-1 -mt-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800/60 transition-colors"
                              aria-label="Tùy chọn"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-1">
                            <span
                              className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-semibold ${roleBadge.className}`}
                            >
                              {roleBadge.label}
                            </span>
                          </div>

                          <p className="mt-2 line-clamp-2 text-sm text-slate-300 leading-relaxed min-h-[36px]">
                            {aliasText}
                          </p>
                        </div>

                        <div className="mt-2.5">
                          <span
                            className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${statusBadge.className}`}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom metrics */}
                    <div className="mt-3.5 pt-3 border-t border-slate-800/60 flex items-center justify-between text-sm text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clapperboard className="h-4 w-4 text-slate-500" />
                        <span className="font-medium text-slate-300">{character.sceneCount} Scenes</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <UserRound className="h-4 w-4 text-slate-500" />
                        <span className="font-medium text-slate-300">
                          {character.pinnedCharacterVersionId ? "Đã pin version" : "Chưa pin version"}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination Footer */}
          {filteredCharacters.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/60 pt-4 text-sm text-slate-400">
              <span>
                Hiển thị 1–{filteredCharacters.length} của {totalCount} nhân vật
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-surface-card text-slate-500 disabled:opacity-40"
                  aria-label="Trang trước"
                >
                  &lt;
                </button>
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/80 bg-primary-muted font-bold text-primary-light">
                  1
                </span>
                <button
                  type="button"
                  disabled
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-surface-card text-slate-500 disabled:opacity-40"
                  aria-label="Trang sau"
                >
                  &gt;
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Sidebar Widgets */}
        <div className="space-y-4">
          {/* Widget 1: Liên kết với thư viện chung */}
          <div className="rounded-2xl border border-slate-800/80 bg-surface-card p-5 space-y-4">
            <h3 className="text-base font-bold text-white">Liên kết với thư viện chung</h3>

            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-badge-orange-border/60 bg-badge-orange-bg text-badge-orange">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <div className="text-3xl font-bold text-white leading-tight">{globalCount}</div>
                <div className="text-sm text-slate-300">Nhân vật trong thư viện chung</div>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-slate-300">
              Nguồn chân lý duy nhất cho tất cả nhân vật. Mọi thay đổi sẽ được đồng bộ với dự án.
            </p>

            <button
              type="button"
              onClick={onOpenLibrary}
              className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-surface-2 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-primary/50 hover:bg-surface-3 hover:text-white"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary-light" />
                <span>Mở thư viện chung</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          {/* Widget 2: Thống kê trong dự án */}
          <div className="rounded-2xl border border-slate-800/80 bg-surface-card p-5 space-y-4">
            <h3 className="text-base font-bold text-white">Thống kê trong dự án</h3>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-surface-2 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-badge-green-border bg-badge-green-bg text-badge-green shrink-0">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-base leading-tight">{inUseCount}</div>
                    <div className="text-xs sm:text-sm text-slate-300">Đang sử dụng</div>
                  </div>
                </div>
                <span className="font-semibold text-slate-200 text-sm">{inUsePercent}%</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-surface-2 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-badge-amber-border bg-badge-amber-bg text-badge-amber shrink-0">
                    <Scroll className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-base leading-tight">{incompleteCount}</div>
                    <div className="text-xs sm:text-sm text-slate-300">Chưa hoàn thiện</div>
                  </div>
                </div>
                <span className="font-semibold text-slate-200 text-sm">{incompletePercent}%</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-surface-2 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-badge-red-border bg-badge-red-bg text-badge-red shrink-0">
                    <UserMinus className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-base leading-tight">{unlinkedCount}</div>
                    <div className="text-xs sm:text-sm text-slate-300">Chưa liên kết thư viện</div>
                  </div>
                </div>
                <span className="font-semibold text-slate-200 text-sm">{unlinkedPercent}%</span>
              </div>
            </div>

            <p className="flex items-center gap-2 rounded-xl border border-slate-800 bg-surface-2 px-4 py-3 text-sm text-slate-400">
              <BarChart3 className="h-4 w-4 text-primary-light" />
              Báo cáo chi tiết sẽ khả dụng khi backend cung cấp metrics chuyên sâu.
            </p>
          </div>
        </div>
      </div>

      {linkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4" role="dialog" aria-modal="true" aria-labelledby="project-character-picker-title">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-surface-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="project-character-picker-title" className="text-lg font-semibold text-text-primary">Thêm nhân vật vào project</h2>
                <p className="mt-1 text-sm text-text-secondary">Chọn một identity từ thư viện chung.</p>
              </div>
              <button type="button" onClick={() => setLinkOpen(false)} className="rounded-lg px-2 py-1 text-text-muted hover:bg-surface-2" aria-label="Đóng">×</button>
            </div>
            {globalCharactersQuery.isPending ? <p className="text-sm text-text-secondary">Đang tải thư viện…</p> : null}
            {globalCharactersQuery.isError ? <p className="rounded-lg border border-danger/30 bg-danger-bg/20 px-3 py-2 text-sm text-danger">{apiErrorMessage(globalCharactersQuery.error, "Không tải được thư viện nhân vật.")}</p> : null}
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {(globalCharactersQuery.data?.content ?? []).map((character) => (
                <button key={character.id} type="button" onClick={() => assignMutation.mutate(character.id)} disabled={assignMutation.isPending} className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3 text-left hover:border-primary/60 disabled:opacity-50">
                  <span><span className="block text-sm font-semibold text-text-primary">{character.canonicalName}</span><span className="text-xs text-text-muted">{character.aliases.join(", ") || "Chưa có alias"}</span></span>
                  <span className="text-xs font-semibold text-primary-light">Thêm</span>
                </button>
              ))}
            </div>
            {!globalCharactersQuery.isPending && (globalCharactersQuery.data?.content ?? []).length === 0 ? <p className="text-sm text-text-secondary">Thư viện chưa có nhân vật. Hãy tạo nhân vật ở thư viện chung.</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}
