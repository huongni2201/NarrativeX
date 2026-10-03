import { useMemo, useState } from "react";
import type {
  DesktopSelectedTake,
  DesktopShot,
  DesktopTake,
  DesktopTimelineBeat,
  GenerationStrategy,
} from "@narrativex/client-contracts";
import {
  Check,
  Clapperboard,
  Copy,
  Film,
  ImagePlus,
  Loader2,
  Play,
  RotateCcw,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StoryboardVisualBeat, VisualBeatReviewStatus } from "../api/storyboard.api";
import {
  useChapterProduction,
  useGenerateShot,
  useSelectTake,
  useUpdateShotStrategy,
} from "../../production/queries/video-production.queries";
import { useStoryboardImagePreview } from "../queries/storyboard-media.queries";
import { ShotActionToolbar } from "./ShotActionToolbar";
import { TakeSelectorDrawer } from "./TakeSelectorDrawer";
import { useRuntimeCapabilities } from "../../runtime/queries/runtime-capabilities.queries.ts";

export interface VideoShotboardProps {
  projectId: string;
  chapterId?: string | null;
  beats: StoryboardVisualBeat[];
  hasSelectedScene: boolean;
  selectedSceneBeatCount: number;
  timelineBeats: Map<string, DesktopTimelineBeat>;
  updating: boolean;
  mediaBusyBeatId: string | null;
  copiedPromptBeatId: string | null;
  onReview: (beat: StoryboardVisualBeat, status: VisualBeatReviewStatus) => void;
  onCopyPrompt: (beat: StoryboardVisualBeat) => void;
  onImport: (beat: StoryboardVisualBeat) => void;
  onGenerateShot?: (beat: StoryboardVisualBeat, shot: DesktopShot) => void;
  onRetakeShot?: (beat: StoryboardVisualBeat, shot: DesktopShot) => void;
}

export function VideoShotboard({
  projectId,
  chapterId,
  beats,
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
  const [activeDrawerBeatId, setActiveDrawerBeatId] = useState<string | null>(null);

  // Authoritative Chapter Production query and mutations
  const { data: production } = useChapterProduction(projectId, chapterId ?? null);
  const { supportedStrategies, isAvailable, videoCapability } = useRuntimeCapabilities();
  const generateTake = useGenerateShot(projectId, chapterId);
  const selectTake = useSelectTake(projectId, chapterId);
  const updateStrategy = useUpdateShotStrategy(projectId, chapterId);

  const shotByBeatId = useMemo(() => {
    const map = new Map<string, DesktopShot>();
    if (production) {
      for (const scene of production.scenes) {
        for (const vb of scene.visualBeats) {
          if (vb.shotSequence?.shots?.length) {
            map.set(vb.id, vb.shotSequence.shots[0]);
          }
        }
      }
    }
    for (const b of beats) {
      if (!map.has(b.id) && b.shotSequence?.shots?.length) {
        map.set(b.id, b.shotSequence.shots[0]);
      }
    }
    return map;
  }, [production, beats]);

  if (!hasSelectedScene) return <EmptyState title="Chọn scene để xem Video Shotboard" />;
  if (!selectedSceneBeatCount) return <EmptyState title="Scene chưa có Visual Beat / Shot" />;
  if (!beats.length) return <EmptyState title="Không có Shot nào phù hợp bộ lọc" />;

  const drawerBeat = beats.find((b) => b.id === activeDrawerBeatId) ?? null;
  const drawerShot: DesktopShot | null = drawerBeat
    ? shotByBeatId.get(drawerBeat.id) ??
      (drawerBeat.shotSequence?.shots?.length ? drawerBeat.shotSequence.shots[0] : null)
    : null;

  const drawerTakes: DesktopTake[] = drawerShot?.takes ?? [];
  const drawerSelectedTake: DesktopSelectedTake | null = drawerShot?.selectedTake ?? null;

  const handleSelectTake = async (takeId: string, sourceInMs: number, sourceOutMs: number) => {
    if (drawerShot) {
      await selectTake.mutateAsync({
        shotId: drawerShot.id,
        input: { takeId, sourceInMs, sourceOutMs },
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
        {beats.map((beat) => {
          const timelineBeat = timelineBeats.get(beat.id) ?? null;
          const isApproved = beat.reviewStatus === "APPROVED";
          const shot = shotByBeatId.get(beat.id);
          const currentStrategy = shot?.generationStrategy ?? "IMAGE_TO_VIDEO";
          const takes = shot?.takes ?? [];
          const takeCount = takes.length > 0 ? takes.length : timelineBeat?.mediaType === "VIDEO" ? 1 : 0;
          const isShotGenerating =
            shot?.status === "QUEUED" ||
            shot?.status === "GENERATING" ||
            shot?.status === "VALIDATING" ||
            takes.some((t) => t.status === "PENDING" || t.status === "RUNNING");
          const isBusy = mediaBusyBeatId === beat.id || isShotGenerating;
          const isVideo =
            timelineBeat?.mediaType === "VIDEO" ||
            Boolean(shot?.selectedTake && shot?.status === "SELECTED");

          return (
            <article
              key={beat.id}
              className="overflow-hidden border border-border-subtle bg-surface-panel rounded-md flex flex-col justify-between"
            >
              {/* Media Preview Area */}
              <div className="relative aspect-video bg-surface-dark overflow-hidden group">
                <BeatMediaPreview
                  projectId={projectId}
                  beat={beat}
                  timelineBeat={timelineBeat}
                  shot={shot}
                />

                {/* Top Badges */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap z-10">
                  {beat.dramaticIntent && (
                    <Badge variant="secondary" className="text-[9px] bg-background/80 backdrop-blur-xs">
                      {beat.dramaticIntent}
                    </Badge>
                  )}
                  {beat.retentionRole && (
                    <Badge
                      variant="outline"
                      className="text-[9px] bg-cyan-soft text-cyan border-cyan/40 backdrop-blur-xs"
                    >
                      {beat.retentionRole}
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className="text-[9px] bg-background/80 backdrop-blur-xs font-mono"
                  >
                    {isVideo ? "VIDEO (720p/24)" : "REF IMAGE"}
                  </Badge>
                </div>

                {/* Duration Tag */}
                {timelineBeat && (
                  <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-xs text-[10px] font-mono px-1.5 py-0.5 rounded text-foreground">
                    {(timelineBeat.durationMs / 1000).toFixed(1)}s
                  </div>
                )}
              </div>

              {/* Shot Details */}
              <div className="p-3 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-[13px] text-foreground truncate">
                    {beat.title}
                  </h3>
                  <Badge
                    variant={isApproved ? "default" : "outline"}
                    className="text-[9px] shrink-0"
                  >
                    {isApproved ? "APPROVED" : "NEEDS_REVIEW"}
                  </Badge>
                </div>

                <p className="text-[11px] text-text-muted line-clamp-2">
                  {beat.visualIntent}
                </p>

                {/* Shot Actions */}
                <div className="border-t border-border-subtle pt-2 mt-1">
                  {shot?.preflight && !shot.preflight.ready && shot.preflight.blockers.length > 0 && (
                    <div className="mb-1 text-[10px] text-destructive bg-destructive/10 p-1.5 rounded border border-destructive/20 font-mono">
                      Blocker: {shot.preflight.blockers[0]}
                    </div>
                  )}
                  <ShotActionToolbar
                    currentStrategy={currentStrategy}
                    supportedStrategies={supportedStrategies}
                    takeCount={takeCount}
                    isGenerating={isBusy}
                    isBlocked={
                      !isAvailable ||
                      shot?.status === "BLOCKED" ||
                      Boolean(shot?.preflight && !shot.preflight.ready)
                    }
                    blockedReason={
                      !isAvailable
                        ? (videoCapability.reason || "Hệ thống AI video (LTX) hiện chưa sẵn sàng")
                        : (shot?.preflight?.blockers?.[0] ??
                          (shot?.status === "BLOCKED" ? "Shot is blocked" : undefined))
                    }
                    onGenerate={() => {
                      if (!shot) return;
                      if (onGenerateShot) {
                        onGenerateShot(beat, shot);
                      } else {
                        generateTake.mutate({
                          shotId: shot.id,
                          input: { strategy: currentStrategy },
                        });
                      }
                    }}
                    onRetake={() => {
                      if (!shot || takes.length === 0) return;
                      if (onRetakeShot) {
                        onRetakeShot(beat, shot);
                      } else {
                        const latestTake = takes[takes.length - 1];
                        generateTake.mutate({
                          shotId: shot.id,
                          input: {
                            strategy: currentStrategy,
                            retryFromTakeId: latestTake?.id,
                            retryReason: "USER_RETAKE",
                          },
                        });
                      }
                    }}
                    onOpenTakeSelector={() => setActiveDrawerBeatId(beat.id)}
                    onStrategyChange={(newStrategy) => {
                      if (shot) {
                        updateStrategy.mutate({
                          shotId: shot.id,
                          strategy: newStrategy,
                        });
                      }
                    }}
                  />
                </div>

                {/* Review & Import Actions */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-border-subtle text-[11px]">
                  <Button
                    size="sm"
                    variant={isApproved ? "outline" : "default"}
                    className="flex-1 h-7 text-[11px]"
                    disabled={updating}
                    onClick={() =>
                      onReview(beat, isApproved ? "NEEDS_REVIEW" : "APPROVED")
                    }
                  >
                    {isApproved ? <RotateCcw size={12} /> : <Check size={12} />}
                    <span>{isApproved ? "Re-Review" : "Approve Visual"}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    disabled={isBusy}
                    onClick={() => onImport(beat)}
                    aria-label={`Import media for ${beat.title}`}
                  >
                    {isBusy ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <ImagePlus size={12} />
                    )}
                  </Button>
                </div>

                {/* Prompt Accordion */}
                <details className="border-t border-border-subtle pt-1 text-[10px]">
                  <summary className="cursor-pointer text-text-dim hover:text-text-muted">
                    Compiled Video Prompt
                  </summary>
                  <div className="mt-1">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-primary-hover hover:underline cursor-pointer"
                      onClick={() => onCopyPrompt(beat)}
                    >
                      {copiedPromptBeatId === beat.id ? (
                        <Check size={10} />
                      ) : (
                        <Copy size={10} />
                      )}
                      <span>{copiedPromptBeatId === beat.id ? "Copied" : "Copy Prompt"}</span>
                    </button>
                    <p className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-text-secondary bg-surface-dark p-1.5 rounded border border-border-soft">
                      {beat.prompt ?? "Compiled prompt unavailable."}
                    </p>
                  </div>
                </details>
              </div>
            </article>
          );
        })}
      </div>

      {/* Take Selector Drawer */}
      <TakeSelectorDrawer
        projectId={projectId}
        shot={drawerShot}
        takes={drawerTakes}
        selectedTake={drawerSelectedTake}
        isOpen={Boolean(activeDrawerBeatId && drawerShot)}
        onClose={() => setActiveDrawerBeatId(null)}
        onSelectTake={handleSelectTake}
      />
    </div>
  );
}

function BeatMediaPreview({
  projectId,
  beat,
  timelineBeat,
  shot,
}: Readonly<{
  projectId: string;
  beat: StoryboardVisualBeat;
  timelineBeat: DesktopTimelineBeat | null;
  shot?: DesktopShot | null;
}>) {
  const [failed, setFailed] = useState(false);
  const isVideo =
    timelineBeat?.mediaType === "VIDEO" ||
    Boolean(shot?.selectedTake && shot?.status === "SELECTED");
  const selectedTakeRecord = shot?.selectedTake
    ? shot.takes.find((t) => t.id === shot.selectedTake?.takeId)
    : null;
  const assetId =
    selectedTakeRecord?.outputAssetId ??
    beat.previewMediaAssetId ??
    (timelineBeat?.mediaType === "IMAGE" ? timelineBeat.mediaAssetId : null);

  const preview = useStoryboardImagePreview({
    projectId,
    assetId,
    enabled: Boolean(assetId),
  });

  if (!assetId) {
    return (
      <div className="grid aspect-video place-items-center bg-surface-dark text-[10px] text-text-muted">
        <Film size={22} className="text-text-dim mb-1" />
        <span>No take generated</span>
      </div>
    );
  }

  if (!preview.data?.url || failed) {
    return (
      <div className="grid aspect-video place-items-center bg-surface-dark text-[10px] text-text-muted">
        Preview unavailable
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
      alt={`Shot ${beat.id}`}
      className="aspect-video w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

function EmptyState({ title }: Readonly<{ title: string }>) {
  return (
    <div className="grid min-h-48 place-items-center border-y border-dashed border-border-subtle text-center text-[11px] text-text-muted">
      <div>
        <Clapperboard size={24} className="mx-auto mb-2 text-text-dim" />
        {title}
      </div>
    </div>
  );
}
