import { useEffect, useMemo, useRef, useState } from "react";
import type {
  DesktopChapterDetails,
  DesktopTimeline,
  StoryboardGenerationBatch,
  StoryboardGenerationBeatSnapshot,
} from "@narrativex/client-contracts";
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
import { storyboardApi, type StoryboardVisualBeat } from "../api/storyboard.api";
import { GeminiQueueBanner } from "../components/GeminiQueueBanner";
import { StoryboardHeader } from "../components/StoryboardHeader";
import { StoryboardNavigator } from "../components/StoryboardNavigator";
import { VisualBeatGrid } from "../components/VisualBeatGrid";
import {
  beginQueueAttempt,
  classifyGeminiQueueGenerationError,
  createGeminiQueue,
  markQueueAttemptStage,
  markQueueBeatCompleted,
  markQueueBeatSkipped,
  reconcileQueue,
  restoreQueueForSession,
  skipQueueBeatIfMediaReady,
  unresolvedAttemptBeatIds,
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
  const [preparedBatch, setPreparedBatch] = useState<StoryboardGenerationBatch | null>(null);
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
      setPreparedBatch(null);
      return;
    }
    const restored = loadGeminiQueue(projectId, selectedChapterId);
    const nextQueue = restored ? restoreQueueForSession(restored) : null;
    publishGeminiQueue(nextQueue, selectedChapterId);
    setPreparedBatch(null);
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

  async function prepareGeminiBatch(beatIds: string[]): Promise<StoryboardGenerationBatch | null> {
    if (!selectedChapterId || !beatIds.length) return null;
    setNotice(`Gemini · Đang chuẩn bị snapshot bất biến cho ${beatIds.length} Visual Beat…`);
    try {
      const batch = await storyboardApi.prepareGeminiGenerationBatch(
        projectId,
        selectedChapterId,
        { beatIds },
        crypto.randomUUID(),
      );
      setPreparedBatch(batch);
      if (batch.stale) {
        setNotice("Gemini prepare trả về snapshot stale. Hãy refresh Storyboard và prepare lại.");
        return null;
      }
      if (batch.hasBlockingIssues) {
        setNotice(formatPreparationIssues(batch));
        return null;
      }
      if (batch.issues.length) {
        setNotice(`Gemini prepare hoàn tất với warning: ${batch.issues.map((issue) => issue.message).join(" · ")}`);
      }
      return batch;
    } catch (error) {
      setNotice(errorMessage(error, "Không thể chuẩn bị Gemini generation snapshot."));
      return null;
    }
  }

  async function generateGeminiImage(
    beat: StoryboardVisualBeat,
    batch: StoryboardGenerationBatch,
    snapshot: StoryboardGenerationBeatSnapshot,
    attemptId: string,
    queueMode = false,
  ): Promise<GeminiImageGenerationResult> {
    if (!queueMode && mediaBusyBeatId) return "PAUSE_QUEUE";
    if (activeGeminiBeatIdsRef.current.has(beat.id)) return "PAUSE_QUEUE";
    if (!selectedChapterId) {
      setNotice("Chưa chọn chapter để generate Gemini.");
      return "PAUSE_QUEUE";
    }

    activeGeminiBeatIdsRef.current.add(beat.id);
    publishActiveGeminiBeat();
    setPendingImportBeatId(null);
    setNotice(
      queueMode
        ? `Gemini All · Đang materialize ${snapshot.references.length} reference cho “${beat.title}”…`
        : `Đang materialize ${snapshot.references.length} reference cho “${beat.title}”…`,
    );

    try {
      const result = await mediaMutations.generateGeminiImage.mutateAsync({
        batch,
        snapshot,
        attemptId,
        hasProductionTimelineBeat: timelineBeats.has(beat.id),
        onReferencesResolved: (referenceCount) => {
          setNotice(
            queueMode
              ? `Gemini All · Đang gửi ${referenceCount} reference và exact snapshot prompt cho “${beat.title}”…`
              : `Đang gửi ${referenceCount} reference và exact snapshot prompt cho “${beat.title}”…`,
          );
        },
      });
      setNotice(
        queueMode
          ? `Gemini All · Đã gắn ảnh cho “${beat.title}” từ snapshot ${result.snapshotId.slice(0, 8)}.`
          : `Gemini đã generate và gắn ảnh vào “${beat.title}” từ immutable snapshot.`,
      );
      return "GENERATED";
    } catch (error) {
      const action = classifyGeminiQueueGenerationError(error);
      setNotice(
        action === "SKIP_BEAT" && queueMode
          ? `Gemini All · Provider từ chối “${beat.title}”; beat được đánh dấu skipped, prompt không bị tự sửa để né filter.`
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
    const batch = await prepareGeminiBatch([beat.id]);
    const snapshot = batch?.beats.find((candidate) => candidate.visualBeatId === beat.id);
    if (!batch || !snapshot) return;
    await generateGeminiImage(beat, batch, snapshot, crypto.randomUUID(), false);
  }

  async function storyboardConcurrency(): Promise<number> {
    try {
      return (await window.narrativex.preferences.get()).gemini.storyboardTabs;
    } catch {
      return 4;
    }
  }

  async function loadPreparedQueueBatch(queue: GeminiQueueState): Promise<StoryboardGenerationBatch | null> {
    if (!selectedChapterId || queue.legacyNeedsPrepare || !queue.batchId || !queue.batchFingerprint) {
      return null;
    }
    try {
      const batch = await storyboardApi.getGeminiGenerationBatch(projectId, selectedChapterId, queue.batchId);
      setPreparedBatch(batch);
      if (batch.stale || batch.requestFingerprint !== queue.batchFingerprint) {
        setNotice("Gemini All đã stale vì source/storyboard revision thay đổi. Pending beats phải prepare lại.");
        return null;
      }
      return batch;
    } catch (error) {
      setNotice(errorMessage(error, "Không thể đọc prepared Gemini batch."));
      return null;
    }
  }

  async function reconcileAttemptBeforeDispatch(
    queue: GeminiQueueState,
    beatId: string,
  ): Promise<{ queue: GeminiQueueState; canDispatch: boolean }> {
    const attempt = queue.attemptsByBeat[beatId];
    if (!attempt || attempt.stage === "FAILED") return { queue, canDispatch: true };
    if (attempt.stage === "COMPLETED") {
      const beat = beatById.get(beatId);
      if (beat?.previewMediaAssetId) {
        return { queue: markQueueBeatCompleted(queue, beatId), canDispatch: false };
      }
      setNotice(
        `Attempt ${attempt.attemptId} đã completed nhưng output chưa được attach trong UI hiện tại. Không tự resubmit; hãy review/skip beat.`,
      );
      return { queue: markQueueAttemptStage(queue, beatId, "UNKNOWN"), canDispatch: false };
    }

    const status = await window.narrativex.geminiWeb.attemptStatus({ attemptId: attempt.attemptId });
    if (!status) {
      return { queue, canDispatch: attempt.stage === "PREPARED" };
    }
    if (status.stage === "PREPARED") return { queue, canDispatch: true };
    if (status.stage === "FAILED") {
      return { queue: markQueueAttemptStage(queue, beatId, "FAILED"), canDispatch: true };
    }
    if (status.stage === "COMPLETED") {
      const beat = beatById.get(beatId);
      if (beat?.previewMediaAssetId) {
        return { queue: markQueueBeatCompleted(queue, beatId), canDispatch: false };
      }
      setNotice(
        `Gemini attempt ${attempt.attemptId} đã tạo output (checksum ${status.outputChecksumSha256?.slice(0, 12) ?? "unknown"}) nhưng chưa có attach evidence. Queue pause để tránh duplicate submit.`,
      );
      return { queue: markQueueAttemptStage(queue, beatId, "UNKNOWN"), canDispatch: false };
    }
    setNotice(
      `Gemini attempt ${attempt.attemptId} đang ở trạng thái ${status.stage}. Queue pause để reconcile thay vì blind-resubmit.`,
    );
    return { queue: markQueueAttemptStage(queue, beatId, "UNKNOWN"), canDispatch: false };
  }

  async function runGeminiQueue(initialQueue: GeminiQueueState, runToken: number) {
    let queue: GeminiQueueState = { ...initialQueue, status: "RUNNING" };
    const batch = await loadPreparedQueueBatch(queue);
    if (!batch) {
      publishGeminiQueue({ ...queue, status: "PAUSED" });
      return;
    }
    const unresolved = unresolvedAttemptBeatIds(queue);
    if (unresolved.length) {
      for (const beatId of unresolved) {
        const reconciled = await reconcileAttemptBeforeDispatch(queue, beatId);
        queue = reconciled.queue;
        publishGeminiQueue(queue);
        if (!reconciled.canDispatch && !queue.completedBeatIds.includes(beatId)) {
          publishGeminiQueue({ ...queue, status: "PAUSED" });
          return;
        }
      }
    }

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

        const snapshotId = queue.snapshotIdsByBeat[beatId];
        const snapshot = batch.beats.find(
          (candidate) => candidate.visualBeatId === beatId && candidate.snapshotId === snapshotId,
        );
        if (!snapshot) {
          acceptNewWork = false;
          setNotice(`Gemini batch thiếu immutable snapshot cho “${beat.title}”. Hãy prepare lại.`);
          return;
        }

        let reconciliation = await reconcileAttemptBeforeDispatch(queue, beatId);
        queue = reconciliation.queue;
        publishGeminiQueue(queue);
        if (!reconciliation.canDispatch) {
          if (!queue.completedBeatIds.includes(beatId)) acceptNewWork = false;
          return;
        }

        let attempt = queue.attemptsByBeat[beatId];
        if (!attempt || attempt.stage === "FAILED") {
          attempt = {
            attemptId: crypto.randomUUID(),
            snapshotId: snapshot.snapshotId,
            inputFingerprint: snapshot.inputFingerprint,
            stage: "PREPARED",
          };
          queue = beginQueueAttempt(queue, beatId, attempt);
          publishGeminiQueue(queue);
        }

        const generationResult = await generateGeminiImage(
          beat,
          batch,
          snapshot,
          attempt.attemptId,
          true,
        );
        if (runToken !== geminiRunTokenRef.current) return;
        if (generationResult === "GENERATED") {
          processed.add(beatId);
          queue = markQueueBeatCompleted(queue, beatId);
          publishGeminiQueue(queue);
          return;
        }

        const attemptStatus = await window.narrativex.geminiWeb.attemptStatus({
          attemptId: attempt.attemptId,
        });
        if (attemptStatus?.stage === "UNKNOWN" || attemptStatus?.stage === "SUBMITTING" || attemptStatus?.stage === "COMPLETED") {
          queue = markQueueAttemptStage(queue, beatId, "UNKNOWN");
          publishGeminiQueue(queue);
          acceptNewWork = false;
          return;
        }
        queue = markQueueAttemptStage(queue, beatId, "FAILED");
        publishGeminiQueue(queue);
        if (generationResult === "SKIP_BEAT") {
          processed.add(beatId);
          queue = markQueueBeatSkipped(queue, beatId);
          publishGeminiQueue(queue);
          return;
        }
        acceptNewWork = false;
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
      `Gemini All hoàn tất: ${completedQueue.completedBeatIds.length} generated, ${completedQueue.skippedBeatIds.length} skipped. Generated vẫn cần review/approve.`,
    );
  }

  async function startGeminiAll() {
    if (!selectedChapterId) return;
    const beatIds = beatsPendingGeminiGeneration.map((beat) => beat.id);
    const batch = await prepareGeminiBatch(beatIds);
    if (!batch) return;
    const queue = createGeminiQueue(selectedChapterId, batch);
    if (!queue) return;
    publishGeminiQueue(queue);
    const runToken = ++geminiRunTokenRef.current;
    await runGeminiQueue(queue, runToken);
  }

  async function resumeGeminiAll() {
    if (!geminiQueue || geminiQueue.status === "COMPLETED" || !selectedChapterId) return;
    let queue = geminiQueue;
    if (queue.legacyNeedsPrepare || !queue.batchId) {
      const handled = new Set([...queue.completedBeatIds, ...queue.skippedBeatIds]);
      const pendingIds = queue.beatIds.filter((beatId) => !handled.has(beatId));
      const batch = await prepareGeminiBatch(pendingIds);
      if (!batch) return;
      const migrated = createGeminiQueue(selectedChapterId, batch);
      if (!migrated) return;
      queue = migrated;
      setNotice("Queue format cũ đã được pause và prepare lại phần pending bằng immutable snapshots.");
    }
    const runToken = ++geminiRunTokenRef.current;
    const resumed: GeminiQueueState = { ...queue, status: "RUNNING" };
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
    setNotice("Đã pause Gemini All. In-flight attempts được phép hoàn tất; resume sẽ reconcile journal trước khi gửi request mới.");
  }

  async function copyPrompt(beat: StoryboardVisualBeat) {
    const submitted = preparedBatch?.beats.find((snapshot) => snapshot.visualBeatId === beat.id)?.prompt;
    const text = submitted ?? beat.prompt;
    if (!text) {
      setNotice("Backend chưa trả prompt cho Visual Beat này. Hãy prepare hoặc refresh Storyboard rồi thử lại.");
      return;
    }
    try {
      await window.narrativex.system.copyText(text);
      setCopiedPromptBeatId(beat.id);
      setNotice(
        submitted
          ? `Đã copy exact submitted snapshot prompt của “${beat.title}”.`
          : `Đã copy current draft prompt của “${beat.title}”.`,
      );
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
    setPreparedBatch(null);
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
                preparedBatch={preparedBatch}
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
                submittedSnapshots={preparedBatch?.beats ?? []}
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

function formatPreparationIssues(batch: StoryboardGenerationBatch): string {
  const blocking = batch.issues.filter((issue) => issue.severity === "BLOCKING");
  if (!blocking.length) return "Gemini prepare có issue cần review.";
  return `Gemini chưa dispatch: ${blocking.map((issue) => `${issue.code}${issue.visualBeatId ? ` (${issue.visualBeatId.slice(0, 8)})` : ""}: ${issue.message}`).join(" · ")}`;
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
