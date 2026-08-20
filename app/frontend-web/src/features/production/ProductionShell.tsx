"use client";

import { useMemo, useRef, useState } from "react";
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
import { ProjectInfoTab } from "./tabs/ProjectInfoTab";
import { ProjectResourcesTab } from "./tabs/ProjectResourcesTab";
import { ProjectSettingsTab } from "./tabs/ProjectSettingsTab";
import type { ProductionTab } from "./production.types";

interface ProductionShellProps {
  projectId?: string;
}

export function ProductionShell({ projectId }: Readonly<ProductionShellProps>) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const batchImportInputRef = useRef<HTMLInputElement>(null);
  const numericProjectId = projectId ? Number(projectId) : Number.NaN;
  const hasValidProjectId = Number.isSafeInteger(numericProjectId) && numericProjectId > 0;
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [batchImportError, setBatchImportError] = useState<string | null>(null);
  const [formResetKey, setFormResetKey] = useState(0);
  const [activeTab, setActiveTab] = useState<ProductionTab>("chapters");

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
    onSuccess: (chapter) => {
      setFormError(null);
      setFormOpen(false);
      setFormResetKey((key) => key + 1);
      queryClient.setQueryData(queryKeys.chapter(numericProjectId, chapter.id), chapter);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectOverview(numericProjectId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.story(numericProjectId) });
      router.push(`/projects/${numericProjectId}/chapters/${chapter.id}`);
    },
    onError: (error) => setFormError(apiErrorMessage(error, "Không thể tạo Chapter.")),
  });

  const batchImport = useMutation({
    mutationFn: async (file: File) => {
      const storyVersion = storyQuery.data;
      if (!storyVersion) {
        throw new Error("Hãy tạo Story Version trước khi import nhiều chapter.");
      }
      return chaptersApi.batchImport(numericProjectId, storyVersion.id, file);
    },
    onSuccess: (importedChapters) => {
      setBatchImportError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projectOverview(numericProjectId) });
      if (storyQuery.data) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.chapters(numericProjectId, storyQuery.data.id),
        });
      }
      if (importedChapters.length > 0) {
        router.push(`/projects/${numericProjectId}/chapters/${importedChapters[0].id}`);
      }
    },
    onError: (error) =>
      setBatchImportError(apiErrorMessage(error, "Không thể import chapter từ file.")),
  });

  if (!projectId) {
    return <WorkspaceMessage>Chọn một project từ danh sách dự án để mở workspace.</WorkspaceMessage>;
  }
  if (!hasValidProjectId) return <WorkspaceMessage>Project ID không hợp lệ.</WorkspaceMessage>;
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

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0d1420] shadow-[0_22px_60px_rgba(0,0,0,0.35)]">
        <ProjectHero
          project={overview}
          metrics={overview.metrics}
          continueChapter={continueChapter}
          onContinue={continueProject}
          onOpenInfo={() => setActiveTab("info")}
        />
        <ProjectTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === "chapters" && (
          <div className="border-t border-slate-800/80">
            <ChapterTable chapters={chapters} onOpenChapter={(chapter) => openChapter(chapter.id)} />
            <div className="space-y-3 border-t border-slate-800/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="flex items-center gap-2 rounded-lg border border-dashed border-purple-500/60 bg-purple-950/20 px-5 py-3 text-sm font-semibold text-purple-200 shadow-[0_0_20px_rgba(124,58,237,0.2)] transition-colors hover:bg-purple-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                >
                  <Plus className="h-4 w-4 text-purple-400" />
                  <span>+ Add Chapter</span>
                </button>

                <input
                  ref={batchImportInputRef}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
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
                  className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-[#0d1420] px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UploadCloud className="h-4 w-4 text-purple-400" />
                  <span>{batchImport.isPending ? "Đang import…" : "Import nhiều chapter"}</span>
                </button>
              </div>
              {batchImportError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-200">
                  {batchImportError}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "storyboard" && (
          <div className="border-t border-slate-800/80 p-4 sm:p-6">
            <StoryboardScreen projectId={numericProjectId} chapters={chapters} />
          </div>
        )}

        {activeTab === "info" && <ProjectInfoTab project={project} />}
        {activeTab === "characters" && (
          <ProjectResourcesTab kind="characters" onOpenLibrary={() => router.push("/characters")} />
        )}
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
      </section>

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
