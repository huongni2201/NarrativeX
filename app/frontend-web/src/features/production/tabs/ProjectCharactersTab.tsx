"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Clapperboard,
  Clock,
  FolderSync,
  ImageIcon,
  Library,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { charactersApi } from "@/features/characters/api/characters.api";
import { queryKeys } from "@/lib/query-keys";

interface ProjectCharactersTabProps {
  projectId: number;
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
      className: "border-badge-purple-border bg-badge-purple-bg text-badge-purple",
    };
  }
  if (norm === "SUPPORTING") {
    return {
      label: "Phụ",
      className: "border-badge-blue-border bg-badge-blue-bg text-badge-blue",
    };
  }
  if (norm === "ANTAGONIST") {
    return {
      label: "Phản diện",
      className: "border-badge-orange-border bg-badge-orange-bg text-badge-orange",
    };
  }
  return {
    label: role || "Nhân vật",
    className: "border-badge-slate-border bg-badge-slate-bg text-badge-slate",
  };
}

function statusBadgeStyle(character: { pinnedCharacterVersionId: number | null; status: string }): {
  label: string;
  className: string;
} {
  if (character.status === "ACTIVE" && character.pinnedCharacterVersionId) {
    return {
      label: "Hoàn thiện",
      className: "border-badge-green-border bg-badge-green-bg text-badge-green",
    };
  }
  if (!character.pinnedCharacterVersionId) {
    return {
      label: "Đang viết",
      className: "border-badge-amber-border bg-badge-amber-bg text-badge-amber",
    };
  }
  return {
    label: "Thiếu ảnh",
    className: "border-badge-slate-border bg-badge-slate-bg text-badge-slate",
  };
}

export function ProjectCharactersTab({
  projectId,
  onOpenLibrary,
}: Readonly<ProjectCharactersTabProps>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<RoleFilter>("ALL");

  const projectCharactersQuery = useQuery({
    queryKey: queryKeys.projectCharacters(projectId),
    queryFn: () => charactersApi.listProject(projectId, { limit: 100 }),
  });

  const globalCharactersQuery = useQuery({
    queryKey: queryKeys.characters,
    queryFn: () => charactersApi.list({ limit: 100 }),
  });

  const rawCharacters = useMemo(
    () => projectCharactersQuery.data?.content ?? [],
    [projectCharactersQuery.data?.content],
  );
  const globalCount = globalCharactersQuery.data?.content.length ?? 0;

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
            <h2 id="project-characters-heading" className="text-xl font-bold text-text-primary">
              Nhân vật trong dự án
            </h2>
            <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-text-muted">
              Phạm vi: Project
            </span>
          </div>
          <p className="mt-1 text-sm text-text-muted">
            Các nhân vật được liên kết và sử dụng trong dự án này. Thư viện chung là nguồn chân lý duy nhất.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex items-center gap-2 rounded-xl border border-primary/50 bg-primary-muted px-4 py-2.5 text-xs font-bold text-primary-light transition hover:bg-primary-muted hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Thêm từ thư viện chung</span>
          </button>
          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex items-center gap-2 rounded-xl border border-primary bg-primary px-4 py-2.5 text-xs font-bold text-white transition hover:bg-primary-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Tạo nhân vật mới</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Tìm nhân vật..."
            className="h-10 w-full rounded-xl border border-border bg-surface-input pl-10 pr-4 text-xs text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeFilter === "ALL"
                ? "border border-primary bg-primary-muted text-primary-light"
                : "border border-border bg-surface-card text-text-muted hover:border-border-subtle hover:text-text-primary"
            }`}
          >
            Tất cả
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("MAIN")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeFilter === "MAIN"
                ? "border border-primary bg-primary-muted text-primary-light"
                : "border border-border bg-surface-card text-text-muted hover:border-border-subtle hover:text-text-primary"
            }`}
          >
            Chính
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("SUPPORTING")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeFilter === "SUPPORTING"
                ? "border border-primary bg-primary-muted text-primary-light"
                : "border border-border bg-surface-card text-text-muted hover:border-border-subtle hover:text-text-primary"
            }`}
          >
            Phụ
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("ANTAGONIST")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeFilter === "ANTAGONIST"
                ? "border border-primary bg-primary-muted text-primary-light"
                : "border border-border bg-surface-card text-text-muted hover:border-border-subtle hover:text-text-primary"
            }`}
          >
            Phản diện
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("INCOMPLETE")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeFilter === "INCOMPLETE"
                ? "border border-primary bg-primary-muted text-primary-light"
                : "border border-border bg-surface-card text-text-muted hover:border-border-subtle hover:text-text-primary"
            }`}
          >
            Chưa hoàn thiện
          </button>
          <button
            type="button"
            aria-label="Cài đặt bộ lọc"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-card text-text-muted transition hover:border-border-subtle hover:text-text-primary"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main 2-Column Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_360px] items-start">
        {/* Left Column: Character Cards Grid */}
        <div className="space-y-4">
          {projectCharactersQuery.isPending ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Đang tải nhân vật">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-52 animate-pulse rounded-2xl border border-border bg-surface-card"
                />
              ))}
            </div>
          ) : projectCharactersQuery.isError ? (
            <div className="rounded-2xl border border-danger/40 bg-danger-bg p-6">
              <h3 className="font-semibold text-danger">Không tải được danh sách nhân vật</h3>
              <p className="mt-1 text-xs text-text-muted">
                Không thể kết nối đến máy chủ. Vui lòng thử lại.
              </p>
              <button
                type="button"
                onClick={() => projectCharactersQuery.refetch()}
                className="mt-3 rounded-lg border border-danger/50 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-bg"
              >
                Thử lại
              </button>
            </div>
          ) : rawCharacters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface-card p-12 text-center">
              <UserRound className="mx-auto h-10 w-10 text-text-dim" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-text-primary">Dự án chưa có nhân vật</h3>
              <p className="mt-1 text-xs text-text-muted">
                Thêm hoặc liên kết nhân vật từ thư viện chung để bắt đầu xây dựng cốt truyện.
              </p>
              <button
                type="button"
                onClick={onOpenLibrary}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover"
              >
                <Library className="h-3.5 w-3.5" />
                <span>Mở thư viện chung</span>
              </button>
            </div>
          ) : filteredCharacters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface-card p-10 text-center text-xs text-text-muted">
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
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-surface-card p-4 transition-[background-color,border-color] duration-200 hover:border-primary/60 hover:bg-surface-2"
                  >
                    <div>
                      <div className="flex items-start gap-3">
                        {/* Portrait / Avatar Fallback */}
                        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-elevated text-base font-bold text-text-primary shadow-md group-hover:border-primary/50 transition-colors">
                          <span className="font-semibold tracking-wider text-primary-light">
                            {character.canonicalName.slice(0, 1).toLocaleUpperCase("vi")}
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 via-transparent to-surface-3/30 pointer-events-none" />
                        </div>

                        {/* Name & Role */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <h3 className="truncate text-sm font-bold text-text-primary group-hover:text-primary-light transition-colors">
                              {character.canonicalName}
                            </h3>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              className="rounded p-0.5 text-text-dim hover:text-text-primary transition-colors"
                              aria-label="Tùy chọn"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-1 flex items-center gap-1.5">
                            <span
                              className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold ${roleBadge.className}`}
                            >
                              {roleBadge.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Snippet Description */}
                      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-text-secondary min-h-[32px]">
                        {aliasText}
                      </p>

                      {/* Status Badge */}
                      <div className="mt-3">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusBadge.className}`}
                        >
                          {statusBadge.label}
                        </span>
                      </div>
                    </div>

                    {/* Card Footer: Scenes & Assets Counts */}
                    <div className="mt-4 flex items-center justify-between border-t border-border/80 pt-3 text-[11px] text-text-muted">
                      <div className="flex items-center gap-1.5">
                        <Clapperboard className="h-3.5 w-3.5 text-text-dim" />
                        <span className="font-medium text-text-secondary">{character.sceneCount} Scenes</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ImageIcon className="h-3.5 w-3.5 text-text-dim" />
                        <span className="font-medium text-text-secondary">
                          {character.pinnedCharacterVersionId ? 1 : 0} Assets
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
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/70 pt-4 text-xs text-text-muted">
              <span>
                Hiển thị 1–{filteredCharacters.length} của {totalCount} nhân vật
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-card text-text-dim disabled:opacity-40"
                  aria-label="Trang trước"
                >
                  &lt;
                </button>
                <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/50 bg-primary-muted font-bold text-primary-light">
                  1
                </span>
                <button
                  type="button"
                  disabled
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-card text-text-dim disabled:opacity-40"
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
          <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-text-primary">Liên kết với thư viện chung</h3>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary-muted text-primary">
                <Library className="h-6 w-6" />
              </div>
              <div>
                <div className="text-2xl font-black text-text-primary">{globalCount}</div>
                <div className="text-xs text-text-muted">Nhân vật trong thư viện chung</div>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-text-secondary">
              Nguồn chân lý duy nhất cho tất cả nhân vật. Mọi thay đổi sẽ được đồng bộ với dự án.
            </p>

            <button
              type="button"
              onClick={onOpenLibrary}
              className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs font-semibold text-text-primary transition hover:border-primary/50 hover:bg-surface-3"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5 text-primary-light" />
                <span>Mở thư viện chung</span>
              </span>
              <span>➔</span>
            </button>
          </div>

          {/* Widget 2: Thống kê trong dự án */}
          <div className="rounded-2xl border border-border bg-surface-card p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-text-primary">Thống kê trong dự án</h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-2 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-badge-green-border bg-badge-green-bg text-badge-green">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-text-primary">{inUseCount}</span>{" "}
                    <span className="text-text-secondary">Đang sử dụng</span>
                  </div>
                </div>
                <span className="font-bold text-text-muted">{inUsePercent}%</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-2 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-badge-amber-border bg-badge-amber-bg text-badge-amber">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-text-primary">{incompleteCount}</span>{" "}
                    <span className="text-text-secondary">Chưa hoàn thiện</span>
                  </div>
                </div>
                <span className="font-bold text-text-muted">{incompletePercent}%</span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-2 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-badge-purple-border bg-badge-purple-bg text-badge-purple">
                    <FolderSync className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold text-text-primary">{unlinkedCount}</span>{" "}
                    <span className="text-text-secondary">Chưa liên kết thư viện</span>
                  </div>
                </div>
                <span className="font-bold text-text-muted">{unlinkedPercent}%</span>
              </div>
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-xs font-semibold text-text-secondary transition hover:bg-surface-3 hover:text-text-primary"
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-text-dim" />
                <span>Xem báo cáo chi tiết</span>
              </span>
              <span>➔</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
