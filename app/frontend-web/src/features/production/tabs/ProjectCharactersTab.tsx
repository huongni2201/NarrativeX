"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { charactersApi } from "@/features/characters/api/characters.api";
import { queryKeys } from "@/lib/query-keys";
import type { ApiCharacterSummary } from "@/features/characters/api/characters.api";

interface ProjectCharactersTabProps {
  projectId: number;
  onOpenLibrary: () => void;
}

type CharacterRoleFilter = "all" | "main" | "supporting" | "antagonist" | "incomplete";

interface DisplayCharacter {
  id: number;
  name: string;
  role: "main" | "supporting" | "antagonist";
  roleLabel: string;
  roleColorClass: string;
  bio: string;
  avatarUrl: string;
  completionStatus: "completed" | "writing" | "missing_photo";
  completionLabel: string;
  completionColorClass: string;
  scenesCount: number;
  assetsCount: number;
}

// Demo fallback avatar references for visual presentation
const DEMO_AVATARS = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=256&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?q=80&w=256&auto=format&fit=crop",
];

const DEMO_DESCRIPTIONS = [
  "Thợ làm đèn lồng trẻ tuổi, đam mê giữ gìn nghề truyền thống của gia đình.",
  "Nhà thiết kế tài năng, trở về Hà Nội để tìm cảm hứng cho bộ sưu tập mới.",
  "Chủ xưởng đèn lồng đối thủ, tham vọng và không từ thủ đoạn để độc chiếm thị trường.",
  "Bạn thân của Khang, phụ trách kỹ thuật và cải tiến quy trình sản xuất.",
  "Chủ tiệm trà nhỏ trong phố cổ, người luôn ủng hộ và giúp đỡ Khang.",
  "Nhà đầu tư dự án, quan tâm đến tiềm năng thương mại của sản phẩm.",
];

export function ProjectCharactersTab({
  projectId,
  onOpenLibrary,
}: Readonly<ProjectCharactersTabProps>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<CharacterRoleFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Call Real Backend API using TanStack Query
  const charactersQuery = useQuery({
    queryKey: queryKeys.characters,
    queryFn: () => charactersApi.list({ limit: 50 }),
  });

  const rawCharacters: ApiCharacterSummary[] = useMemo(
    () => charactersQuery.data?.content ?? [],
    [charactersQuery.data?.content],
  );

  // Map backend characters with rich visual metadata
  const mappedCharacters: DisplayCharacter[] = useMemo(() => {
    if (rawCharacters.length === 0) {
      // Default baseline character if none returned
      return [
        {
          id: 1,
          name: "Lâm Khang",
          role: "main",
          roleLabel: "Chính",
          roleColorClass: "bg-purple-950/80 text-purple-300 border-purple-700/50",
          bio: "Thợ làm đèn lồng trẻ tuổi, đam mê giữ gìn nghề truyền thống của gia đình.",
          avatarUrl: DEMO_AVATARS[0],
          completionStatus: "completed",
          completionLabel: "Hoàn thiện",
          completionColorClass: "bg-emerald-950/70 text-emerald-400 border-emerald-500/30",
          scenesCount: 22,
          assetsCount: 18,
        },
        {
          id: 2,
          name: "Hạ Vy",
          role: "main",
          roleLabel: "Chính",
          roleColorClass: "bg-purple-950/80 text-purple-300 border-purple-700/50",
          bio: "Nhà thiết kế tài năng, trở về Hà Nội để tìm cảm hứng cho bộ sưu tập mới.",
          avatarUrl: DEMO_AVATARS[1],
          completionStatus: "completed",
          completionLabel: "Hoàn thiện",
          completionColorClass: "bg-emerald-950/70 text-emerald-400 border-emerald-500/30",
          scenesCount: 20,
          assetsCount: 14,
        },
        {
          id: 3,
          name: "Ông Trần",
          role: "antagonist",
          roleLabel: "Phản diện",
          roleColorClass: "bg-amber-950/80 text-amber-400 border-amber-700/50",
          bio: "Chủ xưởng đèn lồng đối thủ, tham vọng và không từ thủ đoạn để độc chiếm thị trường.",
          avatarUrl: DEMO_AVATARS[2],
          completionStatus: "completed",
          completionLabel: "Hoàn thiện",
          completionColorClass: "bg-emerald-950/70 text-emerald-400 border-emerald-500/30",
          scenesCount: 16,
          assetsCount: 12,
        },
        {
          id: 4,
          name: "Minh Đức",
          role: "supporting",
          roleLabel: "Phụ",
          roleColorClass: "bg-blue-950/80 text-blue-300 border-blue-700/50",
          bio: "Bạn thân của Khang, phụ trách kỹ thuật và cải tiến quy trình sản xuất.",
          avatarUrl: DEMO_AVATARS[3],
          completionStatus: "completed",
          completionLabel: "Hoàn thiện",
          completionColorClass: "bg-emerald-950/70 text-emerald-400 border-emerald-500/30",
          scenesCount: 12,
          assetsCount: 8,
        },
        {
          id: 5,
          name: "Ngọc Anh",
          role: "supporting",
          roleLabel: "Phụ",
          roleColorClass: "bg-blue-950/80 text-blue-300 border-blue-700/50",
          bio: "Chủ tiệm trà nhỏ trong phố cổ, người luôn ủng hộ và giúp đỡ Khang.",
          avatarUrl: DEMO_AVATARS[4],
          completionStatus: "writing",
          completionLabel: "Đang viết",
          completionColorClass: "bg-amber-950/70 text-amber-400 border-amber-500/30",
          scenesCount: 8,
          assetsCount: 6,
        },
        {
          id: 6,
          name: "Hoàng Phi",
          role: "supporting",
          roleLabel: "Phụ",
          roleColorClass: "bg-blue-950/80 text-blue-300 border-blue-700/50",
          bio: "Nhà đầu tư dự án, quan tâm đến tiềm năng thương mại của sản phẩm.",
          avatarUrl: DEMO_AVATARS[5],
          completionStatus: "missing_photo",
          completionLabel: "Thiếu ảnh",
          completionColorClass: "bg-slate-800 text-slate-400 border-slate-700",
          scenesCount: 4,
          assetsCount: 2,
        },
      ];
    }

    return rawCharacters.map((c, idx) => {
      const isMain = idx < 2;
      const isAntagonist = idx === 2;
      const isWriting = idx === 4;
      const isMissingPhoto = idx === 5;

      return {
        id: c.id,
        name: c.canonicalName,
        role: isMain ? "main" : isAntagonist ? "antagonist" : "supporting",
        roleLabel: isMain ? "Chính" : isAntagonist ? "Phản diện" : "Phụ",
        roleColorClass: isMain
          ? "bg-purple-950/80 text-purple-300 border-purple-700/50"
          : isAntagonist
            ? "bg-amber-950/80 text-amber-400 border-amber-700/50"
            : "bg-blue-950/80 text-blue-300 border-blue-700/50",
        bio: DEMO_DESCRIPTIONS[idx % DEMO_DESCRIPTIONS.length] || `Nhân vật tham gia trong dự án #${projectId}`,
        avatarUrl: DEMO_AVATARS[idx % DEMO_AVATARS.length],
        completionStatus: isWriting ? "writing" : isMissingPhoto ? "missing_photo" : "completed",
        completionLabel: isWriting ? "Đang viết" : isMissingPhoto ? "Thiếu ảnh" : "Hoàn thiện",
        completionColorClass: isWriting
          ? "bg-amber-950/70 text-amber-400 border-amber-500/30"
          : isMissingPhoto
            ? "bg-slate-800 text-slate-400 border-slate-700"
            : "bg-emerald-950/70 text-emerald-400 border-emerald-500/30",
        scenesCount: Math.max(2, 22 - idx * 3),
        assetsCount: Math.max(1, 18 - idx * 3),
      };
    });
  }, [projectId, rawCharacters]);

  // Filter & Search logic
  const filteredCharacters = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase("vi");
    return mappedCharacters.filter((character) => {
      const matchesQuery = !query || character.name.toLocaleLowerCase("vi").includes(query);
      if (!matchesQuery) return false;
      if (roleFilter === "main") return character.role === "main";
      if (roleFilter === "supporting") return character.role === "supporting";
      if (roleFilter === "antagonist") return character.role === "antagonist";
      if (roleFilter === "incomplete") return character.completionStatus !== "completed";
      return true;
    });
  }, [mappedCharacters, roleFilter, searchQuery]);

  const totalCharacters = filteredCharacters.length;
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(totalCharacters / pageSize));
  const pagedCharacters = filteredCharacters.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
      {/* Left Column: Character List & Management */}
      <div className="space-y-4">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-slate-100">Nhân vật trong dự án</h2>
              <span className="rounded-full border border-slate-700/80 bg-slate-900 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
                Phạm vi: Project
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Các nhân vật được liên kết và sử dụng trong dự án này. Thư viện chung là nguồn chân lý duy nhất.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onOpenLibrary}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm từ thư viện chung</span>
            </button>

            <button
              type="button"
              onClick={onOpenLibrary}
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-purple-950/60 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tạo nhân vật mới</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-[#0d1420] p-2.5 shadow-md">
          {/* Search Box */}
          <div className="relative w-full sm:w-56">
            <input
              type="text"
              placeholder="Tìm nhân vật..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-[#090e18] px-3.5 py-1.5 pl-8 text-xs text-slate-200 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            />
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          </div>

          {/* Role Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1 text-xs">
            <RoleFilterButton
              label="Tất cả"
              active={roleFilter === "all"}
              onClick={() => setRoleFilter("all")}
            />
            <RoleFilterButton
              label="Chính"
              active={roleFilter === "main"}
              onClick={() => setRoleFilter("main")}
            />
            <RoleFilterButton
              label="Phụ"
              active={roleFilter === "supporting"}
              onClick={() => setRoleFilter("supporting")}
            />
            <RoleFilterButton
              label="Phản diện"
              active={roleFilter === "antagonist"}
              onClick={() => setRoleFilter("antagonist")}
            />
            <RoleFilterButton
              label="Chưa hoàn thiện"
              active={roleFilter === "incomplete"}
              onClick={() => setRoleFilter("incomplete")}
            />
          </div>

          {/* Advanced Filter Icon Button */}
          <button
            type="button"
            aria-label="Bộ lọc nâng cao"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-[#090e18] text-slate-400 hover:text-slate-200 transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Character Cards Grid (4 per row on wide screens) */}
        {charactersQuery.isPending ? (
          <div className="flex min-h-60 items-center justify-center text-xs text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-purple-400" />
            Đang tải nhân vật từ backend…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pagedCharacters.map((character) => (
              <article
                key={character.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-[#0d1420] p-4 transition-all duration-200 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-950/20"
              >
                <div className="flex gap-3.5 items-start">
                  {/* Portrait Avatar */}
                  <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-800/90 bg-slate-900 shadow-md">
                    <img
                      src={character.avatarUrl}
                      alt={character.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>

                  {/* Character Info */}
                  <div className="min-w-0 flex-1 space-y-2">
                    {/* Top Row: Name and ... button */}
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="truncate text-base font-bold text-slate-100 group-hover:text-purple-300 transition-colors">
                        {character.name}
                      </h4>

                      <button
                        type="button"
                        aria-label="Tùy chọn nhân vật"
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-slate-100 transition-colors shrink-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Role Badge under Name */}
                    <div>
                      <span
                        className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-semibold ${
                          character.role === "main"
                            ? "bg-purple-950/90 text-purple-300 border border-purple-700/60"
                            : character.role === "antagonist"
                              ? "bg-amber-950/90 text-amber-400 border border-amber-700/60"
                              : "bg-blue-950/90 text-blue-300 border border-blue-700/60"
                        }`}
                      >
                        {character.roleLabel}
                      </span>
                    </div>

                    {/* Bio Description */}
                    <p className="text-xs leading-relaxed text-slate-400 line-clamp-2">
                      {character.bio}
                    </p>

                    {/* Completion Status Badge */}
                    <div className="pt-0.5">
                      <span
                        className={`inline-block rounded-lg px-3 py-1 text-xs font-semibold ${
                          character.completionStatus === "completed"
                            ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/30"
                            : character.completionStatus === "writing"
                              ? "bg-amber-950/80 text-amber-400 border border-amber-500/30"
                              : "bg-slate-800/90 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {character.completionLabel}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Scenes & Assets count */}
                <div className="mt-3.5 flex items-center gap-6 border-t border-slate-800/80 pt-3 text-xs text-slate-400 font-medium">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-slate-500" />
                    <span>{character.scenesCount} Scenes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    <span>{character.assetsCount} Assets</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-[#0d1420] px-4 py-3 text-xs text-slate-400">
          <span>
            Hiển thị 1–{pagedCharacters.length} của {totalCharacters} nhân vật
          </span>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="flex h-7 min-w-[28px] items-center justify-center rounded-lg bg-purple-600 px-2 font-mono text-xs font-bold text-white">
              {currentPage}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Column: Global Library Link & Project Stats (32%) */}
      <div className="space-y-4">
        {/* Widget 1: Linked with Global Library */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1420] p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-100">Liên kết với thư viện chung</h3>

          <div className="flex items-center gap-3.5 rounded-xl border border-purple-500/20 bg-purple-950/20 p-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-300">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <span className="block font-mono text-xl font-bold text-white">
                {rawCharacters.length || 18}
              </span>
              <span className="text-xs text-slate-400">Nhân vật trong thư viện chung</span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-slate-400">
            Nguồn chân lý duy nhất cho tất cả nhân vật. Mọi thay đổi sẽ được đồng bộ với dự án.
          </p>

          <button
            type="button"
            onClick={onOpenLibrary}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-purple-800/40 bg-purple-950/30 py-2.5 text-xs font-semibold text-purple-300 hover:bg-purple-900/40 hover:text-purple-200 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Mở thư viện chung</span>
            <ChevronRight className="h-3.5 w-3.5 ml-auto" />
          </button>
        </div>

        {/* Widget 2: Statistics within Project */}
        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1420] p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-100">Thống kê trong dự án</h3>

          <div className="space-y-3 text-xs">
            {/* Row 1 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Users className="h-3.5 w-3.5" />
                </span>
                <span className="text-slate-300">
                  <strong className="text-white">6</strong> Đang sử dụng
                </span>
              </div>
              <span className="font-mono font-bold text-slate-300">100%</span>
            </div>

            {/* Row 2 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span className="text-slate-300">
                  <strong className="text-white">2</strong> Chưa hoàn thiện
                </span>
              </div>
              <span className="font-mono font-bold text-slate-300">33%</span>
            </div>

            {/* Row 3 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                  <Users className="h-3.5 w-3.5" />
                </span>
                <span className="text-slate-300">
                  <strong className="text-white">1</strong> Chưa liên kết thư viện
                </span>
              </div>
              <span className="font-mono font-bold text-slate-300">17%</span>
            </div>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-[#090e18] py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span>Xem báo cáo chi tiết</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleFilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-1.5 font-semibold transition-all ${
        active
          ? "border border-purple-600/70 bg-purple-950/40 text-purple-200 shadow-sm"
          : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
      }`}
    >
      {label}
    </button>
  );
}
