import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  DesktopChapterDetails,
  DesktopTimeline,
  DesktopTimelineBeat,
} from "@narrativex/client-contracts";
import {
  Check,
  CheckCheck,
  Clapperboard,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  RotateCcw,
  WandSparkles,
} from "lucide-react";
import { assetsApi } from "../../assets/api/assets.api";
import { productionApi } from "../../production/api/production.api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  storyboardApi,
  type StoryboardVisualBeat,
  type VisualBeatReviewStatus,
} from "../api/storyboard.api";
import {
  markQueueBeatCompleted,
  markQueueBeatSkipped,
  reconcileQueue,
  restoreQueueForSession,
  type GeminiQueueState,
} from "../model/gemini-queue";
import {
  storyboardKeys,
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
  const queryClient = useQueryClient();
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
  const materializedReferenceIdsRef = useRef(new Set<string>());

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
    setGeminiQueue(restored ? restoreQueueForSession(restored) : null);
  }, [projectId, selectedChapterId]);

  useEffect(() => {
    if (!selectedChapterId) return;
    saveGeminiQueue(projectId, selectedChapterId, geminiQueue);
  }, [geminiQueue, projectId, selectedChapterId]);

  const storyboardQuery = useStoryboardQuery(projectId, selectedChapterId);
  const createBeat = useCreateVisualBeat(projectId, selectedChapterId);
  const updateReview = useUpdateVisualBeatReview(projectId, selectedChapterId);
  const approveAll = useApproveVisualBeats(projectId, selectedChapterId);

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
  const currentQueueBeatId = geminiQueue?.beatIds[geminiQueue.currentIndex] ?? null;
  const currentQueueBeat = currentQueueBeatId ? beatById.get(currentQueueBeatId) ?? null : null;
  const queueProcessedCount = geminiQueue
    ? geminiQueue.completedBeatIds.length + geminiQueue.skippedBeatIds.length
    : 0;

  useEffect(() => {
    if (!geminiQueue || !currentQueueBeat) return;
    if (geminiQueue.status === "COMPLETED") return;
    if (selectedSceneId !== currentQueueBeat.sceneId) {
      setSelectedSceneId(currentQueueBeat.sceneId);
    }
    if (reviewStatusFilter !== "ALL") setReviewStatusFilter("ALL");
  }, [currentQueueBeat, geminiQueue, reviewStatusFilter, selectedSceneId]);

  useEffect(() => {
    if (!geminiQueue || geminiQueue.status === "COMPLETED") return;
    const reconciled = reconcileQueue(geminiQueue, new Set(beatById.keys()));
    if (reconciled !== geminiQueue) setGeminiQueue(reconciled);
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

  async function persistGeneratedImage(
    beat: StoryboardVisualBeat,
    selection: {
      selectionToken: string;
      originalFilename: string;
      contentType: string;
      sizeBytes: number;
      checksumSha256: string;
      kind: "IMAGE" | "AUDIO" | "VIDEO" | "OTHER";
    },
    source: "GEMINI_WEB" | "MANUAL",
  ) {
    if (selection.kind !== "IMAGE") {
      throw new Error("Generated image flow chỉ chấp nhận file ảnh.");
    }

    const asset = await assetsApi.registerLocal({
      projectId,
      type: "IMAGE",
      originalFilename: selection.originalFilename,
      contentType: selection.contentType,
      sizeBytes: selection.sizeBytes,
      checksumSha256: selection.checksumSha256,
      durationMs: null,
    });

    if (source === "GEMINI_WEB") {
      await window.narrativex.geminiWeb.commitImage({
        projectId,
        assetId: asset.id,
        selectionToken: selection.selectionToken,
      });
    } else {
      await window.narrativex.localStorage.commitSelectedAsset({
        projectId,
        assetId: asset.id,
        kind: "IMAGE",
        selectionToken: selection.selectionToken,
      });
    }

    await productionApi.updateBeatMedia(projectId, beat.id, {
      mediaAssetId: asset.id,
      fitMode: "TRIM",
      trimStartMs: 0,
    });

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects", projectId, "timeline"] }),
      selectedChapterId
        ? queryClient.invalidateQueries({
            queryKey: storyboardKeys.chapter(projectId, selectedChapterId),
          })
        : Promise.resolve(),
      queryClient.invalidateQueries({ queryKey: ["assets", "library"] }),
    ]);
  }

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
      const context = await storyboardApi.geminiContext(projectId, selectedChapterId, beat.id);
      for (const reference of context.references) {
        if (materializedReferenceIdsRef.current.has(reference.assetId)) continue;
        await window.narrativex.localStorage.materializeRemoteAsset({
          projectId,
          assetId: reference.assetId,
        });
        materializedReferenceIdsRef.current.add(reference.assetId);
      }

      const prompt = [beat.prompt, context.promptContext].filter(Boolean).join("\n\n");
      setNotice(
        queueMode
          ? `Gemini All · Đang gửi ${context.references.length} reference và generate “${beat.title}”…`
          : `Đang gửi ${context.references.length} character reference lên Gemini và generate “${beat.title}”…`,
      );
      const selection = await window.narrativex.geminiWeb.generateImage({
        prompt,
        projectId,
        references: context.references.map((reference) => ({
          refLabel: reference.refLabel,
          assetId: reference.assetId,
          characterId: reference.characterId,
          canonicalName: reference.canonicalName,
          beatRole: reference.beatRole,
        })),
      });
      await persistGeneratedImage(beat, selection, "GEMINI_WEB");
      setNotice(
        queueMode
          ? `Gemini All · Đã gắn ảnh cho “${beat.title}” với ${context.references.length} character reference.`
          : `Gemini đã generate và gắn ảnh vào “${beat.title}” với ${context.references.length} character reference.`,
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
    let queue = { ...initialQueue, status: "RUNNING" as const };
    const processed = new Set([...queue.completedBeatIds, ...queue.skippedBeatIds]);

    for (let index = queue.currentIndex; index < queue.beatIds.length; index += 1) {
      if (runToken !== geminiRunTokenRef.current) return;
      const beatId = queue.beatIds[index];
      if (processed.has(beatId)) continue;
      const beat = beatById.get(beatId);
      if (!beat) {
        processed.add(beatId);
        queue = markQueueBeatSkipped(queue, beatId);
        setGeminiQueue(queue);
        continue;
      }

      queue = { ...queue, currentIndex: index, status: "RUNNING" };
      setGeminiQueue(queue);
      setSelectedSceneId(beat.sceneId);
      setReviewStatusFilter("ALL");

      const generated = await generateGeminiImage(beat, true);
      if (runToken !== geminiRunTokenRef.current) return;
      if (!generated) {
        setGeminiQueue({ ...queue, status: "PAUSED" });
        return;
      }

      processed.add(beatId);
      queue = markQueueBeatCompleted(queue, beatId);
      setGeminiQueue(queue);
    }

    if (runToken !== geminiRunTokenRef.current) return;
    const completedQueue: GeminiQueueState = {
      ...queue,
      currentIndex: queue.beatIds.length,
      status: "COMPLETED",
    };
    setGeminiQueue(completedQueue);
    setNotice(
      `Gemini All hoàn tất: ${completedQueue.completedBeatIds.length} generated, ${completedQueue.skippedBeatIds.length} skipped.`,
    );
  }

  async function startGeminiAll() {
    if (!selectedChapterId || !allChapterBeats.length) return;
    const queue: GeminiQueueState = {
      chapterId: selectedChapterId,
      beatIds: allChapterBeats.map((beat) => beat.id),
      completedBeatIds: [],
      skippedBeatIds: [],
      currentIndex: 0,
      status: "RUNNING",
    };
    setGeminiQueue(queue);
    const runToken = ++geminiRunTokenRef.current;
    await runGeminiQueue(queue, runToken);
  }

  async function resumeGeminiAll() {
    if (!geminiQueue || geminiQueue.status === "COMPLETED") return;
    const runToken = ++geminiRunTokenRef.current;
    const resumed = { ...geminiQueue, status: "RUNNING" as const };
    setGeminiQueue(resumed);
    await runGeminiQueue(resumed, runToken);
  }

  async function skipCurrentGeminiBeat() {
    if (!geminiQueue || !currentQueueBeatId || geminiQueue.status === "COMPLETED") return;
    const skipped = markQueueBeatSkipped(geminiQueue, currentQueueBeatId);
    const nextQueue: GeminiQueueState =
      skipped.status === "COMPLETED" ? skipped : { ...skipped, status: "RUNNING" };
    setGeminiQueue(nextQueue);
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
    setGeminiQueue(null);
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
      const selection = await window.narrativex.localStorage.selectAsset();
      if (!selection) return;
      await persistGeneratedImage(beat, selection, "MANUAL");
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
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface-panel px-6 py-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-muted">
            <Clapperboard size={13} />
            Storyboard Workspace
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight">Scene & Visual Beat Manager</h1>
          <p className="mt-1 text-xs text-text-secondary">
            Quản lý visual beat, tự động generate ảnh bằng Gemini Web và gắn output về đúng beat.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Metric label="Scenes" value={scenes.length} />
          <Metric label="Visual Beats" value={beatCount} />
          <Metric label="Approved" value={approvedCount} />
        </div>
      </header>

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

          <section className="min-h-0 overflow-y-auto border-r border-border bg-surface-panel p-3">
            <PanelTitle title="Scenes" count={scenes.length} />
            <div className="mt-1 truncate text-[11px] text-text-muted">
              {selectedChapter?.title ?? "Chọn chapter"}
            </div>

            {storyboardQuery.isLoading ? (
              <LoadingState label="Đang tải storyboard..." />
            ) : storyboardQuery.isError ? (
              <InlineError message={errorMessage(storyboardQuery.error, "Không tải được storyboard.")} />
            ) : !scenes.length ? (
              <div className="mt-4 rounded-md border border-dashed border-border p-4 text-xs text-text-muted">
                Chapter này chưa có scene. Hãy chạy hoặc chạy lại phân tích chapter.
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {scenes.map((scene) => {
                  const active = scene.id === selectedSceneId;
                  return (
                    <button
                      key={scene.id}
                      type="button"
                      onClick={() => {
                        setSelectedSceneId(scene.id);
                        setCreatingBeat(false);
                        setCopiedPromptBeatId(null);
                      }}
                      className={`w-full rounded-md border p-3 text-left transition ${
                        active
                          ? "border-primary/55 bg-primary/10"
                          : "border-border-subtle bg-surface-dark hover:border-border hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                          Scene {scene.orderIndex + 1}
                        </span>
                        <span className="rounded bg-surface-input px-1.5 py-0.5 text-[9px] text-text-muted">
                          {scene.approvedBeatCount}/{scene.totalBeatCount} approved
                        </span>
                      </div>
                      <div className="mt-1.5 text-xs font-semibold text-foreground">{scene.title}</div>
                      <div className="mt-2 text-[10px] uppercase tracking-wide text-text-dim">
                        {formatEnum(scene.status)}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

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
                  disabled={!allChapterBeats.length || geminiQueueActive}
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
              <GeminiQueuePanel
                queue={geminiQueue}
                currentBeat={currentQueueBeat}
                processedCount={queueProcessedCount}
                busy={Boolean(mediaBusyBeatId)}
                onResume={() => void resumeGeminiAll()}
                onSkip={() => void skipCurrentGeminiBeat()}
                onStop={stopGeminiAll}
                onDismiss={() => setGeminiQueue(null)}
              />
            )}

            {(mutationError || notice) && (
              <div className="mx-5 mt-3">
                {mutationError ? (
                  <InlineError message={errorMessage(mutationError, "Không thể cập nhật storyboard.")} />
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
              {!selectedScene ? (
                <EmptyState
                  title="Chọn scene để xem Visual Beat"
                  detail="Mỗi scene chứa các visual beat được tạo bởi quá trình phân tích hoặc thêm thủ công."
                  compact
                />
              ) : !selectedSceneBeats.length ? (
                <EmptyState
                  title="Scene chưa có Visual Beat"
                  detail="Bạn có thể thêm Visual Beat mới bằng nút phía trên."
                  compact
                />
              ) : !filteredVisualBeats.length ? (
                <EmptyState
                  title="Không có Visual Beat phù hợp"
                  detail="Thử chọn một trạng thái review khác để xem các Visual Beat còn lại."
                  compact
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
                  {filteredVisualBeats.map((beat) => (
                    <VisualBeatCard
                      key={beat.id}
                      beat={beat}
                      timelineBeat={timelineBeats.get(beat.id) ?? null}
                      updating={reviewUpdating}
                      mediaBusy={mediaBusyBeatId === beat.id}
                      pendingImport={pendingImportBeatId === beat.id}
                      promptCopied={copiedPromptBeatId === beat.id}
                      queueCurrent={currentQueueBeatId === beat.id && geminiQueue?.status !== "COMPLETED"}
                      generationLocked={geminiQueue?.status === "RUNNING" && currentQueueBeatId !== beat.id}
                      onReview={(status) => updateReview.mutate({ beat, status })}
                      onGenerate={() => void generateWithGemini(beat)}
                      onCopyPrompt={() => void copyPrompt(beat)}
                      onImport={() => void importGeneratedImage(beat)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function GeminiQueuePanel({
  queue,
  currentBeat,
  processedCount,
  busy,
  onResume,
  onSkip,
  onStop,
  onDismiss,
}: Readonly<{
  queue: GeminiQueueState;
  currentBeat: StoryboardVisualBeat | null;
  processedCount: number;
  busy: boolean;
  onResume: () => void;
  onSkip: () => void;
  onStop: () => void;
  onDismiss: () => void;
}>) {
  const total = queue.beatIds.length;
  const percent = total ? Math.round((processedCount / total) * 100) : 0;
  const completed = queue.status === "COMPLETED";
  const running = queue.status === "RUNNING";

  return (
    <div className="mx-5 mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary-hover">
            Gemini Web · Generate All
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-foreground">
            {running && <Loader2 size={13} className="animate-spin" />}
            {completed
              ? `Hoàn tất ${queue.completedBeatIds.length}/${total} ảnh`
              : running
                ? `${processedCount}/${total} · Chrome đang generate ${currentBeat?.title ?? "Visual Beat"}`
                : `${processedCount}/${total} · Tạm dừng tại ${currentBeat?.title ?? "Visual Beat"}`}
          </div>
          <div className="mt-1 text-[10px] text-text-muted">
            {queue.completedBeatIds.length} generated · {queue.skippedBeatIds.length} skipped · {percent}%
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {completed ? (
            <button
              type="button"
              onClick={onDismiss}
              className="h-8 rounded-md border border-border bg-surface-input px-3 text-[11px] font-semibold text-text-secondary hover:bg-surface-2"
            >
              Dismiss
            </button>
          ) : running ? (
            <button
              type="button"
              onClick={onStop}
              className="h-8 rounded-md border border-danger/30 px-3 text-[11px] font-semibold text-danger hover:bg-danger/5"
            >
              Stop after current
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={!currentBeat || busy}
                onClick={onResume}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-white hover:bg-primary-hover disabled:opacity-50"
              >
                <WandSparkles size={12} /> Retry & Resume
              </button>
              <button
                type="button"
                disabled={!currentBeat || busy}
                onClick={onSkip}
                className="h-8 rounded-md border border-border bg-surface-input px-3 text-[11px] font-semibold text-text-secondary hover:bg-surface-2 disabled:opacity-50"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={onStop}
                className="h-8 rounded-md border border-danger/30 px-3 text-[11px] font-semibold text-danger hover:bg-danger/5"
              >
                Stop
              </button>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-input">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      {!completed && (
        <p className="mt-2 text-[10px] leading-4 text-text-muted">
          NarrativeX resolve nhân vật xuất hiện trong từng beat, attach tối đa 3 locked reference theo đúng REF mapping, gửi Gemini Images, bắt output trực tiếp qua Chrome Network và chỉ dùng nút Download làm fallback.
        </p>
      )}
    </div>
  );
}

function VisualBeatCard({
  beat,
  timelineBeat,
  updating,
  mediaBusy,
  pendingImport,
  promptCopied,
  queueCurrent,
  generationLocked,
  onReview,
  onGenerate,
  onCopyPrompt,
  onImport,
}: Readonly<{
  beat: StoryboardVisualBeat;
  timelineBeat: DesktopTimelineBeat | null;
  updating: boolean;
  mediaBusy: boolean;
  pendingImport: boolean;
  promptCopied: boolean;
  queueCurrent: boolean;
  generationLocked: boolean;
  onReview: (status: VisualBeatReviewStatus) => void;
  onGenerate: () => void;
  onCopyPrompt: () => void;
  onImport: () => void;
}>) {
  const approved = beat.reviewStatus === "APPROVED";
  const prompt = beat.prompt ?? "Backend prompt unavailable.";

  return (
    <article className={`rounded-lg border bg-surface-panel p-4 ${queueCurrent ? "border-primary/60 ring-1 ring-primary/20" : "border-border"}`}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-surface-input px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-text-muted">
              Beat {beat.orderIndex + 1}
            </span>
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-hover">
              Gemini Web
            </span>
            <span className="rounded bg-surface-input px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-text-muted">
              Generate New
            </span>
            {queueCurrent && (
              <span className="rounded bg-info-bg px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-hover">
                Gemini All · Current
              </span>
            )}
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                approved ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              }`}
            >
              {approved ? "Approved" : "Needs review"}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-bold text-foreground">{beat.title}</h3>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-text-secondary">
            {beat.visualIntent}
          </p>

          <div className="mt-3 rounded-md border border-border-subtle bg-surface-dark p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[9px] font-bold uppercase tracking-wide text-text-muted">
                Prompt preview
              </span>
              <button
                type="button"
                onClick={onCopyPrompt}
                aria-label={promptCopied ? `Prompt copied for ${beat.title}` : `Copy prompt for ${beat.title}`}
                className={`inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  promptCopied ? "text-success" : "text-primary-hover hover:text-primary"
                }`}
              >
                {promptCopied ? <Check size={11} /> : <Copy size={11} />}
                {promptCopied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[10px] leading-4 text-text-secondary">
              {prompt}
            </p>
          </div>

          {pendingImport && (
            <div className="mt-3 rounded-md border border-info/25 bg-info-bg p-3 text-[10px] leading-4 text-text-secondary">
              Automation chưa hoàn tất. Bạn vẫn có thể dùng Import Generated Image làm fallback để gắn file ảnh thủ công vào beat này.
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={mediaBusy || generationLocked || !beat.prompt}
              onClick={onGenerate}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[11px] font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mediaBusy ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
              {mediaBusy ? "Generating…" : "Generate with Gemini"}
            </button>
            <button
              type="button"
              disabled={mediaBusy || generationLocked}
              onClick={onImport}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface-input px-3 text-[11px] font-semibold text-text-secondary hover:bg-surface-2 disabled:opacity-50"
            >
              {mediaBusy ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
              Import Image (fallback)
            </button>
            <button
              type="button"
              disabled={updating}
              onClick={() => onReview(approved ? "NEEDS_REVIEW" : "APPROVED")}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition disabled:opacity-50 ${
                approved
                  ? "border-border text-text-secondary hover:bg-surface-2"
                  : "border-success/35 bg-success/5 text-success hover:bg-success/10"
              }`}
            >
              {approved ? <RotateCcw size={12} /> : <Check size={12} />}
              {approved ? "Needs review" : "Approve"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border-subtle pt-3 text-[10px] text-text-muted">
            <Meta label="Motion" value={formatEnum(beat.motionMode)} />
            <Meta label="Camera" value={formatEnum(beat.cameraMovement)} />
            <Meta label="Angle" value={formatEnum(beat.cameraAngle)} />
            <Meta
              label="Time"
              value={timelineBeat ? `${formatMs(timelineBeat.startMs)} – ${formatMs(timelineBeat.endMs)}` : "—"}
            />
          </div>
        </div>

        <BeatImagePreview timelineBeat={timelineBeat} />
      </div>
    </article>
  );
}

function BeatImagePreview({ timelineBeat }: Readonly<{ timelineBeat: DesktopTimelineBeat | null }>) {
  const [failed, setFailed] = useState(false);
  const preview = useQuery({
    queryKey: ["assets", timelineBeat?.mediaAssetId ?? "none", "download-url"],
    queryFn: () => assetsApi.downloadUrl(timelineBeat?.mediaAssetId as string),
    enabled: Boolean(timelineBeat?.mediaAssetId && timelineBeat.mediaType === "IMAGE"),
    staleTime: 30_000,
  });

  if (!timelineBeat?.mediaAssetId || timelineBeat.mediaType !== "IMAGE") {
    return (
      <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-border bg-surface-dark text-center text-[10px] text-text-muted">
        <div>
          <ImagePlus className="mx-auto mb-2" size={22} />
          Chưa có ảnh cho beat này
        </div>
      </div>
    );
  }

  if (preview.isLoading) {
    return (
      <div className="grid min-h-40 place-items-center rounded-md border border-border bg-surface-dark text-text-muted">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (!preview.data?.url || preview.isError || failed) {
    return (
      <div className="grid min-h-40 place-items-center rounded-md border border-border bg-surface-dark px-3 text-center text-[10px] text-text-muted">
        Ảnh đã attach nhưng preview hiện không khả dụng.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-dark">
      <img
        src={preview.data.url}
        alt={`Visual beat ${timelineBeat.visualBeatId}`}
        className="aspect-video h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className="min-w-[78px] rounded-md border border-border bg-surface px-3 py-2 text-center">
      <div className="text-sm font-bold text-foreground">{value}</div>
      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted">{label}</div>
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

function Meta({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <div className="font-semibold uppercase tracking-wide text-text-dim">{label}</div>
      <div className="mt-1 truncate text-text-secondary">{value}</div>
    </div>
  );
}

function LoadingState({ label }: Readonly<{ label: string }>) {
  return (
    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-text-muted">
      <Loader2 size={14} className="animate-spin" />
      {label}
    </div>
  );
}

function InlineError({ message }: Readonly<{ message: string }>) {
  return (
    <div className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
      {message}
    </div>
  );
}

function EmptyState({
  title,
  detail,
  compact = false,
}: Readonly<{ title: string; detail: string; compact?: boolean }>) {
  return (
    <div className={`grid place-items-center ${compact ? "min-h-[220px]" : "min-h-0 flex-1"}`}>
      <div className="max-w-md px-6 text-center">
        <Clapperboard size={compact ? 24 : 30} className="mx-auto text-text-dim" />
        <div className="mt-3 text-sm font-bold">{title}</div>
        <p className="mt-1 text-xs leading-5 text-text-muted">{detail}</p>
      </div>
    </div>
  );
}

function formatEnum(value: string | null | undefined) {
  if (!value) return "—";
  return value
    .toLocaleLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toLocaleUpperCase() + part.slice(1))
    .join(" ");
}

function formatMs(value: number) {
  const totalSeconds = Math.max(0, Math.round(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
