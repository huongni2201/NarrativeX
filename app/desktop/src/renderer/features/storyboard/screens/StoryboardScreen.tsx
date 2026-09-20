import { useEffect, useMemo, useState } from "react";
import type { DesktopChapterDetails, DesktopTimeline } from "@narrativex/client-contracts";
import { CheckCheck, Clapperboard, Loader2, Plus, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InlineNotice, WorkspaceToolbar } from "../../workspace/components/WorkstationPrimitives";
import type { StoryboardVisualBeat } from "../api/storyboard.api";
import { StoryboardHeader } from "../components/StoryboardHeader";
import { StoryboardNavigator } from "../components/StoryboardNavigator";
import { VisualBeatGrid } from "../components/VisualBeatGrid";
import { VideoShotboard } from "../components/VideoShotboard";
import { RetentionPlanView } from "../components/RetentionPlanView";
import { useStoryboardMediaMutations } from "../queries/storyboard-media.queries";
import { useApproveVisualBeats, useCreateVisualBeat, useStoryboardQuery, useUpdateVisualBeatReview } from "../queries/storyboard.queries";
import { beatsNeedingReview, filterVisualBeatsByStatus, type VisualBeatStatusFilter } from "../storyboard-review";

export function StoryboardScreen({ projectId, chapters, timeline }: Readonly<{
  projectId: string; chapters: DesktopChapterDetails[]; timeline: DesktopTimeline | null;
}>) {
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [creatingBeat, setCreatingBeat] = useState(false);
  const [beatTitle, setBeatTitle] = useState("");
  const [visualIntent, setVisualIntent] = useState("");
  const [mediaBusyBeatId, setMediaBusyBeatId] = useState<string | null>(null);
  const [copiedPromptBeatId, setCopiedPromptBeatId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<VisualBeatStatusFilter>("ALL");
  const [viewMode, setViewMode] = useState<"SHOTBOARD" | "RETENTION_PLAN" | "GRID">("SHOTBOARD");

  useEffect(() => {
    if (!chapters.length) setSelectedChapterId(null);
    else if (!selectedChapterId || !chapters.some((chapter) => chapter.id === selectedChapterId)) setSelectedChapterId(chapters[0].id);
  }, [chapters, selectedChapterId]);

  const storyboardQuery = useStoryboardQuery(projectId, selectedChapterId);
  const createBeat = useCreateVisualBeat(projectId, selectedChapterId);
  const updateReview = useUpdateVisualBeatReview(projectId, selectedChapterId);
  const approveAll = useApproveVisualBeats(projectId, selectedChapterId);
  const mediaMutations = useStoryboardMediaMutations(projectId, selectedChapterId);
  const scenes = storyboardQuery.data?.scenes ?? [];

  useEffect(() => {
    if (!scenes.length) setSelectedSceneId(null);
    else if (!selectedSceneId || !scenes.some((scene) => scene.id === selectedSceneId)) setSelectedSceneId(scenes[0].id);
  }, [scenes, selectedSceneId]);

  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? null;
  const selectedSceneBeats = selectedScene?.visualBeats ?? [];
  const filteredVisualBeats = useMemo(() => filterVisualBeatsByStatus(selectedSceneBeats, reviewStatusFilter), [reviewStatusFilter, selectedSceneBeats]);
  const pendingApproval = useMemo(() => beatsNeedingReview(selectedSceneBeats), [selectedSceneBeats]);
  const timelineBeats = useMemo(() => new Map((timeline?.beats ?? []).filter((beat) => beat.chapterId === selectedChapterId).map((beat) => [beat.visualBeatId, beat])), [selectedChapterId, timeline?.beats]);
  const approvedCount = scenes.reduce((total, scene) => total + scene.approvedBeatCount, 0);
  const beatCount = scenes.reduce((total, scene) => total + scene.totalBeatCount, 0);
  const reviewUpdating = updateReview.isPending || approveAll.isPending;

  async function copyPrompt(beat: StoryboardVisualBeat) {
    if (!beat.prompt) return setNotice("Backend chưa trả prompt cho Visual Beat này.");
    try { await window.narrativex.system.copyText(beat.prompt); setCopiedPromptBeatId(beat.id); setNotice(`Đã copy prompt của “${beat.title}”.`); }
    catch (error) { setNotice(errorMessage(error, "Không thể copy prompt.")); }
  }

  async function importImage(beat: StoryboardVisualBeat) {
    if (mediaBusyBeatId) return;
    setMediaBusyBeatId(beat.id); setNotice(null);
    try {
      const result = await mediaMutations.importImage.mutateAsync({ beat, hasProductionTimelineBeat: timelineBeats.has(beat.id) });
      if (result) setNotice(`Ảnh đã được import vào “${beat.title}”.`);
    } catch (error) { setNotice(errorMessage(error, "Không thể import ảnh.")); }
    finally { setMediaBusyBeatId(null); }
  }

  const mutationError = createBeat.error ?? updateReview.error ?? approveAll.error;
  return <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground select-none">
    <StoryboardHeader sceneCount={scenes.length} beatCount={beatCount} approvedCount={approvedCount} />
    {!chapters.length ? <EmptyState title="Chưa có chapter" detail="Tạo chapter và chạy phân tích trước." /> :
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,288px)_minmax(0,1fr)] overflow-hidden">
        <StoryboardNavigator chapters={chapters} selectedChapterId={selectedChapterId} scenes={scenes} selectedSceneId={selectedSceneId} loading={storyboardQuery.isLoading} error={storyboardQuery.isError ? errorMessage(storyboardQuery.error, "Không tải được storyboard.") : null} onSelectChapter={(id) => { setSelectedChapterId(id); setSelectedSceneId(null); }} onSelectScene={setSelectedSceneId} />
        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <WorkspaceToolbar>
            <div className="flex items-center gap-3">
              <div><div className="flex items-center gap-1.5 text-[10px] uppercase text-text-dim"><WandSparkles size={11}/> Production Shots</div><div className="text-[12px] font-semibold">{selectedScene?.title ?? "Chọn scene"}</div></div>
              <div className="flex rounded border border-border-subtle bg-surface-dark p-0.5 text-[10px]">
                <button type="button" className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${viewMode === "SHOTBOARD" ? "bg-primary text-primary-foreground font-semibold" : "text-text-muted hover:text-foreground"}`} onClick={() => setViewMode("SHOTBOARD")}>Video Shotboard</button>
                <button type="button" className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${viewMode === "RETENTION_PLAN" ? "bg-primary text-primary-foreground font-semibold" : "text-text-muted hover:text-foreground"}`} onClick={() => setViewMode("RETENTION_PLAN")}>Retention Plan</button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Select value={reviewStatusFilter} onValueChange={(value) => setReviewStatusFilter(value as VisualBeatStatusFilter)}><SelectTrigger className="min-w-[124px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="ALL">All beats</SelectItem><SelectItem value="NEEDS_REVIEW">Needs review</SelectItem><SelectItem value="APPROVED">Approved</SelectItem></SelectContent></Select>
              <Button variant="ghost" size="sm" disabled={!pendingApproval.length || reviewUpdating} onClick={() => approveAll.mutate(pendingApproval)}>{approveAll.isPending ? <Loader2 size={12} className="animate-spin"/> : <CheckCheck size={12}/>} Approve {pendingApproval.length || ""}</Button>
              <Button size="sm" disabled={!selectedScene} onClick={() => setCreatingBeat((value) => !value)}><Plus size={12}/> Add Beat</Button>
            </div>
          </WorkspaceToolbar>
          {mutationError || notice ? <InlineNotice tone={mutationError ? "danger" : "info"}>{mutationError ? errorMessage(mutationError, "Không thể cập nhật storyboard.") : notice}</InlineNotice> : null}
          {creatingBeat && selectedScene ? <div className="grid shrink-0 gap-2 border-b border-border-subtle bg-surface-panel p-3 lg:grid-cols-[.65fr_1.35fr_auto]"><Input value={beatTitle} onChange={(event) => setBeatTitle(event.target.value)} placeholder="Beat title"/><Textarea value={visualIntent} onChange={(event) => setVisualIntent(event.target.value)} placeholder="Visual intent" rows={2}/><Button disabled={!beatTitle.trim() || !visualIntent.trim() || createBeat.isPending} onClick={() => selectedSceneId && createBeat.mutate({ sceneId: selectedSceneId, beat: { title: beatTitle.trim(), visualIntent: visualIntent.trim() } }, { onSuccess: () => { setBeatTitle(""); setVisualIntent(""); setCreatingBeat(false); } })}>Create</Button></div> : null}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {viewMode === "RETENTION_PLAN" ? (
              <RetentionPlanView hookPlan={null} retentionMap={null} />
            ) : viewMode === "GRID" ? (
              <VisualBeatGrid projectId={projectId} beats={filteredVisualBeats} hasSelectedScene={Boolean(selectedScene)} selectedSceneBeatCount={selectedSceneBeats.length} timelineBeats={timelineBeats} updating={reviewUpdating} mediaBusyBeatId={mediaBusyBeatId} copiedPromptBeatId={copiedPromptBeatId} onReview={(beat,status) => updateReview.mutate({beat,status})} onCopyPrompt={(beat) => void copyPrompt(beat)} onImport={(beat) => void importImage(beat)}/>
            ) : (
              <VideoShotboard projectId={projectId} beats={filteredVisualBeats} hasSelectedScene={Boolean(selectedScene)} selectedSceneBeatCount={selectedSceneBeats.length} timelineBeats={timelineBeats} updating={reviewUpdating} mediaBusyBeatId={mediaBusyBeatId} copiedPromptBeatId={copiedPromptBeatId} onReview={(beat,status) => updateReview.mutate({beat,status})} onCopyPrompt={(beat) => void copyPrompt(beat)} onImport={(beat) => void importImage(beat)}/>
            )}
          </div>
        </section>
      </div>}
  </div>;
}

function errorMessage(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
function EmptyState({ title, detail }: Readonly<{ title: string; detail: string }>) { return <div className="grid min-h-0 flex-1 place-items-center"><div className="text-center"><Clapperboard size={28} className="mx-auto text-text-dim"/><div className="mt-3 text-[13px] font-semibold">{title}</div><p className="mt-1 text-[11px] text-text-muted">{detail}</p></div></div>; }
