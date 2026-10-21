import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type {
  DesktopSelectedTake,
  DesktopShot,
  DesktopTake,
  DesktopTimelineBeat,
  ChapterProductionVisualBeat,
  GenerationStrategy,
  TakeContentReviewChecklist,
} from "../../../../shared/api-types";
import {
  AlertTriangle,
  Check,
  CircleDot,
  Clapperboard,
  Copy,
  Film,
  ImagePlus,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StoryboardVisualBeat, VisualBeatReviewStatus } from "../api/storyboard.api";
import {
  useChapterProduction,
  useGenerateShot,
  hasPendingShotAttempt,
  useSelectTake,
  useUpdateShotStrategy,
} from "../../production/queries/video-production.queries";
import { useStoryboardImagePreview } from "../queries/storyboard-media.queries";
import { ShotActionToolbar } from "./ShotActionToolbar";
import { TakeSelectorDrawer } from "./TakeSelectorDrawer";
import { TakeQualityBadge } from "./TakeQualityPanel";
import { shotQualitySummary } from "../../production/model/take-quality";
import { ShotAudioCueAllocationPanel } from "./ShotAudioCueAllocationPanel";
import { VisualBeatImageAttemptsPanel } from "./VisualBeatImageAttemptsPanel";
import { useRuntimeCapabilities } from "../../runtime/queries/runtime-capabilities.queries.ts";

export interface VideoShotboardProps {
  projectId: string;
  chapterId?: string | null;
  beats: StoryboardVisualBeat[];
  /** Scene titles keyed by scene id; used for the section headers that group the beats. */
  sceneTitleById?: ReadonlyMap<string, string>;
  hasSelectedScene: boolean;
  selectedSceneBeatCount: number;
  timelineBeats: DesktopTimelineBeat[];
  updating: boolean;
  mediaBusyBeatId: string | null;
  copiedPromptBeatId: string | null;
  onReview: (beat: StoryboardVisualBeat, status: VisualBeatReviewStatus) => void;
  onCopyPrompt: (beat: StoryboardVisualBeat) => void;
  onImport: (beat: StoryboardVisualBeat) => void;
  onGenerateShot?: (beat: StoryboardVisualBeat, shot: DesktopShot) => void;
  onRetakeShot?: (beat: StoryboardVisualBeat, shot: DesktopShot) => void;
}

const SHOT_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Chưa tạo",
  QUEUED: "Đang chờ",
  GENERATING: "Đang tạo",
  VALIDATING: "Đang kiểm tra",
  MANUAL_REVIEW: "Cần duyệt take",
  BLOCKED: "Bị chặn",
};

const BUSY_TAKE_STATUSES = ["PENDING", "RUNNING", "VALIDATING"];

/** Soft, token-based tone per shot state, so the label carries meaning besides colour. */
function shotStatusTone(shot: DesktopShot): string {
  if (shot.selectedTake) return "border-success/30 bg-success-bg text-success";
  switch (shot.status) {
    case "BLOCKED":
      return "border-danger-border bg-danger-bg text-danger";
    case "QUEUED":
    case "GENERATING":
    case "VALIDATING":
      return "border-cyan/30 bg-cyan-soft text-cyan";
    case "MANUAL_REVIEW":
      return "border-warning/30 bg-warning-bg text-warning";
    default:
      return "border-border bg-transparent text-text-muted";
  }
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function VideoShotboard({
  projectId,
  chapterId,
  beats,
  sceneTitleById,
  hasSelectedScene,
  selectedSceneBeatCount,
  timelineBeats,
  updating,
  mediaBusyBeatId,
  copiedPromptBeatId,
  onReview,
  onCopyPrompt,
  onImport,
  onGenerateShot,
  onRetakeShot,
}: Readonly<VideoShotboardProps>) {
  const [activeDrawerShotId, setActiveDrawerShotId] = useState<string | null>(null);
  const [onlyQcWarnings, setOnlyQcWarnings] = useState(false);

  // Authoritative Chapter Production query and mutations
  const { data: production } = useChapterProduction(projectId, chapterId ?? null);
  const { supportedStrategies, isAvailable, videoCapability } = useRuntimeCapabilities();
  const generateTake = useGenerateShot(projectId, chapterId);
  const selectTake = useSelectTake(projectId, chapterId);
  const updateStrategy = useUpdateShotStrategy(projectId, chapterId);

  const shotsByBeatId = useMemo(() => {
    const map = new Map<string, DesktopShot[]>();
    if (production) {
      for (const scene of production.scenes) {
        for (const vb of scene.visualBeats) {
          if (vb.shotSequence?.shots?.length) {
            map.set(
              vb.id,
              [...vb.shotSequence.shots].sort((left, right) => left.orderIndex - right.orderIndex),
            );
          }
        }
      }
    }
    for (const b of beats) {
      if (!map.has(b.id) && b.shotSequence?.shots.length) {
        map.set(
          b.id,
          [...b.shotSequence.shots].sort((left, right) => left.orderIndex - right.orderIndex),
        );
      }
    }
    return map;
  }, [production, beats]);

  const shotsById = useMemo(() => {
    const map = new Map<string, DesktopShot>();
    for (const shots of shotsByBeatId.values()) {
      for (const shot of shots) map.set(shot.id, shot);
    }
    return map;
  }, [shotsByBeatId]);

  // Shots with any take the automatic QC marked "Cần xem" or "Có lỗi" (advisory, never blocks selection).
  const qcAttentionShotIds = useMemo(() => {
    const ids = new Set<string>();
    for (const shot of shotsById.values()) {
      if (shotQualitySummary(shot.takes ?? [], shot.selectedTake?.takeId).needsAttention) ids.add(shot.id);
    }
    return ids;
  }, [shotsById]);

  const productionVisualBeatsById = useMemo(() => {
    const map = new Map<string, ChapterProductionVisualBeat>();
    for (const scene of production?.scenes ?? []) {
      for (const visualBeat of scene.visualBeats) map.set(visualBeat.id, visualBeat);
    }
    return map;
  }, [production]);

  const timelineBeatByShotId = useMemo(
    () => new Map(timelineBeats.flatMap((beat) => (beat.shotId ? [[beat.shotId, beat] as const] : []))),
    [timelineBeats],
  );
  const timelineBeatByVisualBeatId = useMemo(
    () => new Map(timelineBeats.filter((beat) => !beat.shotId).map((beat) => [beat.visualBeatId, beat])),
    [timelineBeats],
  );

  // Group the beats by scene (keeping the incoming order) so a long chapter can be scanned.
  const sceneGroups = useMemo(() => {
    const groups = new Map<string, StoryboardVisualBeat[]>();
    for (const beat of beats) {
      const group = groups.get(beat.sceneId);
      if (group) group.push(beat);
      else groups.set(beat.sceneId, [beat]);
    }
    return [...groups.entries()].map(([sceneId, sceneBeats], index) => ({
      sceneId,
      title: sceneTitleById?.get(sceneId) ?? `Scene ${index + 1}`,
      beats: sceneBeats,
      approvedCount: sceneBeats.filter((beat) => beat.reviewStatus === "APPROVED").length,
      shotCount: sceneBeats.reduce((sum, beat) => sum + (shotsByBeatId.get(beat.id)?.length ?? 0), 0),
    }));
  }, [beats, sceneTitleById, shotsByBeatId]);

  if (!hasSelectedScene) return <EmptyState title="Chọn scene để xem Video Shotboard" />;
  if (!selectedSceneBeatCount) return <EmptyState title="Scene chưa có Visual Beat / Shot" />;
  if (!beats.length) return <EmptyState title="Không có Shot nào phù hợp bộ lọc" />;

  const drawerShot = activeDrawerShotId ? shotsById.get(activeDrawerShotId) ?? null : null;
  const visibleSceneGroups = onlyQcWarnings
    ? sceneGroups
        .map((group) => ({
          ...group,
          beats: group.beats.filter((beat) =>
            (shotsByBeatId.get(beat.id) ?? []).some((shot) => qcAttentionShotIds.has(shot.id)),
          ),
        }))
        .filter((group) => group.beats.length > 0)
    : sceneGroups;

  const drawerTakes: DesktopTake[] = drawerShot?.takes ?? [];
  const drawerSelectedTake: DesktopSelectedTake | null = drawerShot?.selectedTake ?? null;
  const drawerSequenceShots = drawerShot
    ? [...shotsByBeatId.values()].find((sequenceShots) =>
        sequenceShots.some((shot) => shot.id === drawerShot.id),
      ) ?? []
    : [];
  const drawerSequenceIndex = drawerSequenceShots.findIndex((shot) => shot.id === drawerShot?.id);
  const previousShot = drawerSequenceShots[drawerSequenceIndex - 1] ?? null;
  const nextShot = drawerSequenceShots[drawerSequenceIndex + 1] ?? null;
  const previousSelectedTake = previousShot?.selectedTake
    ? previousShot.takes?.find((take) => take.id === previousShot.selectedTake?.takeId) ?? null
    : null;
  const nextSelectedTake = nextShot?.selectedTake
    ? nextShot.takes?.find((take) => take.id === nextShot.selectedTake?.takeId) ?? null
    : null;

  const handleSelectTake = async (
    takeId: string,
    sourceInMs: number,
    sourceOutMs: number,
    contentReview: TakeContentReviewChecklist,
  ) => {
    if (drawerShot) {
      await selectTake.mutateAsync({
        shotId: drawerShot.id,
        input: {
          takeId,
          sourceInMs,
          sourceOutMs,
          expectedRowVersion: drawerSelectedTake?.rowVersion ?? 0,
          contentReview,
        },
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!isAvailable && (
        <div
          role="status"
          className="mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning-bg px-3 py-2 text-label text-warning"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            <strong className="font-semibold">Chưa thể tạo video.</strong>{" "}
            {videoCapability.reason || "Hệ thống AI video (LTX) hiện chưa sẵn sàng."} Bạn vẫn có thể duyệt beat và
            quản lý ảnh; nút tạo video sẽ mở lại khi hệ thống sẵn sàng.
          </span>
        </div>
      )}
      {(qcAttentionShotIds.size > 0 || onlyQcWarnings) && (
        <div className="flex items-center gap-2 text-caption">
          <Button
            type="button"
            size="sm"
            variant={onlyQcWarnings ? "default" : "outline"}
            aria-pressed={onlyQcWarnings}
            className="h-7 text-caption"
            onClick={() => setOnlyQcWarnings((value) => !value)}
          >
            <AlertTriangle size={12} />
            <span>Shot có cảnh báo QC ({qcAttentionShotIds.size})</span>
          </Button>
          <span className="text-text-muted">QC tự động chỉ tham khảo, không chặn việc chọn Take.</span>
        </div>
      )}
      {onlyQcWarnings && visibleSceneGroups.length === 0 && (
        <EmptyState title="Không còn Shot nào có cảnh báo QC" />
      )}
      {visibleSceneGroups.map((group) => (
        <section key={group.sceneId} aria-label={group.title} className="flex flex-col gap-3">
          <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 py-2.5 backdrop-blur-sm">
            <h2 className="min-w-0 truncate text-[15px] font-semibold text-foreground">{group.title}</h2>
            <div className="flex shrink-0 items-center gap-2 text-caption text-text-muted">
              <span className="font-mono">
                {group.beats.length} beat · {group.shotCount} shot
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono font-medium ${
                  group.approvedCount === group.beats.length
                    ? "bg-success-bg text-success"
                    : "bg-warning-bg text-warning"
                }`}
              >
                {group.approvedCount}/{group.beats.length} đã duyệt
              </span>
            </div>
          </header>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4">
            {group.beats.map((beat) => {
              const timelineBeat = timelineBeatByVisualBeatId.get(beat.id) ?? null;
              const isApproved = beat.reviewStatus === "APPROVED";
              const shots = shotsByBeatId.get(beat.id) ?? [];
              const productionAudioCues = productionVisualBeatsById.get(beat.id)?.audioCues ?? [];
              const beatAssetId =
                shots.length === 0 || beat.previewMediaAssetId
                  ? beat.previewMediaAssetId ?? timelineBeat?.mediaAssetId ?? null
                  : null;
              const totalDurationMs = shots.length
                ? shots.reduce((sum, shot) => sum + shot.targetDurationMs, 0)
                : timelineBeat?.durationMs ?? 0;

              return (
                <article
                  key={beat.id}
                  className={`flex flex-col overflow-hidden rounded-md border border-border-subtle border-t-2 bg-surface-panel ${
                    isApproved ? "border-t-success/70" : "border-t-warning/70"
                  }`}
                >
                  {beatAssetId && (
                    <div className="aspect-video overflow-hidden bg-surface-dark">
                      <MediaPreview
                        projectId={projectId}
                        assetId={beatAssetId}
                        isVideo={timelineBeat?.mediaType === "VIDEO"}
                        alt={`Ảnh ${beat.title}`}
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 px-3 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 text-body font-semibold leading-snug text-foreground">
                        {beat.title}
                      </h3>
                      <Badge
                        variant="outline"
                        className={`shrink-0 gap-1 text-caption ${
                          isApproved
                            ? "border-success/30 bg-success-bg text-success"
                            : "border-warning/30 bg-warning-bg text-warning"
                        }`}
                      >
                        {isApproved ? <Check size={11} /> : <CircleDot size={11} />}
                        {isApproved ? "Đã duyệt" : "Cần duyệt"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-caption text-text-muted">
                      {beat.dramaticIntent && <span>{beat.dramaticIntent}</span>}
                      {beat.retentionRole && <span className="text-cyan">{beat.retentionRole}</span>}
                      <span>
                        {shots.length > 0
                          ? `${shots.length} shot`
                          : timelineBeat?.mediaType === "VIDEO"
                            ? "video"
                            : "ảnh tham chiếu"}
                        {totalDurationMs > 0 ? ` · ${formatSeconds(totalDurationMs)}` : ""}
                      </span>
                    </div>
                    {beat.visualIntent && (
                      <p className="line-clamp-2 text-caption text-text-secondary" title={beat.visualIntent}>
                        {beat.visualIntent}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-3 p-3">
                    {chapterId && (
                      <VisualBeatImageAttemptsPanel projectId={projectId} chapterId={chapterId} beat={beat} />
                    )}

                    {shots.length > 0 && productionAudioCues.length > 0 && (
                      <ShotAudioCueAllocationPanel
                        key={shots[0].sequenceId}
                        projectId={projectId}
                        chapterId={chapterId}
                        sequenceId={shots[0].sequenceId}
                        shots={shots}
                        cues={productionAudioCues}
                      />
                    )}

                    {shots.length === 0 ? (
                      <div
                        role="status"
                        className="rounded border border-dashed border-border-soft p-2 text-caption text-text-muted"
                      >
                        Chưa có Shot. Cần tạo Shot trước khi sản xuất video.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {(onlyQcWarnings ? shots.filter((shot) => qcAttentionShotIds.has(shot.id)) : shots).map((shot) => {
                          const index = shots.indexOf(shot);
                          const takes = shot.takes ?? [];
                          const isShotGenerating =
                            shot.status === "QUEUED" ||
                            shot.status === "GENERATING" ||
                            shot.status === "VALIDATING" ||
                            takes.some((take) => BUSY_TAKE_STATUSES.includes(take.status));
                          const isRequestPending =
                            generateTake.isPending && generateTake.variables?.shotId === shot.id;
                          const isBusy = mediaBusyBeatId === beat.id || isShotGenerating || isRequestPending;

                          return (
                            <ShotRow
                              key={shot.id}
                              projectId={projectId}
                              index={index}
                              shot={shot}
                              timelineBeat={timelineBeatByShotId.get(shot.id) ?? null}
                              isBusy={isBusy}
                              isAvailable={isAvailable}
                              unavailableReason={videoCapability.reason}
                              supportedStrategies={supportedStrategies}
                              onGenerate={() => {
                                if (onGenerateShot) {
                                  onGenerateShot(beat, shot);
                                } else {
                                  generateTake.mutate({
                                    shotId: shot.id,
                                    input: { strategy: shot.generationStrategy },
                                  });
                                }
                              }}
                              onRetake={() => {
                                if (takes.length === 0) return;
                                if (onRetakeShot) {
                                  onRetakeShot(beat, shot);
                                } else {
                                  const sourceTake =
                                    takes.find((take) => take.id === shot.selectedTake?.takeId) ?? takes[takes.length - 1];
                                  generateTake.mutate({
                                    shotId: shot.id,
                                    input: {
                                      strategy: shot.generationStrategy,
                                      retryFromTakeId: sourceTake.id,
                                      retryReason: "USER_RETAKE",
                                    },
                                  });
                                }
                              }}
                              onReconcile={() => generateTake.mutate({ shotId: shot.id, reconcile: true })}
                              onOpenTakeSelector={() => setActiveDrawerShotId(shot.id)}
                              onStrategyChange={(strategy) =>
                                updateStrategy.mutate({ shotId: shot.id, strategy })
                              }
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <footer className="mt-auto flex flex-col gap-2 border-t border-border-subtle p-3">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant={isApproved ? "outline" : "default"}
                        className="h-7 flex-1 text-caption"
                        disabled={updating}
                        onClick={() => onReview(beat, isApproved ? "NEEDS_REVIEW" : "APPROVED")}
                      >
                        {isApproved ? <RotateCcw size={12} /> : <Check size={12} />}
                        <span>{isApproved ? "Mở lại để duyệt" : "Duyệt visual"}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        disabled={mediaBusyBeatId === beat.id}
                        onClick={() => onImport(beat)}
                        aria-label={`${beat.previewMediaAssetId ? "Thay ảnh xem trước của" : "Nhập ảnh tham chiếu cho"} ${beat.title}`}
                        title={beat.previewMediaAssetId ? "Thay ảnh xem trước" : "Nhập ảnh tham chiếu"}
                      >
                        {mediaBusyBeatId === beat.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ImagePlus size={12} />
                        )}
                      </Button>
                    </div>

                    <details className="text-caption">
                      <summary className="cursor-pointer text-text-dim hover:text-text-muted">
                        Prompt video đã biên dịch
                      </summary>
                      <div className="mt-1.5 flex flex-col gap-1.5">
                        <button
                          type="button"
                          className="inline-flex w-fit cursor-pointer items-center gap-1 text-primary-hover hover:underline"
                          onClick={() => onCopyPrompt(beat)}
                        >
                          {copiedPromptBeatId === beat.id ? <Check size={10} /> : <Copy size={10} />}
                          <span>{copiedPromptBeatId === beat.id ? "Đã chép" : "Chép prompt"}</span>
                        </button>
                        <p className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded border border-border-soft bg-surface-dark p-1.5 text-text-secondary">
                          {beat.prompt ?? "Chưa có prompt đã biên dịch."}
                        </p>
                      </div>
                    </details>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {/* Take Selector Drawer */}
      <TakeSelectorDrawer
        projectId={projectId}
        shot={drawerShot}
        previousShot={previousShot}
        previousSelectedTake={previousSelectedTake}
        nextShot={nextShot}
        nextSelectedTake={nextSelectedTake}
        takes={drawerTakes}
        selectedTake={drawerSelectedTake}
        isOpen={Boolean(activeDrawerShotId && drawerShot)}
        onClose={() => setActiveDrawerShotId(null)}
        onSelectTake={handleSelectTake}
      />
    </div>
  );
}

interface ShotRowProps {
  projectId: string;
  index: number;
  shot: DesktopShot;
  timelineBeat: DesktopTimelineBeat | null;
  isBusy: boolean;
  isAvailable: boolean;
  unavailableReason?: string | null;
  supportedStrategies: GenerationStrategy[] | undefined;
  onGenerate: () => void;
  onRetake: () => void;
  onReconcile: () => void;
  onOpenTakeSelector: () => void;
  onStrategyChange: (strategy: GenerationStrategy) => void;
}

/** One Shot: a preview only when it has media, then status, notices and the action toolbar. */
function ShotRow({
  projectId,
  index,
  shot,
  timelineBeat,
  isBusy,
  isAvailable,
  unavailableReason,
  supportedStrategies,
  onGenerate,
  onRetake,
  onReconcile,
  onOpenTakeSelector,
  onStrategyChange,
}: Readonly<ShotRowProps>) {
  const takes = shot.takes ?? [];
  const selectedTakeRecord = shot.selectedTake
    ? takes.find((take) => take.id === shot.selectedTake?.takeId)
    : null;
  const selectedTimelineAssetId =
    shot.selectedTake && timelineBeat?.shotId === shot.id && timelineBeat.takeId === shot.selectedTake.takeId
      ? timelineBeat.mediaAssetId
      : null;
  const previewAssetId = shot.selectedTake
    ? selectedTakeRecord?.outputAssetId ?? selectedTimelineAssetId
    : timelineBeat?.mediaAssetId ?? null;

  const hasPendingRequest = hasPendingShotAttempt(projectId, shot.id);
  const isBlocked =
    !isAvailable || shot.status === "BLOCKED" || Boolean(shot.preflight && !shot.preflight.ready);
  const blockedReason = !isAvailable
    ? unavailableReason || "Hệ thống AI video (LTX) hiện chưa sẵn sàng"
    : shot.preflight?.blockers?.[0] ?? (shot.status === "BLOCKED" ? "Shot đang bị chặn" : undefined);
  const takeCount = Math.max(takes.length, Number(Boolean(shot.selectedTake)));
  const statusLabel = shot.selectedTake ? "Đã chọn take" : SHOT_STATUS_LABELS[shot.status] ?? shot.status;
  const qualitySummary = shotQualitySummary(takes, shot.selectedTake?.takeId);

  return (
    <section className="overflow-hidden rounded-md bg-surface-dark">
      {(previewAssetId || shot.selectedTake) && (
        <div className="aspect-video bg-background">
          {previewAssetId ? (
            <MediaPreview
              projectId={projectId}
              assetId={previewAssetId}
              isVideo={Boolean(shot.selectedTake)}
              alt={`Shot ${index + 1}`}
            />
          ) : (
            <div className="grid h-full place-items-center text-caption text-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Film size={14} className="text-text-dim" /> Chưa có bản xem trước của take đã chọn
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 p-2.5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-caption font-semibold text-foreground">Shot {index + 1}</span>
          <span className="font-mono text-caption text-text-muted">{formatSeconds(shot.targetDurationMs)}</span>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {qualitySummary.selectedLevel && (
              <TakeQualityBadge quality={selectedTakeRecord?.quality ?? { level: qualitySummary.selectedLevel, warnings: [] }} />
            )}
            {qualitySummary.defectTakeCount > 0 && (
              <span className="font-mono text-caption text-danger" title="Số Take bị QC tự động đánh dấu Có lỗi">
                {qualitySummary.defectTakeCount} take lỗi
              </span>
            )}
            <Badge variant="outline" className={`shrink-0 text-caption ${shotStatusTone(shot)}`}>
              {statusLabel}
            </Badge>
          </div>
        </div>

        {shot.narrativePurpose && (
          <p className="line-clamp-2 text-caption text-text-secondary" title={shot.narrativePurpose}>
            {shot.narrativePurpose}
          </p>
        )}

        {shot.status === "MANUAL_REVIEW" && !shot.selectedTake ? (
          <div role="status" className="rounded border border-warning/30 bg-warning-bg p-2 text-caption text-warning">
            Đã qua kiểm tra kỹ thuật. Hãy xem và cắt một take trước khi đưa vào timeline.
          </div>
        ) : null}
        {hasPendingRequest ? (
          <div role="status" className="rounded border border-warning/30 bg-warning-bg p-2 text-caption text-warning">
            Kết quả gửi yêu cầu trước chưa xác định. Hãy đối soát yêu cầu cũ trước khi tạo Take khác.
          </div>
        ) : null}
        {shot.preflight && !shot.preflight.ready && shot.preflight.blockers.length > 0 && (
          <div
            className="rounded border border-danger-border bg-danger-bg p-2 text-caption text-danger"
            title={shot.preflight.blockers[0]}
          >
            {shot.preflight.blockers[0].startsWith("MISSING_VOICE_PROFILE")
              ? "Thiếu hồ sơ giọng: nhân vật cần có mô tả giọng đọc trước khi tạo video."
              : `Chưa thể tạo video: ${shot.preflight.blockers[0]}`}
            {shot.preflight.blockers.some((reason) => reason.startsWith("MISSING_VOICE_PROFILE")) && (
              <Link
                to={`/projects/${projectId}/audio?tab=characters`}
                className="mt-1.5 block w-fit rounded font-medium text-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Thiết lập giọng nhân vật
              </Link>
            )}
          </div>
        )}

        <ShotActionToolbar
          currentStrategy={shot.generationStrategy}
          supportedStrategies={supportedStrategies}
          takeCount={takeCount}
          isGenerating={isBusy}
          isBlocked={isBlocked}
          blockedReason={blockedReason}
          isReconciliationRequired={hasPendingRequest}
          onGenerate={onGenerate}
          onRetake={onRetake}
          onReconcile={onReconcile}
          onOpenTakeSelector={onOpenTakeSelector}
          onStrategyChange={onStrategyChange}
        />
      </div>
    </section>
  );
}

function MediaPreview({
  projectId,
  assetId,
  isVideo,
  alt,
}: Readonly<{
  projectId: string;
  assetId: string;
  isVideo: boolean;
  alt: string;
}>) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [assetId]);

  const preview = useStoryboardImagePreview({ projectId, assetId, enabled: true });

  if (!preview.data?.url || failed) {
    return (
      <div className="grid h-full min-h-24 place-items-center bg-surface-dark text-caption text-text-muted">
        {preview.isLoading && !failed ? <Loader2 size={16} className="animate-spin text-text-dim" /> : "Không có bản xem trước"}
      </div>
    );
  }

  if (isVideo) {
    return (
      <video
        src={preview.data.url}
        controls
        preload="metadata"
        className="aspect-video w-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <img
      src={preview.data.url}
      alt={alt}
      className="aspect-video w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function EmptyState({ title }: Readonly<{ title: string }>) {
  return (
    <div className="grid min-h-48 place-items-center border-y border-dashed border-border-subtle text-center text-caption text-text-muted">
      <div>
        <Clapperboard size={24} className="mx-auto mb-2 text-text-dim" />
        {title}
      </div>
    </div>
  );
}
