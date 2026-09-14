import { useEffect, useState } from "react";
import type { DesktopTimelineBeat } from "@narrativex/client-contracts";
import { Check, Clapperboard, Copy, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoryboardVisualBeat, VisualBeatReviewStatus } from "../api/storyboard.api";
import { useStoryboardImagePreview } from "../queries/storyboard-media.queries";
import { BeatRegenerationAction } from "./BeatRegenerationAction";

export function VisualBeatGrid({ projectId, beats, hasSelectedScene, selectedSceneBeatCount, timelineBeats, updating, mediaBusyBeatId, copiedPromptBeatId, onReview, onCopyPrompt, onImport }: Readonly<{
  projectId: string; beats: StoryboardVisualBeat[]; hasSelectedScene: boolean; selectedSceneBeatCount: number;
  timelineBeats: Map<string, DesktopTimelineBeat>; updating: boolean; mediaBusyBeatId: string | null; copiedPromptBeatId: string | null;
  onReview: (beat: StoryboardVisualBeat, status: VisualBeatReviewStatus) => void; onCopyPrompt: (beat: StoryboardVisualBeat) => void; onImport: (beat: StoryboardVisualBeat) => void;
}>) {
  if (!hasSelectedScene) return <EmptyState title="Chọn scene để xem Visual Beat"/>;
  if (!selectedSceneBeatCount) return <EmptyState title="Scene chưa có Visual Beat"/>;
  if (!beats.length) return <EmptyState title="Không có Visual Beat phù hợp"/>;
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2.5">{beats.map((beat) => {
    const timelineBeat = timelineBeats.get(beat.id) ?? null;
    const busy = mediaBusyBeatId === beat.id;
    const approved = beat.reviewStatus === "APPROVED";
    return <article key={beat.id} className="overflow-hidden border border-border-subtle bg-surface-panel">
      <BeatImagePreview projectId={projectId} beat={beat} timelineBeat={timelineBeat}/>
      <div className="p-2.5"><h3 className="truncate text-[12px] font-semibold">{beat.title}</h3><p className="mt-2 line-clamp-2 text-[10px] text-text-muted">{beat.visualIntent}</p>
        <div className="mt-2 flex gap-1.5 border-t border-border-subtle pt-2">
          <Button size="sm" className="flex-1" disabled={updating} onClick={() => onReview(beat, approved ? "NEEDS_REVIEW" : "APPROVED")}>{approved ? <RotateCcw size={12}/> : <Check size={12}/>} {approved ? "Review again" : "Approve"}</Button>
          <Button variant="outline" size="icon" disabled={busy} onClick={() => onImport(beat)} aria-label={`Import image for ${beat.title}`}>{busy ? <Loader2 size={12} className="animate-spin"/> : <ImagePlus size={12}/>}</Button>
          {timelineBeat ? <BeatRegenerationAction projectId={projectId} chapterId={timelineBeat.chapterId} visualBeatId={beat.id}/> : null}
        </div>
        <details className="mt-2 border-t border-border-subtle pt-2 text-[10px]"><summary className="cursor-pointer text-text-muted">Prompt</summary><button type="button" className="mt-2 inline-flex items-center gap-1 text-primary-hover" onClick={() => onCopyPrompt(beat)}>{copiedPromptBeatId === beat.id ? <Check size={11}/> : <Copy size={11}/>} {copiedPromptBeatId === beat.id ? "Copied" : "Copy"}</button><p className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-text-secondary">{beat.prompt ?? "Prompt unavailable."}</p></details>
      </div>
    </article>;
  })}</div>;
}

function BeatImagePreview({ projectId, beat, timelineBeat }: Readonly<{ projectId: string; beat: StoryboardVisualBeat; timelineBeat: DesktopTimelineBeat | null }>) {
  const [failed, setFailed] = useState(false);
  const assetId = beat.previewMediaAssetId ?? (timelineBeat?.mediaType === "IMAGE" ? timelineBeat.mediaAssetId : null);
  const preview = useStoryboardImagePreview({ projectId, assetId, enabled: Boolean(assetId) });
  useEffect(() => setFailed(false), [assetId]);
  if (!assetId) return <div className="grid aspect-video place-items-center bg-surface-dark text-[10px] text-text-muted"><ImagePlus size={20}/></div>;
  if (!preview.data?.url || failed) return <div className="grid aspect-video place-items-center bg-surface-dark text-[10px] text-text-muted">Preview unavailable</div>;
  return <img src={preview.data.url} alt={`Visual beat ${beat.id}`} className="aspect-video w-full object-cover" onError={() => setFailed(true)}/>;
}
function EmptyState({ title }: Readonly<{ title: string }>) { return <div className="grid min-h-48 place-items-center border-y border-dashed border-border-subtle text-center text-[11px] text-text-muted"><div><Clapperboard size={22} className="mx-auto mb-2"/>{title}</div></div>; }
