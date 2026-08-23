"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Camera,
  Clapperboard,
  Edit3,
  FileText,
  History,
  Image as ImageIcon,
  Share2,
  User,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { charactersApi } from "@/features/characters/api/characters.api";
import { projectsApi } from "@/features/projects/api/projects.api";
import { queryKeys } from "@/lib/query-keys";
import {
  type DetailTab,
  roleBadgeStyle,
} from "./components/detail/character-detail.types";
import { CharacterHeroCard } from "./components/detail/CharacterHeroCard";
import { CharacterOverviewTab } from "./components/detail/CharacterOverviewTab";
import { CharacterVisualsTab } from "./components/detail/CharacterVisualsTab";
import { CharacterAppearancesTab } from "./components/detail/CharacterAppearancesTab";
import { CharacterAssetsTab } from "./components/detail/CharacterAssetsTab";
import { CharacterNotesTab } from "./components/detail/CharacterNotesTab";
import { CharacterHistoryTab } from "./components/detail/CharacterHistoryTab";

interface CharacterDetailViewProps {
  characterId: number;
  projectId?: number;
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

  const globalCharacterQuery = useQuery({
    queryKey: ["characters", "detail", characterId],
    queryFn: () => charactersApi.get(characterId),
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
    if (globalCharacterQuery.isPending) return <CharacterDetailSkeleton />;
    if (globalCharacterQuery.isError) {
      return (
        <div className="rounded-2xl border border-danger/40 bg-danger-bg p-8 text-danger">
          Không tải được nhân vật từ Thư viện chung.
        </div>
      );
    }

    const globalCharacter = globalCharacterQuery.data;
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

  const personalityKeywords = Array.from(
    new Set([
      ...character.groups,
      ...character.projectAliases,
      ...character.aliases,
    ]),
  ).filter((k) => k && k.trim().length > 0);

  const displayKeywords =
    personalityKeywords.length > 0
      ? personalityKeywords
      : [roleBadge.label, character.appearance?.ageState, "Nhất quán"].filter(
          (k): k is string => typeof k === "string" && k.length > 0,
        );

  const coCharacters = (projectCharactersQuery.data?.content ?? [])
    .filter((c) => c.id !== character.id)
    .slice(0, 3);

  const chapters = projectOverviewQuery.data?.chapters ?? [];
  const projectAssets = projectAssetsQuery.data?.content ?? [];
  const assetCount = projectAssets.length;

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

  const shortDescription =
    character.version?.bible ||
    character.appearance?.appearancePrompt ||
    character.version?.visualPrompt ||
    `Nhân vật ${character.canonicalName} đảm nhận vai trò ${roleBadge.label} trong dự án ${projectName}.`;

  return (
    <div className="space-y-6">
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
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3.5 py-2 text-sm font-semibold text-text-primary transition hover:bg-surface-3"
          >
            <Share2 className="h-3.5 w-3.5 text-text-muted" />
            <span>Chia sẻ nhân vật</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-3.5 py-2 text-sm font-bold text-white transition hover:bg-primary-hover shadow-lg shadow-primary/20"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Chỉnh sửa nhân vật</span>
          </button>
        </div>
      </div>

      <CharacterHeroCard
        character={character}
        roleBadge={roleBadge}
        isComplete={isComplete}
        shortDescription={shortDescription}
        assetCount={assetCount}
        completionPercentage={completionPercentage}
      />

      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border pb-3" role="tablist">
        <TabButton id="overview" label="Tổng quan" icon={<User className="h-3.5 w-3.5" />} activeTab={activeTab} onClick={setActiveTab} />
        <TabButton id="visuals" label="Visuals" icon={<Camera className="h-3.5 w-3.5" />} activeTab={activeTab} onClick={setActiveTab} />
        <TabButton id="appearances" label="Xuất hiện" icon={<Clapperboard className="h-3.5 w-3.5" />} activeTab={activeTab} onClick={setActiveTab} />
        <TabButton id="assets" label="Tài sản" icon={<ImageIcon className="h-3.5 w-3.5" />} activeTab={activeTab} onClick={setActiveTab} />
        <TabButton id="notes" label="Ghi chú" icon={<FileText className="h-3.5 w-3.5" />} activeTab={activeTab} onClick={setActiveTab} />
        <TabButton id="history" label="Lịch sử" icon={<History className="h-3.5 w-3.5" />} activeTab={activeTab} onClick={setActiveTab} />
      </div>

      {activeTab === "overview" && (
        <CharacterOverviewTab
          character={character}
          roleBadge={roleBadge}
          shortDescription={shortDescription}
          displayKeywords={displayKeywords}
          coCharacters={coCharacters}
          chapters={chapters}
          promptLines={promptLines}
          onSelectTab={setActiveTab}
        />
      )}

      {activeTab === "visuals" && <CharacterVisualsTab character={character} />}

      {activeTab === "appearances" && (
        <CharacterAppearancesTab
          character={character}
          projectId={projectId}
          chapters={chapters}
        />
      )}

      {activeTab === "assets" && (
        <CharacterAssetsTab
          characterId={character.id}
          versionId={character.pinnedCharacterVersionId}
          versionStatus={character.version?.status ?? null}
          projectAssets={projectAssets}
        />
      )}

      {activeTab === "notes" && <CharacterNotesTab character={character} />}

      {activeTab === "history" && <CharacterHistoryTab character={character} />}
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
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
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
    <div className="space-y-6" aria-label="Đang tải dữ liệu nhân vật">
      <div className="flex justify-between items-center">
        <div className="h-4 w-48 rounded bg-surface-2 animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-28 rounded-lg bg-surface-2 animate-pulse" />
          <div className="h-8 w-36 rounded-lg bg-surface-2 animate-pulse" />
        </div>
      </div>
      <div className="h-64 rounded-2xl border border-border bg-surface-card animate-pulse" />
      <div className="flex gap-2 border-b border-border pb-3">
        {[1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="h-9 w-24 rounded-lg bg-surface-2 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-80 rounded-2xl border border-border bg-surface-card animate-pulse" />
        <div className="h-80 rounded-2xl border border-border bg-surface-card animate-pulse" />
      </div>
    </div>
  );
}
