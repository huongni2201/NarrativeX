import { useState } from "react";
import type { DesktopShot, DesktopTake, DesktopTimelineBeat, GenerationStrategy } from "@narrativex/client-contracts";
import { Check, Clapperboard, Copy, Film, ImagePlus, Loader2, Play, RotateCcw, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StoryboardVisualBeat, VisualBeatReviewStatus } from "../api/storyboard.api";
import { useStoryboardImagePreview } from "../queries/storyboard-media.queries";
import { ShotActionToolbar } from "./ShotActionToolbar";
import { TakeSelectorDrawer } from "./TakeSelectorDrawer";

export interface VideoShotboardProps {
  projectId: string;
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
}

export function VideoShotboard({
  projectId,
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
}: Readonly<VideoShotboardProps>) {
  const [activeDrawerBeatId, setActiveDrawerBeatId] = useState<string | null>(null);

  if (!hasSelectedScene) return <EmptyState title="Chọn scene để xem Video Shotboard" />;
  if (!selectedSceneBeatCount) return <EmptyState title="Scene chưa có Visual Beat / Shot" />;
  if (!beats.length) return <EmptyState title="Không có Shot nào phù hợp bộ lọc" />;

  const drawerBeat = beats.find((b) => b.id === activeDrawerBeatId) ?? null;
  const drawerTimelineBeat = drawerBeat ? timelineBeats.get(drawerBeat.id) ?? null : null;

  // Synthesize desktop shot from beat for drawer
  const drawerShot: DesktopShot | null = drawerBeat
    ? {
        id: drawerBeat.id,
        sequenceId: drawerBeat.id,
        orderIndex: 0,
        narrativePurpose: drawerBeat.visualIntent,
        retentionRole: drawerBeat.retentionRole as any,
        subjects: [],
        startState: "Start pose",
        action: drawerBeat.visualIntent,
        endState: "End pose",
        composition: "Cinematic medium",
        camera: "35mm eye-level",
        subjectMotion: "Fluid movement",
        cameraMotion: "Smooth pan",
        environmentMotion: "Atmospheric",
        targetDurationMs: drawerTimelineBeat?.durationMs ?? 4000,
        generationStrategy: "IMAGE_TO_VIDEO",
        qualityProfile: "720p_24fps_standard",
        status: "PLANNED",
        takes: [],
      }
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3">
        {beats.map((beat) => {
          const timelineBeat = timelineBeats.get(beat.id) ?? null;
          const isApproved = beat.reviewStatus === "APPROVED";
          const isBusy = mediaBusyBeatId === beat.id;
          const isVideo = timelineBeat?.mediaType === "VIDEO";

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
                  <ShotActionToolbar
                    currentStrategy="IMAGE_TO_VIDEO"
                    takeCount={isVideo ? 1 : 0}
                    isGenerating={isBusy}
                    onGenerate={() => onImport(beat)}
                    onRetake={() => onImport(beat)}
                    onOpenTakeSelector={() => setActiveDrawerBeatId(beat.id)}
                    onStrategyChange={() => {}}
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
                    <span>{isApproved ? "Re-Review" : "Approve Shot"}</span>
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
        shot={drawerShot}
        takes={[]}
        selectedTake={null}
        isOpen={Boolean(activeDrawerBeatId)}
        onClose={() => setActiveDrawerBeatId(null)}
        onSelectTake={() => {}}
      />
    </div>
  );
}

function BeatMediaPreview({
  projectId,
  beat,
  timelineBeat,
}: Readonly<{
  projectId: string;
  beat: StoryboardVisualBeat;
  timelineBeat: DesktopTimelineBeat | null;
}>) {
  const [failed, setFailed] = useState(false);
  const assetId =
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
