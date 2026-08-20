"use client";

import { LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { apiErrorMessage } from "@/shared/api/client";
import { AddVisualBeatModal } from "./components/AddVisualBeatModal";
import { StoryboardEmptyState } from "./components/StoryboardEmptyState";
import { StoryboardHeader } from "./components/StoryboardHeader";
import { StoryboardSceneRail } from "./components/StoryboardSceneRail";
import { VisualBeatCard } from "./components/VisualBeatCard";
import {
  useStoryboardState,
  type StoryboardChapterItem,
} from "./hooks/useStoryboardState";

export type { StoryboardChapterItem } from "./hooks/useStoryboardState";

interface StoryboardScreenProps {
  projectId: number;
  chapters: StoryboardChapterItem[];
  initialChapterId?: number | null;
  hideChapterSelector?: boolean;
}

export function StoryboardScreen({
  projectId,
  chapters,
  initialChapterId,
  hideChapterSelector = false,
}: Readonly<StoryboardScreenProps>) {
  const {
    orderedChapters,
    chapterId,
    setChapterId,
    sceneId,
    setSceneId,
    status,
    setStatus,
    search,
    setSearch,
    addOpen,
    addSceneId,
    setAddSceneId,
    beatTitle,
    setBeatTitle,
    visualIntent,
    setVisualIntent,
    actionError,
    storyboardQuery,
    storyboard,
    visibleScenes,
    visibleBeatCount,
    createBeat,
    updateReview,
    openAddVisualBeat,
    closeAddVisualBeat,
  } = useStoryboardState({ projectId, chapters, initialChapterId });

  if (orderedChapters.length === 0) {
    return (
      <section className="rounded-xl border border-slate-800 bg-[#07111c] p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-100">Storyboard chưa có Chapter</h2>
        <p className="mt-2 text-sm text-slate-500">
          Tạo Chapter và chạy Analyze để backend sinh Scene và Visual Beat thật.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#163047] bg-[#06101a] shadow-2xl shadow-black/20">
      <StoryboardHeader
        hideChapterSelector={hideChapterSelector}
        orderedChapters={orderedChapters}
        chapterId={chapterId}
        sceneId={sceneId}
        status={status}
        search={search}
        storyboard={storyboard}
        onChapterChange={setChapterId}
        onSceneChange={setSceneId}
        onStatusChange={setStatus}
        onSearchChange={setSearch}
        onAddVisualBeat={() => openAddVisualBeat()}
      />

      {storyboardQuery.isPending && (
        <div className="flex min-h-[360px] items-center justify-center text-sm text-slate-500">
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Đang tải storyboard từ backend…
        </div>
      )}

      {storyboardQuery.isError && (
        <div className="m-5 rounded-xl border border-rose-500/20 bg-rose-950/10 p-6 text-center">
          <p className="text-sm text-rose-200">
            {apiErrorMessage(storyboardQuery.error, "Không tải được Storyboard từ backend.")}
          </p>
          <button
            type="button"
            onClick={() => storyboardQuery.refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Thử lại
          </button>
        </div>
      )}

      {storyboard && (
        <div className="grid min-h-[440px] lg:grid-cols-[170px_minmax(0,1fr)]">
          <StoryboardSceneRail
            scenes={storyboard.scenes}
            sceneId={sceneId}
            onSelectAll={() => setSceneId(null)}
            onSelectScene={setSceneId}
          />

          <div className="p-3 sm:p-4">
            {storyboard.scenes.length === 0 ? (
              <StoryboardEmptyState
                title="Chapter chưa có Scene"
                description="Chạy Analyze Chapter để AI worker tạo Scene và Visual Beat vào PostgreSQL."
              />
            ) : visibleBeatCount === 0 ? (
              <StoryboardEmptyState
                title="Không có Visual Beat phù hợp"
                description="Đổi Scene, trạng thái hoặc từ khóa tìm kiếm để xem các beat khác."
              />
            ) : (
              <div className="space-y-5">
                {visibleScenes.map((scene) =>
                  scene.visualBeats.length > 0 ? (
                    <div key={scene.id}>
                      {sceneId === null && (
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-slate-400">
                            Scene {String(scene.orderIndex + 1).padStart(2, "0")} · {scene.title}
                          </p>
                          <span className="text-[10px] text-slate-600">
                            {scene.approvedBeatCount}/{scene.totalBeatCount} approved
                          </span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                        {scene.visualBeats.map((beat) => (
                          <VisualBeatCard
                            key={beat.id}
                            beat={beat}
                            updating={
                              updateReview.isPending &&
                              updateReview.variables?.beat.id === beat.id
                            }
                            onReview={(nextStatus) => updateReview.mutate({ beat, nextStatus })}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => openAddVisualBeat(scene.id)}
                          aria-label={`Thêm visual beat vào Scene ${scene.orderIndex + 1}`}
                          className="flex min-h-[222px] flex-col items-center justify-center rounded-lg border border-dashed border-[#26425a] bg-[#07131f] text-purple-400 transition-colors hover:border-purple-500/60 hover:bg-purple-950/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                        >
                          <Plus className="h-5 w-5" />
                          <span className="mt-2 text-[11px]">Thêm visual beat</span>
                        </button>
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {actionError && !addOpen && (
        <div role="alert" className="border-t border-rose-500/20 bg-rose-950/10 px-4 py-2 text-xs text-rose-300">
          {actionError}
        </div>
      )}

      {storyboard && (
        <AddVisualBeatModal
          isOpen={addOpen}
          storyboard={storyboard}
          addSceneId={addSceneId}
          beatTitle={beatTitle}
          visualIntent={visualIntent}
          actionError={actionError}
          isPending={createBeat.isPending}
          onClose={closeAddVisualBeat}
          onSceneChange={setAddSceneId}
          onTitleChange={setBeatTitle}
          onIntentChange={setVisualIntent}
          onSubmit={() => createBeat.mutate()}
        />
      )}
    </section>
  );
}
