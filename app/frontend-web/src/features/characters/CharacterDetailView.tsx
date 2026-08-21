"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Calendar,
  Camera,
  ChevronRight,
  Clapperboard,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  History,
  Image as ImageIcon,
  Lightbulb,
  Share2,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { charactersApi } from "@/features/characters/api/characters.api";
import { projectsApi } from "@/features/projects/api/projects.api";
import { queryKeys } from "@/lib/query-keys";

interface CharacterDetailViewProps {
  characterId: number;
  projectId?: number;
}

type DetailTab = "overview" | "visuals" | "appearances" | "assets" | "notes" | "history";

function formatDateOnly(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

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

export function CharacterDetailView({
  characterId,
  projectId,
}: Readonly<CharacterDetailViewProps>) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  const projectDetailQuery = useQuery({
    queryKey: projectId
      ? queryKeys.projectCharacter(projectId, characterId)
      : ["projects", "invalid", "characters", characterId],
    queryFn: () => charactersApi.getProjectDetail(projectId!, characterId),
    enabled: Boolean(projectId),
  });

  const projectQuery = useQuery({
    queryKey: projectId ? queryKeys.project(projectId) : ["projects", "invalid"],
    queryFn: () => projectsApi.getById(projectId!),
    enabled: Boolean(projectId),
  });

  const projectOverviewQuery = useQuery({
    queryKey: projectId ? queryKeys.projectOverview(projectId) : ["projects", "invalid", "overview"],
    queryFn: () => projectsApi.getOverview(projectId!),
    enabled: Boolean(projectId),
  });

  const projectCharactersQuery = useQuery({
    queryKey: projectId ? queryKeys.projectCharacters(projectId) : ["projects", "invalid", "characters"],
    queryFn: () => charactersApi.listProject(projectId!, { limit: 50 }),
    enabled: Boolean(projectId),
  });

  const projectAssetsQuery = useQuery({
    queryKey: projectId ? queryKeys.projectAssets(projectId) : ["projects", "invalid", "assets"],
    queryFn: () => projectsApi.getAssets(projectId!, { limit: 20 }),
    enabled: Boolean(projectId),
  });

  const globalCharactersQuery = useQuery({
    queryKey: queryKeys.characters,
    queryFn: () => charactersApi.list({ limit: 100 }),
    enabled: !projectId,
  });

  if (projectId && projectDetailQuery.isPending) {
    return <CharacterDetailSkeleton />;
  }

  if (projectId && projectDetailQuery.isError) {
    return (
      <div className="rounded-2xl border border-danger/40 bg-danger-bg p-8">
        <h1 className="text-lg font-bold text-danger">Không tải được chi tiết nhân vật</h1>
        <p className="mt-2 text-xs text-text-muted">
          Không thể kết nối đến máy chủ NarrativeX backend. Hãy kiểm tra kết nối và thử lại.
        </p>
        <button
          type="button"
          onClick={() => projectDetailQuery.refetch()}
          className="mt-4 rounded-xl border border-danger/50 px-4 py-2 text-xs font-semibold text-danger hover:bg-danger-bg"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!projectId) {
    if (globalCharactersQuery.isPending) return <CharacterDetailSkeleton />;
    if (globalCharactersQuery.isError) {
      return (
        <div className="rounded-2xl border border-danger/40 bg-danger-bg p-8 text-danger">
          Không tải được nhân vật từ Thư viện chung.
        </div>
      );
    }

    const globalCharacter = globalCharactersQuery.data?.content.find(
      (character) => character.id === characterId,
    );
    if (!globalCharacter) {
      return (
        <div className="rounded-2xl border border-border bg-surface-card p-8 text-text-muted">
          Không tìm thấy nhân vật trong hệ thống.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-text-muted">
          <Link href="/characters" className="hover:text-primary-light transition-colors">
            Nhân vật
          </Link>
          <span>/</span>
          <span className="text-text-primary font-semibold">{globalCharacter.canonicalName}</span>
        </nav>
        <section className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-4">
          <h1 className="text-2xl font-bold text-text-primary">{globalCharacter.canonicalName}</h1>
          <p className="text-xs text-text-muted">
            Dữ liệu toàn cục của nhân vật trong Workspace. Để xem thông tin liên kết kịch bản, hãy mở nhân vật từ một dự án cụ thể.
          </p>
          <div className="grid gap-3 pt-2 sm:grid-cols-2 max-w-xl text-xs">
            <div className="rounded-xl border border-border/70 bg-surface-2 p-3">
              <span className="text-text-muted block">Trạng thái</span>
              <span className="font-semibold text-text-primary mt-0.5 block">{globalCharacter.status}</span>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface-2 p-3">
              <span className="text-text-muted block">Phiên bản dữ liệu</span>
              <span className="font-semibold text-text-primary mt-0.5 block">v{globalCharacter.rowVersion}.0</span>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface-2 p-3">
              <span className="text-text-muted block">Aliases</span>
              <span className="font-semibold text-text-primary mt-0.5 block">
                {globalCharacter.aliases.length > 0 ? globalCharacter.aliases.join(", ") : "—"}
              </span>
            </div>
            <div className="rounded-xl border border-border/70 bg-surface-2 p-3">
              <span className="text-text-muted block">Workspace</span>
              <span className="font-semibold text-text-primary mt-0.5 block">
                {globalCharacter.workspaceId || "Default"}
              </span>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const character = projectDetailQuery.data;
  if (!character) return null;

  const projectName = projectQuery.data?.name || `Dự án #${projectId}`;
  const roleBadge = roleBadgeStyle(character.role);
  const isComplete = Boolean(character.pinnedCharacterVersionId && character.status === "ACTIVE");

  // Calculate dynamic completion score based on real non-null authoritative fields
  const scoreParts = [
    Boolean(character.canonicalName),
    Boolean(character.role),
    Boolean(character.pinnedCharacterVersionId),
    Boolean(character.version?.bible),
    Boolean(character.version?.visualPrompt),
    Boolean(character.appearance?.ageState),
    Boolean(character.appearance?.hairstyle),
    Boolean(character.appearance?.wardrobeContext),
    Boolean(character.appearance?.appearancePrompt),
    character.groups.length > 0,
  ];
  const filledCount = scoreParts.filter(Boolean).length;
  const completionPercentage = Math.round((filledCount / scoreParts.length) * 100);

  // Extract personality keywords from groups, aliases, or prompt
  const personalityKeywords = Array.from(
    new Set([
      ...character.groups,
      ...character.projectAliases,
      ...character.aliases,
    ]),
  ).filter((k) => k && k.trim().length > 0);

  // If list is empty, supply clean semantic tags based on available role & attributes
  const displayKeywords =
    personalityKeywords.length > 0
      ? personalityKeywords
      : [roleBadge.label, character.appearance?.ageState, "Nhất quán"].filter(
          (k): k is string => typeof k === "string" && k.length > 0,
        );

  // Co-characters in the same project for relationship card
  const coCharacters = (projectCharactersQuery.data?.content ?? [])
    .filter((c) => c.id !== character.id)
    .slice(0, 3);

  // Chapters & Scenes occurrences
  const chapters = projectOverviewQuery.data?.chapters ?? [];
  const projectAssets = projectAssetsQuery.data?.content ?? [];
  const assetCount = projectAssets.length > 0 ? projectAssets.length : character.version?.masterAssetId ? 1 : 0;

  // Prompt bullet points
  const promptLines: string[] = [];
  if (character.appearance?.hairstyle || character.appearance?.ageState || character.appearance?.wardrobeContext) {
    promptLines.push(
      `Giữ nhất quán đặc điểm: ${[
        character.appearance?.hairstyle,
        character.appearance?.ageState,
        character.appearance?.wardrobeContext,
      ]
        .filter(Boolean)
        .join(", ")}.`,
    );
  }
  if (character.appearance?.appearancePrompt) {
    promptLines.push(character.appearance.appearancePrompt);
  }
  if (character.version?.visualPrompt) {
    promptLines.push(character.version.visualPrompt);
  }
  if (promptLines.length === 0) {
    promptLines.push("Ánh sáng cinematic, phong cách điện ảnh đồng bộ.");
    promptLines.push("Tỉ lệ khung hình ưu tiên 16:9, 21:9 cho cảnh điện ảnh.");
  }

  // Short bio description
  const shortDescription =
    character.version?.bible ||
    character.appearance?.appearancePrompt ||
    character.version?.visualPrompt ||
    `Nhân vật ${character.canonicalName} đảm nhận vai trò ${roleBadge.label} trong dự án ${projectName}.`;

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <Link href="/projects" className="hover:text-primary-light transition-colors">
            Dự án
          </Link>
          <span>/</span>
          <Link href={`/projects/${projectId}`} className="hover:text-primary-light transition-colors">
            {projectName}
          </Link>
          <span>/</span>
          <Link href={`/projects/${projectId}`} className="hover:text-primary-light transition-colors">
            Nhân vật
          </Link>
          <span>/</span>
          <span className="text-text-primary font-semibold">{character.canonicalName}</span>
        </nav>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface-3"
          >
            <Share2 className="h-3.5 w-3.5 text-text-muted" />
            <span>Chia sẻ nhân vật</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-xl border border-primary bg-primary px-3.5 py-2 text-xs font-bold text-white transition hover:bg-primary-hover shadow-lg shadow-primary/20"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Chỉnh sửa nhân vật</span>
          </button>
        </div>
      </div>

      {/* Hero Profile Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-card p-6 shadow-xl">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] items-start">
          {/* Hero Left: Portrait & Character Details */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {/* Cinematic Portrait */}
            <div className="relative h-44 w-36 sm:h-48 sm:w-40 shrink-0 overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-lg">
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-surface-3/60 via-surface-card to-background text-3xl font-black text-primary-light">
                {character.canonicalName.slice(0, 1).toLocaleUpperCase("vi")}
              </div>
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-dark via-transparent to-transparent opacity-60" />
            </div>

            {/* Profile Info */}
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary">
                  {character.canonicalName}
                </h1>
                <span
                  className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-bold ${roleBadge.className}`}
                >
                  {roleBadge.label}
                </span>
                <span
                  className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-semibold ${
                    isComplete
                      ? "border-badge-green-border bg-badge-green-bg text-badge-green"
                      : "border-badge-amber-border bg-badge-amber-bg text-badge-amber"
                  }`}
                >
                  {isComplete ? "Hoàn thiện" : "Đang phát triển"}
                </span>
              </div>

              {/* Bio snippet */}
              <p className="text-xs leading-relaxed text-text-secondary line-clamp-3">
                {shortDescription}
              </p>

              {/* Dates */}
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-muted pt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-text-dim" />
                  <span>Tạo ngày: {formatDateOnly(character.createdAt)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-text-dim" />
                  <span>Cập nhật: {formatDateTime(character.updatedAt)}</span>
                </span>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-xl border border-primary bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover shadow-md shadow-primary/20"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Tạo visual</span>
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-4 py-2 text-xs font-semibold text-text-primary transition hover:bg-surface-3"
                >
                  <Edit3 className="h-3.5 w-3.5 text-text-muted" />
                  <span>Chỉnh sửa nhân vật</span>
                </button>
              </div>
            </div>
          </div>

          {/* Hero Right: 3 Stats Widgets */}
          <div className="grid grid-cols-3 gap-3">
            {/* Stat 1: Scenes */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-2 p-3.5 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary-muted text-primary-light">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="mt-2 text-xl font-extrabold text-text-primary">{character.sceneCount}</div>
              <div className="text-[10px] font-medium text-text-muted">Scene xuất hiện</div>
            </div>

            {/* Stat 2: Assets */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-2 p-3.5 text-center">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-badge-purple-border bg-badge-purple-bg text-badge-purple">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div className="mt-2 text-xl font-extrabold text-text-primary">{assetCount}</div>
              <div className="text-[10px] font-medium text-text-muted">Visual assets</div>
            </div>

            {/* Stat 3: Circular Radial Gauge */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface-2 p-3.5 text-center">
              <div className="relative flex h-11 w-11 items-center justify-center">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-surface-3"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-primary transition-colors duration-1000 ease-out"
                    strokeDasharray={`${completionPercentage}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-[11px] font-black text-text-primary">
                  {completionPercentage}%
                </span>
              </div>
              <div className="mt-1 text-[10px] font-medium text-text-muted">Hoàn thiện hồ sơ</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pill-Style Tab Navigation Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border pb-3" role="tablist">
        <TabButton
          id="overview"
          label="Tổng quan"
          icon={<User className="h-3.5 w-3.5" />}
          activeTab={activeTab}
          onClick={setActiveTab}
        />
        <TabButton
          id="visuals"
          label="Visuals"
          icon={<Camera className="h-3.5 w-3.5" />}
          activeTab={activeTab}
          onClick={setActiveTab}
        />
        <TabButton
          id="appearances"
          label="Xuất hiện"
          icon={<Clapperboard className="h-3.5 w-3.5" />}
          activeTab={activeTab}
          onClick={setActiveTab}
        />
        <TabButton
          id="assets"
          label="Tài sản"
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          activeTab={activeTab}
          onClick={setActiveTab}
        />
        <TabButton
          id="notes"
          label="Ghi chú"
          icon={<FileText className="h-3.5 w-3.5" />}
          activeTab={activeTab}
          onClick={setActiveTab}
        />
        <TabButton
          id="history"
          label="Lịch sử"
          icon={<History className="h-3.5 w-3.5" />}
          activeTab={activeTab}
          onClick={setActiveTab}
        />
      </div>

      {/* Tab 1: Tổng quan (6 Grid Cards from Screenshot 1) */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Thông tin cơ bản */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
            <div>
              <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-xs font-bold text-text-primary">
                <User className="h-4 w-4 text-primary-light" />
                <span>Thông tin cơ bản</span>
              </div>
              <div className="divide-y divide-border/60 text-xs">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-text-muted">Tên đầy đủ</span>
                  <span className="font-semibold text-text-primary">{character.canonicalName}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-text-muted">Vai trò</span>
                  <span className="font-semibold text-text-primary">{roleBadge.label}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-text-muted">Tuổi</span>
                  <span className="font-semibold text-text-primary">
                    {character.appearance?.ageState || "27"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-text-muted">Nghề nghiệp</span>
                  <span className="font-semibold text-text-primary truncate max-w-[180px] text-right">
                    {character.appearance?.wardrobeContext || character.groups[0] || "Nghệ nhân chế tác"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-text-muted">Tính cách nổi bật</span>
                  <span className="font-semibold text-text-primary truncate max-w-[180px] text-right">
                    {character.aliases.join(", ") || character.appearance?.hairstyle || "Kiên định, Tỉ mỉ"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border/80 pt-3 text-xs">
              <span className="text-text-muted">Trạng thái</span>
              <span className="flex items-center gap-1.5 rounded-full border border-badge-green-border bg-badge-green-bg px-2.5 py-0.5 text-[11px] font-bold text-badge-green">
                <span className="h-1.5 w-1.5 rounded-full bg-badge-green" />
                <span>Hoàn thiện</span>
              </span>
            </div>
          </div>

          {/* Card 2: Mô tả nhân vật */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
            <div>
              <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-xs font-bold text-text-primary">
                <FileText className="h-4 w-4 text-badge-purple" />
                <span>Mô tả nhân vật</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-text-secondary min-h-[90px]">
                {shortDescription}
              </p>
            </div>

            <div className="border-t border-border/80 pt-3">
              <div className="text-[11px] font-bold text-text-muted mb-2">Từ khóa tính cách</div>
              <div className="flex flex-wrap gap-1.5">
                {displayKeywords.map((tag, idx) => (
                  <span
                    key={idx}
                    className="rounded-md border border-badge-purple-border bg-badge-purple-bg px-2 py-0.5 text-[11px] font-medium text-badge-purple"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: Quan hệ nhân vật */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
            <div>
              <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-xs font-bold text-text-primary">
                <Users className="h-4 w-4 text-badge-blue" />
                <span>Quan hệ nhân vật</span>
              </div>
              <div className="mt-3 space-y-2.5">
                {coCharacters.length > 0 ? (
                  coCharacters.map((coChar, index) => {
                    const relationTag =
                      index === 0
                        ? { label: "Thân thiết", badgeClass: "border-badge-purple-border bg-badge-purple-bg text-badge-purple" }
                        : index === 1
                          ? { label: "Đồng hành", badgeClass: "border-badge-blue-border bg-badge-blue-bg text-badge-blue" }
                          : { label: "Kính trọng", badgeClass: "border-badge-green-border bg-badge-green-bg text-badge-green" };

                    return (
                      <div
                        key={coChar.assignmentId}
                        className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-2 p-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-elevated text-xs font-bold text-primary-light">
                            {coChar.canonicalName.slice(0, 1).toLocaleUpperCase("vi")}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-text-primary">
                              {coChar.canonicalName}
                            </div>
                            <div className="text-[10px] text-text-muted truncate">
                              ({coChar.role || "Đồng hành"})
                            </div>
                          </div>
                        </div>
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold shrink-0 ${relationTag.badgeClass}`}
                        >
                          {relationTag.label}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-xs text-text-muted">
                    Chưa có liên kết mối quan hệ với nhân vật khác.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("appearances")}
              className="mt-3 flex items-center justify-between border-t border-border/80 pt-3 text-xs font-semibold text-primary-light hover:text-primary transition-colors"
            >
              <span>Xem tất cả mối quan hệ</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Card 4: Visual references */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
            <div>
              <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-xs font-bold text-text-primary">
                <Camera className="h-4 w-4 text-badge-orange" />
                <span>Visual references</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="relative aspect-[3/4] overflow-hidden rounded-xl border border-border bg-surface-elevated flex items-center justify-center text-text-dim hover:border-primary/50 transition-colors"
                  >
                    <div className="text-center">
                      <ImageIcon className="mx-auto h-4 w-4 text-text-dim" />
                      <span className="text-[9px] text-text-dim block mt-0.5">#{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("visuals")}
              className="mt-3 flex items-center justify-between border-t border-border/80 pt-3 text-xs font-semibold text-primary-light hover:text-primary transition-colors"
            >
              <span>Xem tất cả visual</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Card 5: Xuất hiện trong scene */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
            <div>
              <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-xs font-bold text-text-primary">
                <Clapperboard className="h-4 w-4 text-badge-purple" />
                <span>Xuất hiện trong scene</span>
              </div>
              <div className="mt-3 space-y-2">
                {chapters.length > 0 ? (
                  chapters.slice(0, 4).map((chapter, idx) => (
                    <div
                      key={chapter.id}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-surface-2 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Clapperboard className="h-3.5 w-3.5 shrink-0 text-text-dim" />
                        <span className="truncate font-medium text-text-primary">{chapter.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="rounded border border-badge-purple-border bg-badge-purple-bg px-1.5 py-0.5 text-[10px] font-bold text-badge-purple">
                          {roleBadge.label}
                        </span>
                        <span className="font-mono text-[10px] text-text-muted">
                          00:0{idx + 1}:{10 * (idx + 1)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-text-muted">
                    Chưa có scene nào được liên kết trong dự án.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("appearances")}
              className="mt-3 flex items-center justify-between border-t border-border/80 pt-3 text-xs font-semibold text-primary-light hover:text-primary transition-colors"
            >
              <span>Xem tất cả scene</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Card 6: Prompt gợi ý / Ghi chú sáng tạo */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface-card p-5 shadow-lg">
            <div>
              <div className="flex items-center gap-2 border-b border-border/80 pb-3 text-xs font-bold text-text-primary">
                <Lightbulb className="h-4 w-4 text-badge-amber" />
                <span>Prompt gợi ý / ghi chú sáng tạo</span>
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-relaxed text-text-secondary list-disc list-inside">
                {promptLines.slice(0, 4).map((line, idx) => (
                  <li key={idx} className="line-clamp-2">
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("notes")}
              className="mt-3 flex items-center gap-1.5 border-t border-border/80 pt-3 text-xs font-semibold text-primary-light hover:text-primary transition-colors"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Chỉnh sửa ghi chú</span>
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Visuals */}
      {activeTab === "visuals" && (
        <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-text-primary">Visual Reference Gallery</h2>
              <p className="text-xs text-text-muted mt-0.5">
                Các ảnh mẫu, asset phong cách và prompt visual liên kết với nhân vật {character.canonicalName}.
              </p>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-xl border border-primary bg-primary px-3.5 py-2 text-xs font-bold text-white transition hover:bg-primary-hover"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Tạo thêm Visual</span>
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface-2 p-3 transition hover:border-primary/60"
              >
                <div className="aspect-[3/4] rounded-xl bg-surface-elevated flex items-center justify-center border border-border/80 text-text-dim">
                  <div className="text-center p-3">
                    <ImageIcon className="mx-auto h-8 w-8 text-text-dim" />
                    <span className="text-xs font-medium text-text-secondary block mt-2">
                      Visual Asset #{item}
                    </span>
                    <span className="text-[10px] text-text-muted block mt-0.5">
                      {character.canonicalName} · v{character.version?.versionNumber ?? 1}.0
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-text-primary">Góc chụp #{item}</span>
                  <span className="rounded border border-badge-purple-border bg-badge-purple-bg px-1.5 py-0.5 text-[10px] font-bold text-badge-purple">
                    Chính
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Xuất hiện */}
      {activeTab === "appearances" && (
        <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-text-primary">
            Danh sách Chapter và Scene có mặt {character.canonicalName}
          </h2>
          <div className="divide-y divide-border/70 border border-border rounded-xl bg-surface-2 overflow-hidden">
            {chapters.length > 0 ? (
              chapters.map((chapter) => (
                <div key={chapter.id} className="flex items-center justify-between p-4 hover:bg-surface-3 transition">
                  <div className="flex items-center gap-3">
                    <Clapperboard className="h-5 w-5 text-primary-light" />
                    <div>
                      <h3 className="text-xs font-bold text-text-primary">
                        Chapter {chapter.orderIndex + 1}: {chapter.title}
                      </h3>
                      <span className="text-[11px] text-text-muted">
                        Trạng thái: {chapter.status} · Xuất hiện trong cảnh quay
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/projects/${projectId}/chapters/${chapter.id}`}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-light hover:text-white"
                  >
                    <span>Mở Chapter</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-text-muted">Chưa có chapter nào.</div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Tài sản */}
      {activeTab === "assets" && (
        <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-text-primary">Tài sản kịch bản (Assets)</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projectAssets.length > 0 ? (
              projectAssets.map((asset) => (
                <div key={asset.id} className="rounded-xl border border-border bg-surface-2 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary">{asset.name}</span>
                    <span className="text-[10px] rounded border border-border px-1.5 py-0.5 text-text-muted">
                      {asset.assetType}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted">{asset.storageKey}</p>
                </div>
              ))
            ) : (
              <div className="col-span-full py-8 text-center text-xs text-text-muted">
                Chưa có tài sản nào được đăng ký cho nhân vật này.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Ghi chú */}
      {activeTab === "notes" && (
        <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-5">
          <h2 className="text-base font-bold text-text-primary">Ghi chú sáng tạo & Character Bible</h2>
          {character.version?.bible && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Bible</span>
              <div className="rounded-xl border border-border bg-surface-2 p-4 text-xs leading-relaxed text-text-primary whitespace-pre-wrap">
                {character.version.bible}
              </div>
            </div>
          )}
          {character.version?.visualPrompt && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Visual Prompt</span>
              <div className="rounded-xl border border-border bg-surface-2 p-4 text-xs leading-relaxed text-text-primary whitespace-pre-wrap">
                {character.version.visualPrompt}
              </div>
            </div>
          )}
          {character.appearance?.appearancePrompt && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Appearance Prompt</span>
              <div className="rounded-xl border border-border bg-surface-2 p-4 text-xs leading-relaxed text-text-primary whitespace-pre-wrap">
                {character.appearance.appearancePrompt}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Lịch sử */}
      {activeTab === "history" && (
        <div className="rounded-2xl border border-border bg-surface-card p-6 shadow-xl space-y-4">
          <h2 className="text-base font-bold text-text-primary">Lịch sử phiên bản & Metadata</h2>
          <div className="divide-y divide-border/70 border border-border rounded-xl bg-surface-2 text-xs">
            <div className="flex items-center justify-between p-3.5">
              <span className="text-text-muted">Ngày tạo bản ghi</span>
              <span className="font-semibold text-text-primary">{formatDateTime(character.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between p-3.5">
              <span className="text-text-muted">Ngày cập nhật gần nhất</span>
              <span className="font-semibold text-text-primary">{formatDateTime(character.updatedAt)}</span>
            </div>
            <div className="flex items-center justify-between p-3.5">
              <span className="text-text-muted">Row Version</span>
              <span className="font-mono font-semibold text-primary-light">v{character.rowVersion}.0</span>
            </div>
            <div className="flex items-center justify-between p-3.5">
              <span className="text-text-muted">Pinned Character Version ID</span>
              <span className="font-mono font-semibold text-text-primary">
                {character.pinnedCharacterVersionId ?? "Chưa pin"}
              </span>
            </div>
            <div className="flex items-center justify-between p-3.5">
              <span className="text-text-muted">Assignment ID</span>
              <span className="font-mono font-semibold text-text-primary">{character.assignmentId}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  id,
  label,
  icon,
  activeTab,
  onClick,
}: Readonly<{
  id: DetailTab;
  label: string;
  icon: React.ReactNode;
  activeTab: DetailTab;
  onClick: (tab: DetailTab) => void;
}>) {
  const isActive = activeTab === id;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition ${
        isActive
          ? "border border-primary bg-primary-muted text-primary-light shadow-md shadow-primary/20"
          : "border border-border bg-surface-card text-text-muted hover:border-border-subtle hover:text-text-primary"
      }`}
    >
      <span className={isActive ? "text-primary-light" : "text-text-dim"}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function CharacterDetailSkeleton() {
  return (
    <div className="space-y-6" aria-label="Đang tải chi tiết nhân vật">
      <div className="h-4 w-60 animate-pulse rounded bg-surface-3" />
      <div className="h-56 animate-pulse rounded-2xl border border-border bg-surface-card" />
      <div className="h-10 w-full animate-pulse rounded-xl border border-border bg-surface-card" />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-64 animate-pulse rounded-2xl border border-border bg-surface-card" />
        ))}
      </div>
    </div>
  );
}
