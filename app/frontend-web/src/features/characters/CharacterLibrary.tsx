import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useStudioStore } from "@/store/useStudioStore";
import { CharacterCard } from "./CharacterCard";
import { CharacterListView } from "./CharacterListView";
import { Button } from "@/components/ui/Button";
import {
  Search,
  Plus,
  Users,
  Folder,
  SlidersHorizontal,
  LayoutGrid,
  List,
  ChevronDown,
  X,
  Shield,
  RotateCcw,
} from "lucide-react";
import { isMockDataMode } from "@/lib/data-mode";
import {
  MOCK_CHARACTERS,
  MOCK_PROJECT_CHARACTERS,
  MOCK_PROJECTS,
  MOCK_GROUPS,
} from "@/lib/mock-data";
import { api } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { Project } from "@/types/studio";

export const CharacterLibrary: React.FC = () => {
  const {
    characterFilterProject,
    setCharacterFilterProject,
    characterFilterRole,
    setCharacterFilterRole,
    characterFilterGender,
    setCharacterFilterGender,
    characterFilterStatus,
    setCharacterFilterStatus,
    characterFilterGroup,
    setCharacterFilterGroup,
    characterFilterCategoryTab,
    setCharacterFilterCategoryTab,
    characterSortBy,
    setCharacterSortBy,
    characterViewMode,
    setCharacterViewMode,
    isMoreFiltersOpen,
    setIsMoreFiltersOpen,
    characterAdvancedFilters,
    setCharacterAdvancedFilters,
    resetCharacterFilters,
    characterSearchQuery,
    setCharacterSearchQuery,
    openCharacterBible,
  } = useStudioStore();

  const projectsQuery = useQuery({ queryKey: queryKeys.projects, queryFn: api.listProjects });
  const serverProjects = projectsQuery.data ?? [];
  const projects: Project[] = useMemo(() => {
    if (serverProjects.length > 0) {
      return serverProjects.map((p) => ({
        id: String(p.id),
        title: p.name,
        name: p.name,
        description: "",
        updatedAt: "Vừa xong",
        progress: 50,
        isFavorite: false,
        coverImage: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop",
        genre: "Fantasy",
        language: p.sourceLanguage || "Tiếng Việt",
        aspectRatio: (p.imageAspectRatio as any) || "16:9",
        quality: "High",
        characterCount: 12,
        locationCount: 8,
        chapterCount: 6,
        sceneCount: 30,
        visualBeatsCount: 60,
      }));
    }
    return isMockDataMode ? MOCK_PROJECTS : [];
  }, [serverProjects]);

  const characters = isMockDataMode ? MOCK_CHARACTERS : [];
  const projectCharacters = isMockDataMode ? MOCK_PROJECT_CHARACTERS : [];
  const groups = isMockDataMode ? MOCK_GROUPS : [];

  // Thống kê số lượng
  const stats = useMemo(() => {
    const total = characters.length;
    const inUse = characters.filter((c) => {
      const isLocked = c.latestVersion.status === "LOCKED";
      const status = c.status || (isLocked ? "IN_USE" : "DRAFT");
      return status === "IN_USE" || status === "ACTIVE";
    }).length;
    const draft = characters.filter((c) => {
      const isLocked = c.latestVersion.status === "LOCKED";
      const status = c.status || (isLocked ? "IN_USE" : "DRAFT");
      return status === "DRAFT";
    }).length;
    const archived = characters.filter((c) => c.status === "ARCHIVED").length;
    const acrossProjects = projects.length;

    // Tabs counts
    const mainCount = characters.filter(
      (c) => c.roleCategory === "main" || ((c as any).role && (c as any).role.includes("chính"))
    ).length;
    const supportingCount = characters.filter(
      (c) =>
        c.roleCategory === "supporting" ||
        ((c as any).role &&
          ((c as any).role.includes("phụ") ||
            (c as any).role.includes("Pháp sư") ||
            (c as any).role.includes("Quân sư")))
    ).length;
    const minorCount = characters.filter(
      (c) =>
        c.roleCategory === "minor" ||
        ((c as any).role &&
          ((c as any).role.includes("quần chúng") ||
            (c as any).role.includes("Cung Thủ") ||
            (c as any).role.includes("Y giả")))
    ).length;

    return {
      total: isMockDataMode ? 128 : total,
      inUse: isMockDataMode ? 96 : inUse,
      draft: isMockDataMode ? 18 : draft,
      archived: isMockDataMode ? 14 : archived,
      acrossProjects: isMockDataMode ? 12 : acrossProjects,
      mainCount: isMockDataMode ? 38 : mainCount,
      supportingCount: isMockDataMode ? 54 : supportingCount,
      minorCount: isMockDataMode ? 36 : minorCount,
      groupsCount: isMockDataMode ? 12 : groups.length,
    };
  }, [characters, projects, groups]);

  // Filter and Sort Characters
  const filteredCharacters = useMemo(() => {
    let list = characters.filter((c) => {
      // Tìm kiếm văn bản
      const query = characterSearchQuery.trim().toLowerCase();
      const assignment = projectCharacters.find((pc) => pc.characterId === c.id);
      const project = projects.find(
        (p) => String(p.id) === (assignment?.projectId || (c as any).projectId)
      );

      const matchesSearch =
        !query ||
        c.name.toLowerCase().includes(query) ||
        c.canonicalIdentity.toLowerCase().includes(query) ||
        (c.description && c.description.toLowerCase().includes(query)) ||
        (c.group && c.group.toLowerCase().includes(query)) ||
        (c.aliases ?? []).some((alias) => alias.toLowerCase().includes(query)) ||
        (assignment && assignment.role.toLowerCase().includes(query)) ||
        (project && (project.name || project.title || "").toLowerCase().includes(query));

      // Lọc theo Dự án
      const matchesProject =
        characterFilterProject === "all" ||
        (assignment && assignment.projectId === characterFilterProject) ||
        (c as any).projectId === characterFilterProject;

      // Lọc theo Vai trò
      const matchesRole =
        characterFilterRole === "all" ||
        (characterFilterRole === "main" && (c.roleCategory === "main" || assignment?.role.includes("chính"))) ||
        (characterFilterRole === "supporting" && (c.roleCategory === "supporting" || assignment?.role.includes("Pháp sư") || assignment?.role.includes("Thánh nữ") || assignment?.role.includes("Cấm Vệ Quân") || assignment?.role.includes("Quân sư"))) ||
        (characterFilterRole === "minor" && (c.roleCategory === "minor" || assignment?.role.includes("Cung Thủ") || assignment?.role.includes("Cuồng nộ") || assignment?.role.includes("Y giả")));

      // Lọc theo Giới tính
      const matchesGender =
        characterFilterGender === "all" ||
        (characterFilterGender === "female" && (c.gender === "Nữ" || c.gender === "Female")) ||
        (characterFilterGender === "male" && (c.gender === "Nam" || c.gender === "Male")) ||
        (characterFilterGender === "other" && c.gender !== "Nữ" && c.gender !== "Nam" && c.gender !== "Female" && c.gender !== "Male");

      // Lọc theo Trạng thái
      const isLocked = c.latestVersion.status === "LOCKED";
      const actualStatus = c.status || (isLocked ? "IN_USE" : "DRAFT");
      const matchesStatus =
        characterFilterStatus === "all" ||
        (characterFilterStatus === "in_use" && (actualStatus === "IN_USE" || actualStatus === "ACTIVE")) ||
        (characterFilterStatus === "draft" && actualStatus === "DRAFT") ||
        (characterFilterStatus === "archived" && actualStatus === "ARCHIVED") ||
        (characterFilterStatus === "locked" && isLocked);

      // Lọc theo Nhóm
      const matchesGroup =
        characterFilterGroup === "all" ||
        c.group === characterFilterGroup ||
        (assignment && assignment.groups.includes(characterFilterGroup));

      // Lọc theo Category Tab
      const matchesCategoryTab =
        characterFilterCategoryTab === "all" ||
        characterFilterCategoryTab === "groups" ||
        (characterFilterCategoryTab === "main" && (c.roleCategory === "main" || assignment?.role.includes("chính"))) ||
        (characterFilterCategoryTab === "supporting" && (c.roleCategory === "supporting" || assignment?.role.includes("Pháp sư") || assignment?.role.includes("Thánh nữ") || assignment?.role.includes("Cấm Vệ Quân") || assignment?.role.includes("Quân sư"))) ||
        (characterFilterCategoryTab === "minor" && (c.roleCategory === "minor" || assignment?.role.includes("Cung Thủ") || assignment?.role.includes("Cuồng nộ") || assignment?.role.includes("Y giả")));

      // Bộ lọc nâng cao
      const matchesAdvanced =
        (!characterAdvancedFilters.onlyLocked || isLocked) &&
        (!characterAdvancedFilters.hasReferences || (c.referenceAssets && c.referenceAssets.length > 0)) &&
        (!characterAdvancedFilters.minAppearances || (c.appearancesCount ?? 0) >= characterAdvancedFilters.minAppearances);

      return (
        matchesSearch &&
        matchesProject &&
        matchesRole &&
        matchesGender &&
        matchesStatus &&
        matchesGroup &&
        matchesCategoryTab &&
        matchesAdvanced
      );
    });

    // Sắp xếp danh sách
    list = [...list].sort((a, b) => {
      if (characterSortBy === "name_asc") {
        return a.name.localeCompare(b.name);
      }
      if (characterSortBy === "name_desc") {
        return b.name.localeCompare(a.name);
      }
      if (characterSortBy === "most_used") {
        return (b.appearancesCount ?? 0) - (a.appearancesCount ?? 0);
      }
      if (characterSortBy === "version") {
        return b.latestVersion.versionNumber - a.latestVersion.versionNumber;
      }
      // default: recent
      return (b.latestVersion.versionNumber) - (a.latestVersion.versionNumber);
    });

    return list;
  }, [
    characters,
    projectCharacters,
    projects,
    characterSearchQuery,
    characterFilterProject,
    characterFilterRole,
    characterFilterGender,
    characterFilterStatus,
    characterFilterGroup,
    characterFilterCategoryTab,
    characterAdvancedFilters,
    characterSortBy,
  ]);

  const hasActiveFilters =
    characterFilterProject !== "all" ||
    characterFilterRole !== "all" ||
    characterFilterGender !== "all" ||
    characterFilterStatus !== "all" ||
    characterFilterGroup !== "all" ||
    characterSearchQuery.trim() !== "" ||
    characterAdvancedFilters.onlyLocked ||
    characterAdvancedFilters.hasReferences ||
    characterAdvancedFilters.minAppearances;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Tiêu đề */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
            Thư viện nhân vật
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý nhân vật và diện mạo của họ trên tất cả các dự án của bạn.
          </p>
        </div>

        <Button
          onClick={() => openCharacterBible("char-1")}
          variant="primary"
          className="shadow-[0_0_20px_rgba(124,58,237,0.35)] flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tạo nhân vật</span>
        </Button>
      </div>

      {/* 2. Thanh bộ lọc & điều khiển (Filter Bar) */}
      <div className="bg-[#0b101c]/90 p-3 rounded-2xl border border-slate-800/80 backdrop-blur-md shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Phía trái: Tìm kiếm và các dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[300px]">
          {/* Ô tìm kiếm */}
          <div className="relative w-full sm:w-56 lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Tìm kiếm nhân vật..."
              value={characterSearchQuery}
              onChange={(e) => setCharacterSearchQuery(e.target.value)}
              className="w-full bg-[#111827] border border-slate-700/70 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
            {characterSearchQuery && (
              <button
                type="button"
                onClick={() => setCharacterSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lọc Dự án */}
          <div className="relative">
            <select
              value={characterFilterProject}
              onChange={(e) => setCharacterFilterProject(e.target.value)}
              className="bg-[#111827] border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer hover:border-slate-600 transition-colors"
            >
              <option value="all">Tất cả dự án</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.title}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>

          {/* Lọc Vai trò */}
          <div className="relative">
            <select
              value={characterFilterRole}
              onChange={(e) => setCharacterFilterRole(e.target.value)}
              className="bg-[#111827] border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer hover:border-slate-600 transition-colors"
            >
              <option value="all">Tất cả vai trò</option>
              <option value="main">Nhân vật chính</option>
              <option value="supporting">Nhân vật phụ</option>
              <option value="minor">Phụ / Quần chúng</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>

          {/* Lọc Giới tính */}
          <div className="relative">
            <select
              value={characterFilterGender}
              onChange={(e) => setCharacterFilterGender(e.target.value)}
              className="bg-[#111827] border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer hover:border-slate-600 transition-colors"
            >
              <option value="all">Tất cả giới tính</option>
              <option value="female">Nữ</option>
              <option value="male">Nam</option>
              <option value="other">Khác</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>

          {/* Lọc Trạng thái */}
          <div className="relative">
            <select
              value={characterFilterStatus}
              onChange={(e) => setCharacterFilterStatus(e.target.value)}
              className="bg-[#111827] border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer hover:border-slate-600 transition-colors"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="in_use">Đang sử dụng</option>
              <option value="draft">Bản nháp</option>
              <option value="archived">Lưu trữ</option>
              <option value="locked">Đã khóa</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>

          {/* Lọc Nhóm */}
          <div className="relative">
            <select
              value={characterFilterGroup}
              onChange={(e) => setCharacterFilterGroup(e.target.value)}
              className="bg-[#111827] border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer hover:border-slate-600 transition-colors"
            >
              <option value="all">Tất cả nhóm</option>
              {groups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>

          {/* Nút Bộ lọc nâng cao */}
          <button
            type="button"
            onClick={() => setIsMoreFiltersOpen(!isMoreFiltersOpen)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
              isMoreFiltersOpen || characterAdvancedFilters.onlyLocked || characterAdvancedFilters.hasReferences
                ? "bg-purple-900/40 text-purple-300 border-purple-600/60 shadow-[0_0_12px_rgba(124,58,237,0.25)]"
                : "bg-[#111827] text-slate-300 border-slate-700/70 hover:border-slate-600 hover:text-white"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Bộ lọc nâng cao</span>
          </button>

          {/* Nút Đặt lại khi có bộ lọc */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetCharacterFilters}
              className="px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors ml-1"
              title="Đặt lại toàn bộ bộ lọc"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>

        {/* Phía phải: Sắp xếp và Chuyển chế độ xem */}
        <div className="flex items-center gap-3">
          {/* Dropdown Sắp xếp */}
          <div className="relative">
            <select
              value={characterSortBy}
              onChange={(e) => setCharacterSortBy(e.target.value as any)}
              className="bg-[#111827] border border-slate-700/70 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 appearance-none pr-8 cursor-pointer hover:border-slate-600"
            >
              <option value="recent">Sắp xếp: Cập nhật gần đây</option>
              <option value="name_asc">Sắp xếp: Tên (A - Z)</option>
              <option value="name_desc">Sắp xếp: Tên (Z - A)</option>
              <option value="most_used">Sắp xếp: Xuất hiện nhiều nhất</option>
              <option value="version">Sắp xếp: Phiên bản</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>

          {/* Chuyển đổi Lưới / Danh sách */}
          <div className="flex items-center bg-[#111827] border border-slate-700/70 rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setCharacterViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                characterViewMode === "grid"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Chế độ lưới"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setCharacterViewMode("list")}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                characterViewMode === "list"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Chế độ danh sách"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Drawer Bộ lọc nâng cao */}
      {isMoreFiltersOpen && (
        <div className="bg-[#0d1422] border border-purple-900/50 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-purple-400" />
              Bộ lọc nâng cao
            </h4>
            <button
              type="button"
              onClick={() => setIsMoreFiltersOpen(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={!!characterAdvancedFilters.onlyLocked}
                onChange={(e) =>
                  setCharacterAdvancedFilters({ onlyLocked: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
              />
              <span>Chỉ hiện phiên bản nhân vật đã khóa</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={!!characterAdvancedFilters.hasReferences}
                onChange={(e) =>
                  setCharacterAdvancedFilters({ hasReferences: e.target.checked })
                }
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-purple-500"
              />
              <span>Có ảnh mẫu tham chiếu (Concept Images)</span>
            </label>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Số cảnh tối thiểu:</span>
              <input
                type="number"
                min={0}
                max={100}
                value={characterAdvancedFilters.minAppearances ?? ""}
                onChange={(e) =>
                  setCharacterAdvancedFilters({
                    minAppearances: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                placeholder="0"
                className="w-16 bg-[#111827] border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. Thẻ thống kê (Metrics Cards) & Top Projects Chart */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Tổng số nhân vật */}
        <div
          onClick={() => {
            setCharacterFilterStatus("all");
            setCharacterFilterCategoryTab("all");
          }}
          className="bg-[#0b101c]/90 border border-slate-800/80 hover:border-purple-500/40 rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] cursor-pointer relative overflow-hidden group"
        >
          <div>
            <p className="text-xs font-medium text-slate-400">Tổng số nhân vật</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-100 mt-2 font-mono tracking-tight">
              {stats.total}
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 text-slate-500 group-hover:text-purple-400 transition-colors">
            <span className="text-[10px]">Toàn bộ không gian làm việc</span>
            <Users className="w-5 h-5 text-purple-400/80" />
          </div>
        </div>

        {/* Card 2: Đang sử dụng */}
        <div
          onClick={() => setCharacterFilterStatus("in_use")}
          className="bg-[#0b101c]/90 border border-slate-800/80 hover:border-emerald-500/40 rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] cursor-pointer group"
        >
          <div>
            <p className="text-xs font-medium text-slate-400">Đang sử dụng</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-100 font-mono tracking-tight">
                {stats.inUse}
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 group-hover:text-emerald-400 transition-colors">
            Đang dùng trong sản xuất
          </p>
        </div>

        {/* Card 3: Bản nháp */}
        <div
          onClick={() => setCharacterFilterStatus("draft")}
          className="bg-[#0b101c]/90 border border-slate-800/80 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] cursor-pointer group"
        >
          <div>
            <p className="text-xs font-medium text-slate-400">Bản nháp</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-100 font-mono tracking-tight">
                {stats.draft}
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 group-hover:text-amber-400 transition-colors">
            Đang chờ tạo
          </p>
        </div>

        {/* Card 4: Lưu trữ */}
        <div
          onClick={() => setCharacterFilterStatus("archived")}
          className="bg-[#0b101c]/90 border border-slate-800/80 hover:border-slate-600 rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-[0_0_20px_rgba(148,163,184,0.1)] cursor-pointer group"
        >
          <div>
            <p className="text-xs font-medium text-slate-400">Lưu trữ</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-100 font-mono tracking-tight">
                {stats.archived}
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-3 group-hover:text-slate-300 transition-colors">
            Đã lưu trữ
          </p>
        </div>

        {/* Card 5: Qua các dự án */}
        <div
          onClick={() => setCharacterFilterProject("all")}
          className="bg-[#0b101c]/90 border border-slate-800/80 hover:border-indigo-500/40 rounded-2xl p-4 flex flex-col justify-between transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] cursor-pointer group"
        >
          <div>
            <p className="text-xs font-medium text-slate-400">Qua các dự án</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-100 mt-2 font-mono tracking-tight">
              {stats.acrossProjects}
            </p>
          </div>
          <div className="flex items-center justify-between mt-3 text-slate-500 group-hover:text-indigo-400 transition-colors">
            <span className="text-[10px]">Vũ trụ đang hoạt động</span>
            <Folder className="w-5 h-5 text-indigo-400/80" />
          </div>
        </div>

        {/* Card 6: Dự án hàng đầu & Biểu đồ Donut */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-1 bg-[#0b101c]/90 border border-slate-800/80 rounded-2xl p-3.5 flex items-center justify-between gap-2 shadow-lg">
          {/* Danh sách các dự án tiêu biểu */}
          <div className="space-y-1.5 flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-300">Dự án hàng đầu</p>
            <div className="space-y-1 text-[10px]">
              <div
                onClick={() => setCharacterFilterProject("proj-tlk")}
                className="flex items-center justify-between gap-1 text-slate-300 hover:text-blue-400 cursor-pointer truncate"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-[#38bdf8] shrink-0" />
                  <span className="truncate">The Last Kingdom</span>
                </div>
                <span className="font-mono font-semibold text-slate-200">42</span>
              </div>

              <div
                onClick={() => setCharacterFilterProject("proj-ec")}
                className="flex items-center justify-between gap-1 text-slate-300 hover:text-amber-400 cursor-pointer truncate"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-[#facc15] shrink-0" />
                  <span className="truncate">Eclipse Chronicles</span>
                </div>
                <span className="font-mono font-semibold text-slate-200">28</span>
              </div>

              <div
                onClick={() => setCharacterFilterProject("proj-btm")}
                className="flex items-center justify-between gap-1 text-slate-300 hover:text-purple-400 cursor-pointer truncate"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2 h-2 rounded-full bg-[#c084fc] shrink-0" />
                  <span className="truncate">Beyond The Mountains</span>
                </div>
                <span className="font-mono font-semibold text-slate-200">18</span>
              </div>
            </div>
          </div>

          {/* SVG Biểu đồ Donut Chart */}
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
              <circle
                cx="20"
                cy="20"
                r="15.5"
                fill="transparent"
                stroke="#1e293b"
                strokeWidth="4"
              />
              <circle
                cx="20"
                cy="20"
                r="15.5"
                fill="transparent"
                stroke="#38bdf8"
                strokeWidth="4"
                strokeDasharray="46.4 97.4"
                strokeDashoffset="0"
                strokeLinecap="round"
              />
              <circle
                cx="20"
                cy="20"
                r="15.5"
                fill="transparent"
                stroke="#facc15"
                strokeWidth="4"
                strokeDasharray="31 97.4"
                strokeDashoffset="-47.5"
              />
              <circle
                cx="20"
                cy="20"
                r="15.5"
                fill="transparent"
                stroke="#c084fc"
                strokeWidth="4"
                strokeDasharray="20 97.4"
                strokeDashoffset="-79.5"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-[12px] font-bold text-slate-100 leading-none font-mono">
                88
              </span>
              <span className="text-[8px] text-slate-400 scale-90 leading-none mt-0.5">
                Tổng cộng
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Thanh phân loại Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-6 text-xs font-semibold overflow-x-auto pb-px">
        {/* Tab: Tất cả nhân vật */}
        <button
          type="button"
          onClick={() => setCharacterFilterCategoryTab("all")}
          className={`pb-3 transition-colors relative flex items-center gap-2 shrink-0 ${
            characterFilterCategoryTab === "all"
              ? "text-purple-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Tất cả nhân vật</span>
          {characterFilterCategoryTab === "all" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          )}
        </button>

        {/* Tab: Nhân vật chính */}
        <button
          type="button"
          onClick={() => setCharacterFilterCategoryTab("main")}
          className={`pb-3 transition-colors relative flex items-center gap-2 shrink-0 ${
            characterFilterCategoryTab === "main"
              ? "text-purple-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Nhân vật chính</span>
          <span className="px-1.5 py-0.5 rounded-full bg-purple-950 border border-purple-800/60 text-[10px] text-purple-300 font-mono">
            {stats.mainCount}
          </span>
          {characterFilterCategoryTab === "main" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          )}
        </button>

        {/* Tab: Nhân vật phụ */}
        <button
          type="button"
          onClick={() => setCharacterFilterCategoryTab("supporting")}
          className={`pb-3 transition-colors relative flex items-center gap-2 shrink-0 ${
            characterFilterCategoryTab === "supporting"
              ? "text-purple-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Nhân vật phụ</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] text-slate-300 font-mono">
            {stats.supportingCount}
          </span>
          {characterFilterCategoryTab === "supporting" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          )}
        </button>

        {/* Tab: Phụ / Quần chúng */}
        <button
          type="button"
          onClick={() => setCharacterFilterCategoryTab("minor")}
          className={`pb-3 transition-colors relative flex items-center gap-2 shrink-0 ${
            characterFilterCategoryTab === "minor"
              ? "text-purple-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Phụ / Quần chúng</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] text-slate-300 font-mono">
            {stats.minorCount}
          </span>
          {characterFilterCategoryTab === "minor" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          )}
        </button>

        {/* Tab: Nhóm / Phe phái */}
        <button
          type="button"
          onClick={() => setCharacterFilterCategoryTab("groups")}
          className={`pb-3 transition-colors relative flex items-center gap-2 shrink-0 ${
            characterFilterCategoryTab === "groups"
              ? "text-purple-400 font-bold"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <span>Nhóm / Phe phái</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] text-slate-300 font-mono">
            {stats.groupsCount}
          </span>
          {characterFilterCategoryTab === "groups" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
          )}
        </button>
      </div>

      {/* 5. Vùng nội dung chính: Chế độ Xem Nhóm HOẶC Lưới/Danh sách nhân vật */}
      {characterFilterCategoryTab === "groups" ? (
        /* Chế độ xem Nhóm */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const groupMembers = characters.filter((c) => c.group === group.name);

            return (
              <div
                key={group.id}
                onClick={() => {
                  setCharacterFilterGroup(group.name);
                  setCharacterFilterCategoryTab("all");
                }}
                className="bg-[#0b101c] hover:bg-[#0f1726] border border-slate-800/80 hover:border-purple-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-[0_0_25px_rgba(124,58,237,0.18)] space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-950/80 border border-purple-800/60 flex items-center justify-center text-purple-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100">{group.name}</h3>
                      <p className="text-[11px] text-slate-400">{group.count} nhân vật</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-800/40 text-[10px] text-purple-300 font-mono">
                    Đang hoạt động
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {group.description}
                </p>

                {/* Danh sách avatar thành viên */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                  <div className="flex -space-x-2 overflow-hidden">
                    {groupMembers.slice(0, 4).map((member) => (
                      <img
                        key={member.id}
                        src={member.avatarUrl}
                        alt={member.name}
                        className="inline-block h-7 w-7 rounded-full ring-2 ring-[#0b101c] object-cover"
                      />
                    ))}
                  </div>
                  <span className="text-xs text-purple-400 font-medium hover:underline flex items-center gap-1">
                    Xem nhóm →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : filteredCharacters.length > 0 ? (
        characterViewMode === "grid" ? (
          /* Chế độ xem Lưới nhân vật (Grid View) */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {filteredCharacters.map((character) => {
              const assignment = projectCharacters.find(
                (pc) => pc.characterId === character.id
              );
              const project = projects.find(
                (p) => String(p.id) === (assignment?.projectId || (character as any).projectId)
              );

              return (
                <CharacterCard
                  key={character.id}
                  character={character}
                  projectCharacter={assignment}
                  projectName={project?.name || project?.title}
                  onClick={() => openCharacterBible(character.id)}
                />
              );
            })}
          </div>
        ) : (
          /* Chế độ xem Bảng danh sách (List View) */
          <CharacterListView
            characters={filteredCharacters}
            projectCharacters={projectCharacters}
            projects={projects}
            onSelectCharacter={(id) => openCharacterBible(id)}
          />
        )
      ) : (
        /* Trạng thái trống (Empty State) */
        <div className="py-16 text-center bg-[#0b101c]/60 rounded-2xl border border-slate-800/80 p-8 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400 shadow-[0_0_20px_rgba(124,58,237,0.25)]">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-slate-200">
              Không tìm thấy nhân vật nào phù hợp
            </h3>
            <p className="text-xs text-slate-400">
              Không có nhân vật nào khớp với tiêu chí tìm kiếm và bộ lọc hiện tại của bạn. Hãy thử điều chỉnh bộ lọc hoặc tạo nhân vật mới.
            </p>
          </div>
          {hasActiveFilters && (
            <Button
              size="sm"
              variant="secondary"
              onClick={resetCharacterFilters}
              className="inline-flex items-center gap-1.5 text-xs mt-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Đặt lại tất cả bộ lọc</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
