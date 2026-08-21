"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Plus, UploadCloud } from "lucide-react";
import { chaptersApi } from "@/features/chapters/api/chapters.api";
import { projectsApi } from "@/features/projects/api/projects.api";
import { StoryboardScreen } from "@/features/storyboard/StoryboardScreen";
import { queryKeys } from "@/lib/query-keys";
import { ApiClientError, apiErrorMessage } from "@/shared/api/client";
import { ChapterTable } from "./components/ChapterTable";
import { CreateChapterModal, type CreateChapterInput } from "./components/CreateChapterModal";
import { ProjectHero } from "./components/ProjectHero";
import { ProjectTabs } from "./components/ProjectTabs";
import { ProjectSummaryWidget } from "./components/ProjectSummaryWidget";
import { ProjectCharactersTab } from "./tabs/ProjectCharactersTab";
import { ProjectInfoTab } from "./tabs/ProjectInfoTab";
import { ProjectResourcesTab } from "./tabs/ProjectResourcesTab";
import { ProjectSettingsTab } from "./tabs/ProjectSettingsTab";
import type { ProductionTab } from "./production.types";

interface ProductionShellProps {
  projectId?: string;
  initialTab?: ProductionTab;
}

export function ProductionShell({ projectId, initialTab = "chapters" }: Readonly<ProductionShellProps>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const batchImportInputRef = useRef<HTMLInputElement>(null);
  const numericProjectId = projectId ? Number(projectId) : Number.NaN;
  const hasValidProjectId = Number.isSafeInteger(numericProjectId) && numericProjectId > 0;
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [batchImportError, setBatchImportError] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState<ProductionTab>(initialTab);

  const overviewQuery = useQuery({
    queryKey: hasValidProjectId
      ? queryKeys.projectOverview(numericProjectId)
      : ["projects", "invalid", "overview"],
    queryFn: () => projectsApi.getOverview(numericProjectId),
    enabled: hasValidProjectId,
  });

  const projectQuery = useQuery({
    queryKey: hasValidProjectId ? queryKeys.project(numericProjectId) : ["projects", "invalid"],
    queryFn: () => projectsApi.getById(numericProjectId),
    enabled: hasValidProjectId,
  });

  const storyQuery = useQuery({
    queryKey: hasValidProjectId ? queryKeys.story(numericProjectId) : ["stories", "invalid"],
    queryFn: async () => {
      try {
        return await projectsApi.getLatestStoryVersion(numericProjectId);
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 404) return null;
        throw error;
      }
    },
    enabled: hasValidProjectId,
  });

  const locationsQuery = useQuery({
    queryKey: hasValidProjectId
      ? queryKeys.projectLocations(numericProjectId)
      : ["projects", "invalid", "locations"],
    queryFn: () => projectsApi.getLocations(numericProjectId),
    enabled: hasValidProjectId && activeTab === "locations",
  });

  const assetsQuery = useQuery({
    queryKey: hasValidProjectId
      ? queryKeys.projectAssets(numericProjectId)
      : ["projects", "invalid", "assets"],
    queryFn: () => projectsApi.getAssets(numericProjectId),
    enabled: hasValidProjectId && activeTab === "assets",
  });

  const chapters = useMemo(
    () => overviewQuery.data?.chapters ?? [],
    [overviewQuery.data?.chapters],
  );
  const nextOrderIndex =
    chapters.length === 0 ? 0 : Math.max(...chapters.map((chapter) => chapter.orderIndex)) + 1;

  const createChapter = useMutation({
    mutationFn: async ({ title, sourceText }: CreateChapterInput) => {
      const normalizedTitle = title.trim();
      const normalizedSource = sourceText.trim();

      let storyVersion = storyQuery.data;
      if (!storyVersion) {
        const project = projectQuery.data;
        if (!project) throw new Error("Project chưa sẵn sàng.");
        storyVersion = await projectsApi.createStoryVersion(numericProjectId, {
          content: normalizedSource,
          sourceLanguage: project.sourceLanguage,
        });
        queryClient.setQueryData(queryKeys.story(numericProjectId), storyVersion);
      }

      return chaptersApi.create(numericProjectId, {
        storyVersionId: storyVersion.id,
        orderIndex: nextOrderIndex,
        title: normalizedTitle,
        sourceText: normalizedSource,
      });
    },
    onSuccess: (createdChapter) => {
      setFormError(null);
      setFormOpen(false);
      setFormResetKey((key) => key + 1);
      queryClient.invalidateQueries({ queryKey: queryKeys.projectOverview(numericProjectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      router.push(`/projects/${numericProjectId}/chapters/${createdChapter.id}`);
    },
    onError: (error) => {
      setFormError(apiErrorMessage(error, "Không thể tạo Chapter."));
    },
  });

  const batchImport = useMutation({
    mutationFn: async (file: File) => {
      let storyVersion = storyQuery.data;
      if (!storyVersion) {
        const project = projectQuery.data;
        if (!project) throw new Error("Project chưa sẵn sàng.");
        storyVersion = await projectsApi.createStoryVersion(numericProjectId, {
          content: "Batch imported chapters",
          sourceLanguage: project.sourceLanguage,
        });
        queryClient.setQueryData(queryKeys.story(numericProjectId), storyVersion);
      }
      return chaptersApi.batchImport(numericProjectId, storyVersion.id, file);
    },
    onSuccess: () => {
      setBatchImportError(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.projectOverview(numericProjectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
    onError: (error) => {
      setBatchImportError(apiErrorMessage(error, "Không thể batch import file."));
    },
  });

  if (!hasValidProjectId) {
    return <WorkspaceError error={new Error("ID dự án không hợp lệ.")} fallback="ID dự án không hợp lệ." />;
  }

  if (overviewQuery.isPending || projectQuery.isPending || storyQuery.isPending) {
    return <WorkspaceMessage>Đang tải dữ liệu project từ backend…</WorkspaceMessage>;
  }
  if (overviewQuery.isError) {
    return <WorkspaceError error={overviewQuery.error} fallback="Không tải được Project Overview." />;
  }
  if (projectQuery.isError) {
    return <WorkspaceError error={projectQuery.error} fallback="Không tải được project." />;
  }
  if (storyQuery.isError) {
    return <WorkspaceError error={storyQuery.error} fallback="Không tải được Story Version." />;
  }

  const overview = overviewQuery.data;
  const project = projectQuery.data;
  const continueChapter =
    chapters.find((chapter) => chapter.status !== "RENDERED") ?? chapters.at(-1) ?? null;

  const continueProject = () => {
    if (continueChapter) {
      router.push(`/projects/${numericProjectId}/chapters/${continueChapter.id}`);
      return;
    }
    setFormOpen(true);
  };

  const openChapter = (chapterId: number) => {
    router.push(`/projects/${numericProjectId}/chapters/${chapterId}`);
  };

  const selectBatchImportFile = () => {
    setBatchImportError(null);
    batchImportInputRef.current?.click();
  };

  const tabBreadcrumbLabel =
    activeTab === "characters"
      ? "Nhân vật"
      : activeTab === "storyboard"
        ? "Storyboard"
        : activeTab === "locations"
          ? "Địa điểm"
          : activeTab === "assets"
            ? "Tài sản"
            : activeTab === "settings"
              ? "Cài đặt"
              : null;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/projects" className="hover:text-purple-300 transition-colors font-medium">
          Dự án
        </Link>
        <span className="text-slate-600">/</span>
        <button
          type="button"
          onClick={() => setActiveTab("chapters")}
          className={`hover:text-purple-300 transition-colors font-semibold ${
            tabBreadcrumbLabel ? "text-slate-400" : "text-slate-200"
          }`}
        >
          {project.name}
        </button>
        {tabBreadcrumbLabel && (
          <>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200 font-semibold">{tabBreadcrumbLabel}</span>
          </>
        )}
      </div>

      {/* Top Project Hero Banner */}
      <ProjectHero
        project={overview}
        metrics={overview.metrics}
        continueChapter={continueChapter}
        onContinue={continueProject}
        onOpenInfo={() => setActiveTab("info")}
      />

      {/* Project Navigation Tabs */}
      <ProjectTabs activeTab={activeTab} onChange={setActiveTab} />

      {/* Main Tab Content */}
      {activeTab === "chapters" && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
          {/* Left Column: Chapters Table Card */}
          <div className="rounded-2xl border border-slate-800/90 bg-[#0d1420] shadow-xl overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 p-5">
              <h2 className="text-base font-bold text-slate-100">Danh sách chapter</h2>

              <div className="flex items-center gap-2.5">
                <input
                  ref={batchImportInputRef}
                  type="file"
                  accept=".txt,.md,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (file) batchImport.mutate(file);
                  }}
                />

                <button
                  type="button"
                  onClick={selectBatchImportFile}
                  disabled={batchImport.isPending}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3.5 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-3 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UploadCloud className="h-3.5 w-3.5 text-purple-400" />
                  <span>{batchImport.isPending ? "Đang import…" : "Import nhiều chapter"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-primary bg-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-primary-hover"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Chapter</span>
                </button>
              </div>
            </div>

            {batchImportError && (
              <div className="m-4 rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">
                {batchImportError}
              </div>
            )}

            <ChapterTable
              chapters={chapters}
              onOpenChapter={(chapter) => openChapter(chapter.id)}
            />
          </div>

          {/* Right Column: Project Summary Widget */}
          <ProjectSummaryWidget metrics={overview.metrics} />
        </div>
      )}

      {activeTab === "storyboard" && (
        <div className="rounded-2xl border border-slate-800/90 bg-[#0d1420] p-4 sm:p-6 shadow-xl">
          <StoryboardScreen projectId={numericProjectId} chapters={chapters} />
        </div>
      )}

      {activeTab === "characters" && (
        <ProjectCharactersTab
          projectId={numericProjectId}
          onOpenLibrary={() => router.push("/characters")}
        />
      )}

      {activeTab === "info" && <ProjectInfoTab project={project} />}
      {activeTab === "locations" && (
        <ProjectResourcesTab
          kind="locations"
          locations={locationsQuery.data?.content}
          isLoading={locationsQuery.isPending}
          errorMessage={
            locationsQuery.isError
              ? apiErrorMessage(locationsQuery.error, "Không tải được Locations.")
              : null
          }
        />
      )}
      {activeTab === "assets" && (
        <ProjectResourcesTab
          kind="assets"
          assets={assetsQuery.data?.content}
          isLoading={assetsQuery.isPending}
          errorMessage={
            assetsQuery.isError ? apiErrorMessage(assetsQuery.error, "Không tải được Assets.") : null
          }
        />
      )}
      {activeTab === "settings" && <ProjectSettingsTab />}

      <CreateChapterModal
        isOpen={formOpen}
        nextChapterNumber={chapters.length + 1}
        isSubmitting={createChapter.isPending}
        error={formError}
        resetKey={formResetKey}
        onClose={() => setFormOpen(false)}
        onSubmit={(input) => createChapter.mutate(input)}
      />
    </div>
  );
}

function WorkspaceError({ error, fallback }: Readonly<{ error: unknown; fallback: string }>) {
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-sm text-rose-200">
      {apiErrorMessage(error, fallback)}
    </div>
  );
}

function WorkspaceMessage({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#0d1420]/50 p-8 text-sm text-slate-300">
      {children}
    </div>
  );
}
