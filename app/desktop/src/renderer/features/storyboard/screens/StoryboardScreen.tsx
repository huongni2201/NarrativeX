import { useEffect, useMemo, useRef, useState } from "react";
import type { DesktopChapterDetails, DesktopTimeline } from "@narrativex/client-contracts";
import { CheckCheck, Clapperboard, Loader2, Plus, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { runBoundedParallel } from "../../../shared/bounded-parallel";
import { InlineNotice, WorkspaceToolbar } from "../../workspace/components/WorkstationPrimitives";
import type { StoryboardVisualBeat } from "../api/storyboard.api";
import { GeminiQueueBanner } from "../components/GeminiQueueBanner";
import { StoryboardHeader } from "../components/StoryboardHeader";
import { StoryboardNavigator } from "../components/StoryboardNavigator";
import { VisualBeatGrid } from "../components/VisualBeatGrid";
import {
  classifyGeminiQueueGenerationError,
  createGeminiQueue,
  markQueueBeatCompleted,
  markQueueBeatSkipped,
  reconcileQueue,
  restoreQueueForSession,
  skipQueueBeatIfMediaReady,
  type GeminiQueueGenerationErrorAction,
  type GeminiQueueState,
} from "../model/gemini-queue";
import { useStoryboardMediaMutations } from "../queries/storyboard-media.queries";
import {
  useApproveVisualBeats,
  useCreateVisualBeat,
  useStoryboardQuery,
  useUpdateVisualBeatReview,
} from "../queries/storyboard.queries";
import { loadGeminiQueue, saveGeminiQueue } from "../store/gemini-queue.persistence";
import {
  beatsNeedingReview,
  filterVisualBeatsByStatus,
  type VisualBeatStatusFilter,
} from "../storyboard-review";

type GeminiImageGenerationResult = "GENERATED" | GeminiQueueGenerationErrorAction;

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
  const [activeGeminiBeatIds, setActiveGeminiBeatIds] = useState<ReadonlySet<string>>(new Set());
  const activeGeminiBeatIdsRef = useRef(new Set<string>());
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
  const selectedSceneBeats = selectedScene?.visualBeats ?? [];
  const allChapterBeats = useMemo(() => scenes.flatMap((scene) => scene.visualBeats), [scenes]);
  const beatById = useMemo(() => new Map(allChapterBeats.map((beat) => [beat.id, beat])), [allChapterBeats]);
  const filteredVisualBeats = useMemo(
    () => filterVisualBeatsByStatus(selectedSceneBeats, reviewStatusFilter),
    [reviewStatusFilter, selectedSceneBeats],
  );
  const beatsPendingApproval = useMemo(() => beatsNeedingReview(selectedSceneBeats), [selectedSceneBeats]);
  const beatsPendingGeminiGeneration = useMemo(
    () => allChapterBeats.filter((beat) => !beat.previewMediaAssetId),
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

  function publishActiveGeminiBeat() {
    setActiveGeminiBeatIds(new Set(activeGeminiBeatIdsRef.current));
    setMediaBusyBeatId(activeGeminiBeatIdsRef.current.values().next().value ?? null);
  }

  async function generateGeminiImage(
    beat: StoryboardVisualBeat,
    queueMode = false,
  ): Promise<GeminiImageGenerationResult> {
    if (!queueMode && mediaBusyBeatId) return "PAUSE_QUEUE";
    if (activeGeminiBeatIdsRef.current.has(beat.id)) return "PAUSE_QUEUE";
    if (!beat.prompt) {
      setNotice("Backend chưa trả prompt cho Visual Beat này. Hãy refresh Storyboard rồi thử lại.");
      return "PAUSE_QUEUE";
    }
    if (!selectedChapterId) {
      setNotice("Chưa chọn chapter để resolve character reference.");
      return "PAUSE_QUEUE";
    }

    activeGeminiBeatIdsRef.current.add(beat.id);
    publishActiveGeminiBeat();
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
      return "GENERATED";
    } catch (error) {
      const action = classifyGeminiQueueGenerationError(error);
      setNotice(
        action === "SKIP_BEAT" && queueMode
          ? `Gemini All · Gemini từ chối “${beat.title}”; bỏ qua beat này và tiếp tục các beat còn lại.`
          : errorMessage(error, "Không thể tự động generate ảnh bằng Gemini Web."),
      );
      return action;
    } finally {
      activeGeminiBeatIdsRef.current.delete(beat.id);
      publishActiveGeminiBeat();
    }
  }

  async function generateWithGemini(beat: StoryboardVisualBeat) {
    if (geminiQueue?.status === "RUNNING") {
      setNotice("Gemini All đang chạy. Hãy dừng batch trước khi generate riêng một Visual Beat.");
      return;
    }
    await generateGeminiImage(beat, false);
  }

  async function storyboardConcurrency(): Promise<number> {
    try {
      return (await window.narrativex.preferences.get()).gemini.storyboardTabs;
    } catch {
      return 4;
    }
  }

  async function runGeminiQueue(initialQueue: GeminiQueueState, runToken: number) {
    let queue: GeminiQueueState = { ...initialQueue, status: "RUNNING" };
    const processed = new Set([...queue.completedBeatIds, ...queue.skippedBeatIds]);
    const pendingBeatIds = queue.beatIds.filter((beatId) => !processed.has(beatId));
    let acceptNewWork = true;
    const concurrency = await storyboardConcurrency();

    await runBoundedParallel(
      pendingBeatIds,
      concurrency,
      async (beatId) => {
        if (runToken !== geminiRunTokenRef.current || !acceptNewWork) return;
        const beat = beatById.get(beatId);
        if (!beat) {
          processed.add(beatId);
          queue = markQueueBeatSkipped(queue, beatId);
          publishGeminiQueue(queue);
          return;
        }

        const queueAfterMediaCheck = skipQueueBeatIfMediaReady(queue, beat);
        if (queueAfterMediaCheck !== queue) {
          processed.add(beatId);
          queue = queueAfterMediaCheck;
          publishGeminiQueue(queue);
          return;
        }

        const generationResult = await generateGeminiImage(beat, true);
        if (runToken !== geminiRunTokenRef.current) return;
        if (generationResult === "GENERATED") {
          processed.add(beatId);
          queue = markQueueBeatCompleted(queue, beatId);
          publishGeminiQueue(queue);
          return;
        }
        if (generationResult === "SKIP_BEAT") {
          processed.add(beatId);
          queue = markQueueBeatSkipped(queue, beatId);
          publishGeminiQueue(queue);
          return;
        }
        if (generationResult === "PAUSE_QUEUE") {
          acceptNewWork = false;
        }
      },
      () => runToken === geminiRunTokenRef.current && acceptNewWork,
    );

    if (runToken !== geminiRunTokenRef.current) return;
    if (!acceptNewWork) {
      publishGeminiQueue({ ...queue, status: "PAUSED" });
      return;
    }
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
    setNotice("Đã dừng Gemini All. Các tab đang generate sẽ hoàn tất nhưng không nhận Visual Beat mới.");
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

  function selectChapter(chapterId: string) {
    setSelectedChapterId(chapterId);
    setSelectedSceneId(null);
    setCreatingBeat(false);
    setPendingImportBeatId(null);
    setCopiedPromptBeatId(null);
    setNotice(null);
  }

  function selectScene(sceneId: string) {
    setSelectedSceneId(sceneId);
    setCreatingBeat(false);
    setCopiedPromptBeatId(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground select-none">
      <StoryboardHeader sceneCount={scenes.length} beatCount={beatCount} approvedCount={approvedCount} />

      {!chapters.length ? (
        <EmptyState
          title="Chưa có chapter để quản lý"
          detail="Tạo chapter và chạy phân tích trước. Scene và Visual Beat sẽ xuất hiện tại đây."
        />
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,288px)_minmax(0,1fr)] overflow-hidden">
          <StoryboardNavigator
            chapters={chapters}
            selectedChapterId={selectedChapterId}
            scenes={scenes}
            selectedSceneId={selectedSceneId}
            loading={storyboardQuery.isLoading}
            error={storyboardQuery.isError ? errorMessage(storyboardQuery.error, "Không tải được storyboard.") : null}
            onSelectChapter={selectChapter}
            onSelectScene={selectScene}
          />

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background">
            <WorkspaceToolbar>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-text-dim">
                  <WandSparkles size={11} /> Visual Beats
                </div>
                <div className="truncate text-[12px] font-semibold text-foreground">
                  {selectedScene ? selectedScene.title : "Chọn một scene"}
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
                <Select value={reviewStatusFilter} onValueChange={(value) => setReviewStatusFilter(value as VisualBeatStatusFilter)}>
                  <SelectTrigger aria-label="Lọc Visual Beat theo trạng thái review" className="min-w-[124px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All beats</SelectItem>
                    <SelectItem value="NEEDS_REVIEW">Needs review</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!beatsPendingGeminiGeneration.length || geminiQueueActive}
                  onClick={() => void startGeminiAll()}
                >
                  <WandSparkles size={12} /> Gemini All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
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
                >
                  {approveAll.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
                  {approveAll.isPending ? "Approving…" : `Approve${beatsPendingApproval.length ? ` ${beatsPendingApproval.length}` : ""}`}
                </Button>
                <Button size="sm" disabled={!selectedScene} onClick={() => setCreatingBeat((value) => !value)}>
                  <Plus size={12} /> Add Beat
                </Button>
              </div>
            </WorkspaceToolbar>

            {geminiQueue ? (
              <GeminiQueueBanner
                queue={geminiQueue}
                currentBeat={currentQueueBeat}
                processedCount={queueProcessedCount}
                busy={activeGeminiBeatIds.size > 0}
                onResume={() => void resumeGeminiAll()}
                onSkip={() => void skipCurrentGeminiBeat()}
                onStop={stopGeminiAll}
                onDismiss={() => publishGeminiQueue(null)}
              />
            ) : null}

            {mutationError || notice ? (
              <div className="shrink-0 border-b border-border-subtle">
                {mutationError ? (
                  <InlineNotice tone="danger">{errorMessage(mutationError, "Không thể cập nhật storyboard.")}</InlineNotice>
                ) : (
                  <InlineNotice>{notice}</InlineNotice>
                )}
              </div>
            ) : null}

            {creatingBeat && selectedScene ? (
              <div className="shrink-0 border-b border-border-subtle bg-surface-panel px-3 py-2.5">
                <div className="grid gap-2 lg:grid-cols-[minmax(180px,.65fr)_minmax(280px,1.35fr)_auto] lg:items-start">
                  <Input
                    value={beatTitle}
                    maxLength={200}
                    onChange={(event) => setBeatTitle(event.target.value)}
                    placeholder="Beat title"
                    aria-label="Visual Beat title"
                  />
                  <Textarea
                    value={visualIntent}
                    maxLength={8000}
                    onChange={(event) => setVisualIntent(event.target.value)}
                    placeholder="Visual intent..."
                    rows={2}
                    className="min-h-16 resize-none"
                    aria-label="Visual Beat intent"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCreatingBeat(false);
                        setBeatTitle("");
                        setVisualIntent("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canCreateBeat || createBeat.isPending}
                      onClick={() => {
                        if (!selectedSceneId) return;
                        createBeat.mutate(
                          { sceneId: selectedSceneId, beat: { title: beatTitle.trim(), visualIntent: visualIntent.trim() } },
                          {
                            onSuccess: () => {
                              setBeatTitle("");
                              setVisualIntent("");
                              setCreatingBeat(false);
                            },
                          },
                        );
                      }}
                    >
                      {createBeat.isPending ? <Loader2 size={12} className="animate-spin" /> : null}
                      Create beat
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <VisualBeatGrid
                projectId={projectId}
                beats={filteredVisualBeats}
                hasSelectedScene={Boolean(selectedScene)}
                selectedSceneBeatCount={selectedSceneBeats.length}
                timelineBeats={timelineBeats}
                updating={reviewUpdating}
                mediaBusyBeatId={mediaBusyBeatId}
                activeGeminiBeatIds={activeGeminiBeatIds}
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

function EmptyState({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center">
      <div className="max-w-md px-6 text-center">
        <Clapperboard size={28} className="mx-auto text-text-dim" />
        <div className="mt-3 text-[13px] font-semibold">{title}</div>
        <p className="mt-1 text-[11px] leading-4 text-text-muted">{detail}</p>
      </div>
    </div>
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
