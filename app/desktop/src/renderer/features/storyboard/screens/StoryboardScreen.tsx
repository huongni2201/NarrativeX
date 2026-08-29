import { useEffect, useMemo, useRef, useState } from "react";
import type { DesktopChapterDetails, DesktopTimeline } from "@narrativex/client-contracts";
import { CheckCheck, Clapperboard, Loader2, Plus, WandSparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { StoryboardVisualBeat } from "../api/storyboard.api";
import { GeminiQueueBanner } from "../components/GeminiQueueBanner";
import { SceneRail } from "../components/SceneRail";
import { StoryboardHeader } from "../components/StoryboardHeader";
import { VisualBeatGrid } from "../components/VisualBeatGrid";
import {
  createGeminiQueue,
  markQueueBeatCompleted,
  markQueueBeatSkipped,
  reconcileQueue,
  restoreQueueForSession,
  skipQueueBeatIfApproved,
  type GeminiQueueState,
} from "../model/gemini-queue";
import { useStoryboardMediaMutations } from "../queries/storyboard-media.queries";
import {
  useApproveVisualBeats,
  useCreateVisualBeat,
  useStoryboardQuery,
  useUpdateVisualBeatReview,
} from "../queries/storyboard.queries";
import {
  loadGeminiQueue,
  saveGeminiQueue,
} from "../store/gemini-queue.persistence";
import {
  beatsNeedingReview,
  filterVisualBeatsByStatus,
  type VisualBeatStatusFilter,
} from "../storyboard-review";

export function StoryboardScreen({
  projectId,
  chapters,
  timeline,
}: Readonly<{
  projectId: string;
  chapters: DesktopChapterDetails[];
  timeline: DesktopTimeline | null;
}>) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [creatingBeat, setCreatingBeat] = useState(false);
  const [beatTitle, setBeatTitle] = useState("");
  const [visualIntent, setVisualIntent] = useState("");
  const [pendingImportBeatId, setPendingImportBeatId] = useState<string | null>(null);
  const [mediaBusyBeatId, setMediaBusyBeatId] = useState<string | null>(null);
  const [copiedPromptBeatId, setCopiedPromptBeatId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<VisualBeatStatusFilter>("ALL");
  const [geminiQueue, setGeminiQueue] = useState<GeminiQueueState | null>(null);
  const geminiRunTokenRef = useRef(0);

  function publishGeminiQueue(
    next: GeminiQueueState | null,
    chapterId: string | null = selectedChapterId,
  ) {
    setGeminiQueue(next);
    if (chapterId) saveGeminiQueue(projectId, chapterId, next);
  }

  useEffect(() => {
    if (!chapters.length) {
      setSelectedChapterId(null);
      return;
    }
    if (!selectedChapterId || !chapters.some((chapter) => chapter.id === selectedChapterId)) {
      setSelectedChapterId(chapters[0].id);
    }
  }, [chapters, selectedChapterId]);

  useEffect(() => {
    if (!selectedChapterId) {
      setGeminiQueue(null);
      return;
    }
    const restored = loadGeminiQueue(projectId, selectedChapterId);
    const nextQueue = restored ? restoreQueueForSession(restored) : null;
    publishGeminiQueue(nextQueue, selectedChapterId);
  }, [projectId, selectedChapterId]);

  const storyboardQuery = useStoryboardQuery(projectId, selectedChapterId);
  const createBeat = useCreateVisualBeat(projectId, selectedChapterId);
  const updateReview = useUpdateVisualBeatReview(projectId, selectedChapterId);
  const approveAll = useApproveVisualBeats(projectId, selectedChapterId);
  const mediaMutations = useStoryboardMediaMutations(projectId, selectedChapterId);
  const scenes = storyboardQuery.data?.scenes ?? [];

  useEffect(() => {
    if (!scenes.length) {
      setSelectedSceneId(null);
      return;
    }
    if (!selectedSceneId || !scenes.some((scene) => scene.id === selectedSceneId)) {
      setSelectedSceneId(scenes[0].id);
    }
  }, [scenes, selectedSceneId]);

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  const selectedChapter = chapters.find((chapter) => chapter.id === selectedChapterId) ?? null;
  const selectedSceneBeats = selectedScene?.visualBeats ?? [];
  const allChapterBeats = useMemo(
    () => scenes.flatMap((scene) => scene.visualBeats),
    [scenes],
  );
  const beatById = useMemo(
    () => new Map(allChapterBeats.map((beat) => [beat.id, beat])),
    [allChapterBeats],
  );
  const filteredVisualBeats = useMemo(
    () => filterVisualBeatsByStatus(selectedSceneBeats, reviewStatusFilter),
    [reviewStatusFilter, selectedSceneBeats],
  );
  const beatsPendingApproval = useMemo(
    () => beatsNeedingReview(selectedSceneBeats),
    [selectedSceneBeats],
  );
  const beatsPendingGeminiGeneration = useMemo(
    () => beatsNeedingReview(allChapterBeats),
    [allChapterBeats],
  );
  const currentQueueBeatId = geminiQueue?.beatIds[geminiQueue.currentIndex] ?? null;
  const currentQueueBeat = currentQueueBeatId ? beatById.get(currentQueueBeatId) ?? null : null;
  const queueProcessedCount = geminiQueue
    ? geminiQueue.completedBeatIds.length + geminiQueue.skippedBeatIds.length
    : 0;

  useEffect(() => {
    if (!geminiQueue || !currentQueueBeat || geminiQueue.status === "COMPLETED") return;
    if (selectedSceneId !== currentQueueBeat.sceneId) setSelectedSceneId(currentQueueBeat.sceneId);
    if (reviewStatusFilter !== "ALL") setReviewStatusFilter("ALL");
  }, [currentQueueBeat, geminiQueue, reviewStatusFilter, selectedSceneId]);

  useEffect(() => {
    if (!geminiQueue || geminiQueue.status === "COMPLETED") return;
    const reconciled = reconcileQueue(geminiQueue, new Set(beatById.keys()));
    if (reconciled !== geminiQueue) publishGeminiQueue(reconciled);
  }, [beatById, geminiQueue]);

  const timelineBeats = useMemo(
    () =>
      new Map(
        (timeline?.beats ?? [])
          .filter((beat) => beat.chapterId === selectedChapterId)
          .map((beat) => [beat.visualBeatId, beat]),
      ),
    [selectedChapterId, timeline?.beats],
  );
  const approvedCount = useMemo(
    () => scenes.reduce((total, scene) => total + scene.approvedBeatCount, 0),
    [scenes],
  );
  const beatCount = useMemo(
    () => scenes.reduce((total, scene) => total + scene.totalBeatCount, 0),
    [scenes],
  );

  async function generateGeminiImage(beat: StoryboardVisualBeat, queueMode = false): Promise<boolean> {
    if (mediaBusyBeatId) return false;
    if (!beat.prompt) {
      setNotice("Backend chưa trả prompt cho Visual Beat này. Hãy refresh Storyboard rồi thử lại.");
      return false;
    }
    if (!selectedChapterId) {
      setNotice("Chưa chọn chapter để resolve character reference.");
      return false;
    }

    setMediaBusyBeatId(beat.id);
    setPendingImportBeatId(null);
    setNotice(
      queueMode
        ? `Gemini All · Đang chuẩn bị character reference cho “${beat.title}”…`
        : `Đang chuẩn bị character reference cho “${beat.title}”…`,
    );

    try {
      const result = await mediaMutations.generateGeminiImage.mutateAsync({
        beat,
        hasProductionTimelineBeat: timelineBeats.has(beat.id),
        onReferencesResolved: (referenceCount) => {
          setNotice(
            queueMode
              ? `Gemini All · Đang gửi ${referenceCount} reference và generate “${beat.title}”…`
              : `Đang gửi ${referenceCount} character reference lên Gemini và generate “${beat.title}”…`,
          );
        },
      });
      setNotice(
        queueMode
          ? `Gemini All · Đã gắn ảnh cho “${beat.title}” với ${result.referenceCount} character reference.`
          : `Gemini đã generate và gắn ảnh vào “${beat.title}” với ${result.referenceCount} character reference.`,
      );
      return true;
    } catch (error) {
      setNotice(errorMessage(error, "Không thể tự động generate ảnh bằng Gemini Web."));
      return false;
    } finally {
      setMediaBusyBeatId(null);
    }
  }

  async function generateWithGemini(beat: StoryboardVisualBeat) {
    if (geminiQueue?.status === "RUNNING") {
      setNotice("Gemini All đang chạy. Hãy dừng batch trước khi generate riêng một Visual Beat.");
      return;
    }
    await generateGeminiImage(beat, false);
  }

  async function runGeminiQueue(initialQueue: GeminiQueueState, runToken: number) {
    let queue: GeminiQueueState = { ...initialQueue, status: "RUNNING" };
    const processed = new Set([...queue.completedBeatIds, ...queue.skippedBeatIds]);

    for (let index = queue.currentIndex; index < queue.beatIds.length; index += 1) {
      if (runToken !== geminiRunTokenRef.current) return;
      const beatId = queue.beatIds[index];
      if (processed.has(beatId)) continue;
      const beat = beatById.get(beatId);
      if (!beat) {
        processed.add(beatId);
        queue = markQueueBeatSkipped(queue, beatId);
        publishGeminiQueue(queue);
        continue;
      }

      const queueAfterApprovalCheck = skipQueueBeatIfApproved(queue, beat);
      if (queueAfterApprovalCheck !== queue) {
        processed.add(beatId);
        queue = queueAfterApprovalCheck;
        publishGeminiQueue(queue);
        continue;
      }

      queue = { ...queue, currentIndex: index, status: "RUNNING" };
      publishGeminiQueue(queue);
      setSelectedSceneId(beat.sceneId);
      setReviewStatusFilter("ALL");

      const generated = await generateGeminiImage(beat, true);
      if (generated) {
        processed.add(beatId);
        queue = markQueueBeatCompleted(queue, beatId);
        publishGeminiQueue(queue);
      }
      if (runToken !== geminiRunTokenRef.current) return;
      if (!generated) {
        const pausedQueue = { ...queue, status: "PAUSED" as const };
        queue = pausedQueue;
        publishGeminiQueue(pausedQueue);
        return;
      }
    }

    if (runToken !== geminiRunTokenRef.current) return;
    const completedQueue: GeminiQueueState = {
      ...queue,
      currentIndex: queue.beatIds.length,
      status: "COMPLETED",
    };
    publishGeminiQueue(completedQueue);
    setNotice(
      `Gemini All hoàn tất: ${completedQueue.completedBeatIds.length} generated, ${completedQueue.skippedBeatIds.length} skipped.`,
    );
  }

  async function startGeminiAll() {
    if (!selectedChapterId) return;
    const queue = createGeminiQueue(selectedChapterId, allChapterBeats);
    if (!queue) return;
    publishGeminiQueue(queue);
    const runToken = ++geminiRunTokenRef.current;
    await runGeminiQueue(queue, runToken);
  }

  async function resumeGeminiAll() {
    if (!geminiQueue || geminiQueue.status === "COMPLETED") return;
    const runToken = ++geminiRunTokenRef.current;
    const resumed: GeminiQueueState = { ...geminiQueue, status: "RUNNING" };
    publishGeminiQueue(resumed);
    await runGeminiQueue(resumed, runToken);
  }

  async function skipCurrentGeminiBeat() {
    if (!geminiQueue || !currentQueueBeatId || geminiQueue.status === "COMPLETED") return;
    const skipped = markQueueBeatSkipped(geminiQueue, currentQueueBeatId);
    const nextQueue: GeminiQueueState =
      skipped.status === "COMPLETED" ? skipped : { ...skipped, status: "RUNNING" };
    publishGeminiQueue(nextQueue);
    if (nextQueue.status === "COMPLETED") {
      setNotice(
        `Gemini All hoàn tất: ${nextQueue.completedBeatIds.length} generated, ${nextQueue.skippedBeatIds.length} skipped.`,
      );
      return;
    }
    const runToken = ++geminiRunTokenRef.current;
    await runGeminiQueue(nextQueue, runToken);
  }

  function stopGeminiAll() {
    geminiRunTokenRef.current += 1;
    publishGeminiQueue(geminiQueue ? { ...geminiQueue, status: "PAUSED" } : null);
    setPendingImportBeatId(null);
    setNotice("Đã dừng Gemini All. Generation đang chạy trên Chrome (nếu có) sẽ không tiếp tục sang beat kế tiếp.");
  }

  async function copyPrompt(beat: StoryboardVisualBeat) {
    if (!beat.prompt) {
      setNotice("Backend chưa trả prompt cho Visual Beat này. Hãy refresh Storyboard rồi thử lại.");
      return;
    }
    try {
      await window.narrativex.system.copyText(beat.prompt);
      setCopiedPromptBeatId(beat.id);
      setNotice(`Đã copy prompt của “${beat.title}”.`);
    } catch (error) {
      setCopiedPromptBeatId(null);
      setNotice(errorMessage(error, "Không thể copy prompt."));
    }
  }

  async function importGeneratedImage(beat: StoryboardVisualBeat) {
    if (mediaBusyBeatId) return;
    setMediaBusyBeatId(beat.id);
    setNotice(null);
    try {
      const result = await mediaMutations.importImage.mutateAsync({
        beat,
        hasProductionTimelineBeat: timelineBeats.has(beat.id),
      });
      if (!result) return;
      setPendingImportBeatId((current) => (current === beat.id ? null : current));
      setNotice(`Ảnh đã được import và gắn đúng Visual Beat “${beat.title}”.`);
    } catch (error) {
      setNotice(errorMessage(error, "Không thể import ảnh vào Visual Beat."));
    } finally {
      setMediaBusyBeatId(null);
    }
  }

  const mutationError = createBeat.error ?? updateReview.error ?? approveAll.error;
  const canCreateBeat = Boolean(beatTitle.trim() && visualIntent.trim() && selectedSceneId);
  const reviewUpdating = updateReview.isPending || approveAll.isPending;
  const geminiQueueActive = Boolean(geminiQueue && geminiQueue.status !== "COMPLETED");

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground select-none">
      <StoryboardHeader
        sceneCount={scenes.length}
        beatCount={beatCount}
        approvedCount={approvedCount}
      />

      {!chapters.length ? (
        <EmptyState
          title="Chưa có chapter để quản lý"
          detail="Tạo chapter và chạy phân tích trước. Scene và Visual Beat sẽ xuất hiện tại đây."
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[130px_320px_minmax(0,1fr)] overflow-hidden">
          <section className="min-h-0 overflow-y-auto border-r border-border bg-surface-dark p-3">
            <PanelTitle title="Chapters" count={chapters.length} />
            <div className="mt-3 space-y-1.5">
              {chapters.map((chapter) => {
                const active = chapter.id === selectedChapterId;
                return (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => {
                      setSelectedChapterId(chapter.id);
                      setSelectedSceneId(null);
                      setCreatingBeat(false);
                      setPendingImportBeatId(null);
                      setCopiedPromptBeatId(null);
                      setNotice(null);
                    }}
                    className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
                      active
                        ? "border-primary/55 bg-primary/10 text-foreground"
                        : "border-border-subtle bg-surface-panel text-text-secondary hover:border-border hover:bg-surface-2"
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                      Chapter {chapter.orderIndex + 1}
                    </div>
                    <div className="mt-1 truncate text-xs font-semibold">{chapter.title}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <SceneRail
            scenes={scenes}
            selectedSceneId={selectedSceneId}
            chapterTitle={selectedChapter?.title ?? null}
            loading={storyboardQuery.isLoading}
            error={storyboardQuery.isError ? errorMessage(storyboardQuery.error, "Không tải được storyboard.") : null}
            onSelectScene={(sceneId) => {
              setSelectedSceneId(sceneId);
              setCreatingBeat(false);
              setCopiedPromptBeatId(null);
            }}
          />

          <section className="flex min-h-0 flex-col overflow-hidden bg-background">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-text-muted">
                  <WandSparkles size={12} />
                  Visual Beats
                </div>
                <div className="mt-1 truncate text-sm font-semibold">
                  {selectedScene ? selectedScene.title : "Chọn một scene"}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-surface-input px-2 text-[10px] font-semibold text-text-secondary">
                  <span>Status</span>
                  <Select
                    value={reviewStatusFilter}
                    onValueChange={(value) => setReviewStatusFilter(value as VisualBeatStatusFilter)}
                  >
                    <SelectTrigger
                      aria-label="Lọc Visual Beat theo trạng thái review"
                      className="h-7 min-w-[116px] border-0 bg-transparent px-0 text-[10px] font-semibold text-foreground shadow-none hover:border-0 hover:text-foreground focus:ring-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All</SelectItem>
                      <SelectItem value="NEEDS_REVIEW">Needs review</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <button
                  type="button"
                  disabled={!beatsPendingGeminiGeneration.length || geminiQueueActive}
                  onClick={() => void startGeminiAll()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/35 bg-primary/5 px-3 text-xs font-bold text-primary-hover transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <WandSparkles size={13} />
                  Generate Gemini All
                </button>
                <button
                  type="button"
                  disabled={!beatsPendingApproval.length || reviewUpdating}
                  onClick={() => {
                    setNotice(null);
                    approveAll.mutate(beatsPendingApproval, {
                      onSuccess: ({ approved, failed }) => {
                        setNotice(
                          failed
                            ? `Đã duyệt ${approved} Visual Beat. ${failed} beat không thể duyệt vì vừa thay đổi; hãy kiểm tra lại.`
                            : `Đã duyệt ${approved} Visual Beat.`,
                        );
                      },
                    });
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-success/35 bg-success/5 px-3 text-xs font-bold text-success transition hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {approveAll.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
                  {approveAll.isPending ? "Approving…" : `Approve all${beatsPendingApproval.length ? ` (${beatsPendingApproval.length})` : ""}`}
                </button>
                <button
                  type="button"
                  disabled={!selectedScene}
                  onClick={() => setCreatingBeat((value) => !value)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={13} />
                  Add Visual Beat
                </button>
              </div>
            </div>

            {geminiQueue && (
              <GeminiQueueBanner
                queue={geminiQueue}
                currentBeat={currentQueueBeat}
                processedCount={queueProcessedCount}
                busy={Boolean(mediaBusyBeatId)}
                onResume={() => void resumeGeminiAll()}
                onSkip={() => void skipCurrentGeminiBeat()}
                onStop={stopGeminiAll}
                onDismiss={() => publishGeminiQueue(null)}
              />
            )}

            {(mutationError || notice) && (
              <div className="mx-5 mt-3">
                {mutationError ? (
                  <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
                    {errorMessage(mutationError, "Không thể cập nhật storyboard.")}
                  </div>
                ) : (
                  <div className="rounded-md border border-border bg-surface-panel px-3 py-2 text-xs text-text-secondary">
                    {notice}
                  </div>
                )}
              </div>
            )}

            {creatingBeat && selectedScene && (
              <div className="mx-5 mt-4 rounded-lg border border-primary/35 bg-surface-panel p-4">
                <div className="text-xs font-bold">New Visual Beat</div>
                <div className="mt-3 grid gap-3">
                  <input
                    value={beatTitle}
                    maxLength={200}
                    onChange={(event) => setBeatTitle(event.target.value)}
                    placeholder="Beat title"
                    className="h-9 rounded-md border border-border bg-surface-input px-3 text-xs outline-none focus:border-primary"
                  />
                  <textarea
                    value={visualIntent}
                    maxLength={8000}
                    onChange={(event) => setVisualIntent(event.target.value)}
                    placeholder="Visual intent..."
                    rows={4}
                    className="resize-none rounded-md border border-border bg-surface-input px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingBeat(false);
                        setBeatTitle("");
                        setVisualIntent("");
                      }}
                      className="h-8 rounded-md border border-border px-3 text-xs text-text-secondary hover:bg-surface-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!canCreateBeat || createBeat.isPending}
                      onClick={() => {
                        if (!selectedSceneId) return;
                        createBeat.mutate(
                          {
                            sceneId: selectedSceneId,
                            beat: {
                              title: beatTitle.trim(),
                              visualIntent: visualIntent.trim(),
                            },
                          },
                          {
                            onSuccess: () => {
                              setBeatTitle("");
                              setVisualIntent("");
                              setCreatingBeat(false);
                            },
                          },
                        );
                      }}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-bold text-white hover:bg-primary-hover disabled:opacity-50"
                    >
                      {createBeat.isPending && <Loader2 size={12} className="animate-spin" />}
                      Create beat
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <VisualBeatGrid
                projectId={projectId}
                beats={filteredVisualBeats}
                hasSelectedScene={Boolean(selectedScene)}
                selectedSceneBeatCount={selectedSceneBeats.length}
                timelineBeats={timelineBeats}
                updating={reviewUpdating}
                mediaBusyBeatId={mediaBusyBeatId}
                pendingImportBeatId={pendingImportBeatId}
                copiedPromptBeatId={copiedPromptBeatId}
                currentQueueBeatId={currentQueueBeatId}
                queueStatus={geminiQueue?.status ?? null}
                onReview={(beat, status) => updateReview.mutate({ beat, status })}
                onGenerate={(beat) => void generateWithGemini(beat)}
                onCopyPrompt={(beat) => void copyPrompt(beat)}
                onImport={(beat) => void importGeneratedImage(beat)}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PanelTitle({ title, count }: Readonly<{ title: string; count: number }>) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-secondary">{title}</h2>
      <span className="rounded bg-surface-input px-1.5 py-0.5 text-[9px] text-text-muted">{count}</span>
    </div>
  );
}

function EmptyState({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center">
      <div className="max-w-md px-6 text-center">
        <Clapperboard size={30} className="mx-auto text-text-dim" />
        <div className="mt-3 text-sm font-bold">{title}</div>
        <p className="mt-1 text-xs leading-5 text-text-muted">{detail}</p>
      </div>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
